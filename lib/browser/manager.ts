import 'server-only'
import { Browserbase } from '@browserbasehq/sdk'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'

export interface ActiveBrowserSession {
  sessionId: string
  debuggerUrl: string
  stagehand: any
  browser: any
  userId: string
  agentId?: string
  conversationId?: string
  lastUsedAt: number
}

// In-process cache of active browser sessions keyed by userId
const activeSessions = new Map<string, ActiveBrowserSession>()

const BROWSER_TIMEOUT_SECONDS = parseInt(process.env.BROWSER_SESSION_TIMEOUT_SECONDS || '300', 10)
const BROWSER_TIMEOUT_MS = BROWSER_TIMEOUT_SECONDS * 1000
const MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_BROWSER_SESSIONS_PER_USER || '1', 10)

function getBrowserbaseClient(): { bb: Browserbase; apiKey: string; projectId?: string } {
  const apiKey = process.env.BROWSERBASE_API_KEY
  const projectId = process.env.BROWSERBASE_PROJECT_ID

  if (!apiKey) {
    throw new Error(
      'Konfigurasi Browserbase belum lengkap. Pastikan BROWSERBASE_API_KEY telah diisi di .env.local.'
    )
  }

  const bb = new Browserbase({ apiKey })
  return { bb, apiKey, projectId }
}

/**
 * Helper to obtain Supabase client with graceful fallback when called outside Next.js request scope
 */
async function getSupabaseClient() {
  try {
    return await createSupabaseServerClient()
  } catch {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
    return createClient(supabaseUrl, supabaseAnonKey)
  }
}

/**
 * Persists session record into Supabase browser_sessions table (if available)
 */
async function persistSessionToDatabase(data: {
  userId: string
  agentId?: string
  conversationId?: string
  sessionId: string
  debuggerUrl: string
  status: 'active' | 'closed'
}) {
  try {
    const supabase = await getSupabaseClient()
    const expiresAt = new Date(Date.now() + BROWSER_TIMEOUT_MS).toISOString()

    const { error } = await supabase.from('browser_sessions').insert({
      user_id: data.userId,
      agent_id: data.agentId || null,
      conversation_id: data.conversationId || null,
      browserbase_session_id: data.sessionId,
      debugger_url: data.debuggerUrl,
      status: data.status,
      expires_at: expiresAt,
    })

    if (error) {
      // If table doesn't exist yet, log warning and gracefully continue in-memory
      console.warn(`[BrowserManager] Catatan DB browser_sessions: ${error.message}`)
    }
  } catch (err: any) {
    console.warn(`[BrowserManager] Supabase error saat menyimpan sesi browser: ${err.message}`)
  }
}

/**
 * Updates status of session in Supabase browser_sessions table
 */
async function updateSessionStatusInDatabase(sessionId: string, status: 'released' | 'closed') {
  try {
    const supabase = await getSupabaseClient()
    await supabase
      .from('browser_sessions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('browserbase_session_id', sessionId)
  } catch (err: any) {
    console.warn(`[BrowserManager] Supabase error saat update sesi: ${err.message}`)
  }
}

/**
 * Creates a Stagehand v4 ClientLLM backed by OpenRouter.
 * This guarantees the exact same model and gateway used for chat and Composio tools
 * is also used for Stagehand cloud browser operations (AGENTS.md & User Directive).
 */
export function createOpenRouterStagehandClient(requestedModel?: string) {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  const openRouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
  const modelName =
    requestedModel ||
    process.env.OPENROUTER_DEFAULT_MODEL ||
    process.env.STAGEHAND_MODEL ||
    'google/gemini-2.5-flash'

  if (!openRouterKey || openRouterKey.trim().length === 0) {
    throw new Error(
      'OPENROUTER_API_KEY belum diatur. Diperlukan untuk menjalankan model browser Stagehand via OpenRouter.'
    )
  }

  return {
    generate: async (input: any) => {
      console.log(`[Stagehand -> OpenRouter] Generating inference for model: ${modelName}...`)

      const messages: any[] = []
      if (input.systemPrompt) {
        messages.push({ role: 'system', content: input.systemPrompt })
      }

      for (const m of input.messages || []) {
        let textContent = ''
        if (typeof m.content === 'string') {
          textContent = m.content
        } else if (Array.isArray(m.content)) {
          textContent = m.content
            .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
            .join('\n')
        } else if (m.content?.text) {
          textContent = m.content.text
        } else {
          textContent = JSON.stringify(m.content)
        }
        messages.push({ role: m.role, content: textContent })
      }

      const isJsonExpected = !!input.responseFormat
      if (input.responseFormat) {
        messages.push({
          role: 'system',
          content: `You must strictly return a valid JSON object matching this schema: ${JSON.stringify(input.responseFormat)}. If the schema requires an "extraction" key, your JSON must have the exact key "extraction": string. No conversational filler.`,
        })
      }

      const openRouterPayload: any = {
        model: modelName,
        messages,
      }

      if (isJsonExpected) {
        openRouterPayload.response_format = { type: 'json_object' }
      }

      const res = await fetch(`${openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'https://agent-marketing.local',
          'X-Title': process.env.OPENROUTER_APP_NAME || 'Agent Marketing',
        },
        body: JSON.stringify(openRouterPayload),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`)
      }

      const json = await res.json()
      const rawText = json.choices?.[0]?.message?.content || ''

      if (isJsonExpected) {
        let structured: any = {}
        try {
          const match = rawText.match(/\{[\s\S]*\}/)
          structured = JSON.parse(match ? match[0] : rawText)
        } catch {
          structured = { extraction: rawText }
        }

        // Normalize common key variants to Stagehand's expected "extraction" key
        if (!structured.extraction && structured.extracted_text) {
          structured.extraction = structured.extracted_text
          delete structured.extracted_text
        } else if (!structured.extraction && structured.result) {
          structured.extraction = structured.result
          delete structured.result
        }

        return {
          role: 'assistant',
          outputFormat: 'json_schema',
          structuredContent: structured,
          content: [{ type: 'text', text: JSON.stringify(structured) }],
        }
      }

      return {
        role: 'assistant',
        outputFormat: 'text',
        content: [{ type: 'text', text: rawText }],
      }
    },
  }
}

/**
 * Resolves Stagehand model: prioritizes OpenRouter (same as Composio & Chat),
 * with graceful fallback to vendor key if OPENROUTER_API_KEY is absent.
 */
function resolveStagehandModel(requestedModel?: string) {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (openRouterKey && openRouterKey.trim().length > 0) {
    return createOpenRouterStagehandClient(requestedModel)
  }

  let modelName = process.env.STAGEHAND_MODEL || 'google/gemini-2.5-flash'
  let apiKey = ''

  if (modelName.startsWith('openai/')) {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
      apiKey = process.env.OPENAI_API_KEY.trim()
    } else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
      console.warn('[BrowserManager] OPENAI_API_KEY kosong, mengalihkan STAGEHAND_MODEL ke google/gemini-2.5-flash menggunakan GEMINI_API_KEY.')
      modelName = 'google/gemini-2.5-flash'
      apiKey = process.env.GEMINI_API_KEY.trim()
    }
  } else if (modelName.startsWith('google/')) {
    apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
  } else if (modelName.startsWith('anthropic/')) {
    apiKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  } else {
    apiKey = (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
  }

  return { modelName: modelName as any, apiKey }
}

/**
 * Mendapatkan sesi browser yang sedang aktif atau membuat sesi baru via Browserbase Cloud + Stagehand v4.
 * Mendukung reconnect sesi antar request serverless (AGENTS.md §B & §C).
 */
export async function getOrCreateBrowserSession(
  userId: string,
  agentId?: string,
  conversationId?: string,
  requestedModel?: string
): Promise<ActiveBrowserSession> {
  const existing = activeSessions.get(userId)
  const now = Date.now()

  // 1. Periksa apakah instance sesi lokal masih valid
  if (existing) {
    if (now - existing.lastUsedAt < BROWSER_TIMEOUT_MS) {
      existing.lastUsedAt = now
      return existing
    }
    // Jika timeout terlampaui, tutup sesi lama terlebih dahulu
    console.log(`[BrowserManager] Sesi untuk user ${userId} telah timeout, melepaskan sumber daya...`)
    await closeBrowserSession(userId).catch(() => {})
  }

  // 2. Periksa apakah ada sesi aktif di database Supabase yang belum kedaluwarsa untuk user ini
  const { bb, apiKey, projectId } = getBrowserbaseClient()
  const { Stagehand, browserbase } = await import('@browserbasehq/stagehand')
  const stagehandModelConfig = resolveStagehandModel(requestedModel)

  try {
    const supabase = await getSupabaseClient()
    const { data: dbSessions } = await supabase
      .from('browser_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (dbSessions && dbSessions.length > 0) {
      const dbSess = dbSessions[0]
      const targetSessionId = dbSess.browserbase_session_id

      console.log(`[BrowserManager] Menyambungkan ulang ke sesi Browserbase yang tersimpan: ${targetSessionId}...`)
      try {
        const reconnectedBrowser = await browserbase.connect({
          apiKey,
          sessionId: targetSessionId,
        })

        const stagehand = await Stagehand.create({
          browser: reconnectedBrowser,
          model: stagehandModelConfig as any,
        })

        const recoveredSession: ActiveBrowserSession = {
          sessionId: targetSessionId,
          debuggerUrl: dbSess.debugger_url || '',
          stagehand,
          browser: reconnectedBrowser,
          userId,
          agentId: dbSess.agent_id || agentId,
          conversationId: dbSess.conversation_id || conversationId,
          lastUsedAt: Date.now(),
        }

        activeSessions.set(userId, recoveredSession)
        return recoveredSession
      } catch (reconnectErr: any) {
        console.warn(`[BrowserManager] Gagal menyambung ulang sesi lama ${targetSessionId}: ${reconnectErr.message}. Membuat sesi baru...`)
        await updateSessionStatusInDatabase(targetSessionId, 'released').catch(() => {})
      }
    }
  } catch (err: any) {
    // Abaikan jika tabel belum ada atau error koneksi DB
  }

  // 3. Batasi konkurensi sesi aktif per pengguna (AGENTS.md §C)
  if (activeSessions.size >= MAX_SESSIONS_PER_USER && activeSessions.has(userId)) {
    console.log(`[BrowserManager] Batas sesi per user (${MAX_SESSIONS_PER_USER}) tercapai, menutup sesi lama...`)
    await closeBrowserSession(userId).catch(() => {})
  }

  // 4. Meluncurkan browser cloud baru di Browserbase dengan keepAlive = true
  console.log(`[BrowserManager] Meluncurkan sesi browser cloud baru untuk user: ${userId}...`)

  const browser = await browserbase.launch({
    apiKey,
    projectId,
    keepAlive: true,
  })

  const sessionId = (browser as any).sessionId || (browser as any).session?.id
  if (!sessionId) {
    throw new Error('Gagal mendapatkan Session ID dari Browserbase.')
  }

  // Ambil URL DevTools Live View / Debugger
  let debuggerUrl = ''
  try {
    const debug = await bb.sessions.debug(sessionId)
    debuggerUrl = debug.debuggerUrl || ''
  } catch (err: any) {
    console.warn(`[BrowserManager] Gagal mengambil debuggerUrl: ${err.message}`)
  }

  // Buat instance Stagehand menggunakan model OpenRouter / terkonfigurasi
  const stagehand = await Stagehand.create({
    browser,
    model: stagehandModelConfig as any,
  })

  const sessionObj: ActiveBrowserSession = {
    sessionId,
    debuggerUrl,
    stagehand,
    browser,
    userId,
    agentId,
    conversationId,
    lastUsedAt: Date.now(),
  }

  activeSessions.set(userId, sessionObj)

  // Simpan ke DB secara non-blocking
  persistSessionToDatabase({
    userId,
    agentId,
    conversationId,
    sessionId,
    debuggerUrl,
    status: 'active',
  }).catch(() => {})

  console.log(`[BrowserManager] Sesi browser aktif dibuat: ${sessionId} (Live View: ${debuggerUrl ? 'Tersedia' : 'Tidak'})`)

  return sessionObj
}

/**
 * Mengambil informasi sesi aktif (termasuk Live View URL) untuk user tertentu.
 */
export function getActiveBrowserSession(userId: string): { sessionId: string; debuggerUrl: string } | null {
  const existing = activeSessions.get(userId)
  if (!existing) return null

  // Cek timeout
  if (Date.now() - existing.lastUsedAt >= BROWSER_TIMEOUT_MS) {
    closeBrowserSession(userId).catch(() => {})
    return null
  }

  return {
    sessionId: existing.sessionId,
    debuggerUrl: existing.debuggerUrl,
  }
}

/**
 * Menutup sesi browser cloud dan melepaskan resource di Browserbase.
 */
export async function closeBrowserSession(userId: string): Promise<boolean> {
  const existing = activeSessions.get(userId)
  if (!existing) return false

  activeSessions.delete(userId)

  try {
    if (existing.stagehand) {
      await existing.stagehand.close().catch(() => {})
    }
  } catch (err: any) {
    console.warn(`[BrowserManager] Error saat menutup Stagehand: ${err.message}`)
  }

  try {
    if (existing.browser) {
      await existing.browser.close().catch(() => {})
    }
  } catch (err: any) {
    console.warn(`[BrowserManager] Error saat menutup browser context: ${err.message}`)
  }

  try {
    const { bb } = getBrowserbaseClient()
    await bb.sessions.update(existing.sessionId, { status: 'REQUEST_RELEASE' }).catch(() => {})
    console.log(`[BrowserManager] Sesi ${existing.sessionId} berhasil dilepaskan di Browserbase.`)
  } catch (err: any) {
    console.warn(`[BrowserManager] Error saat melepaskan sesi di Browserbase: ${err.message}`)
  }

  // Update status di database
  updateSessionStatusInDatabase(existing.sessionId, 'released').catch(() => {})

  return true
}

/**
 * Pembersih sesi yatim (orphan/expired sessions) untuk cron / maintenance endpoint (AGENTS.md §C).
 */
export async function cleanupOrphanSessions(): Promise<{ cleanedCount: number }> {
  let cleanedCount = 0
  const now = Date.now()

  // 1. Bersihkan activeSessions di memori yang melewati batas timeout
  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastUsedAt >= BROWSER_TIMEOUT_MS) {
      await closeBrowserSession(userId).catch(() => {})
      cleanedCount++
    }
  }

  // 2. Periksa sesi di Browserbase yang masih berstatus RUNNING tapi sudah kadaluwarsa
  try {
    const { bb } = getBrowserbaseClient()
    const remoteSessions = await bb.sessions.list({ status: 'RUNNING' } as any).catch(() => [])

    for (const s of remoteSessions) {
      const createdAt = new Date(s.createdAt).getTime()
      if (now - createdAt > BROWSER_TIMEOUT_MS) {
        await bb.sessions.update(s.id, { status: 'REQUEST_RELEASE' }).catch(() => {})
        await updateSessionStatusInDatabase(s.id, 'released').catch(() => {})
        cleanedCount++
      }
    }
  } catch (err: any) {
    console.warn(`[BrowserManager] Warning saat memeriksa orphan sessions di Browserbase: ${err.message}`)
  }

  return { cleanedCount }
}

/**
 * Helper untuk mendapatkan halaman aktif dari sesi browser
 */
export async function getActivePage(stagehand: any) {
  if (!stagehand?.browser?.context) {
    throw new Error('Konteks browser tidak ditemukan pada instance Stagehand.')
  }
  const page = (await stagehand.browser.context.activePage()) || (await stagehand.browser.context.newPage())
  return page
}
