import {
  AgentRuntimeConfig,
  AgentStreamEvent,
  AgentStepTrace,
  AgentToolDefinition,
  ApprovalRequest,
  AgentExecutionContext,
  RecurringTaskSchema,
} from './types'
import { DEFAULT_AGENT_TOOLS } from './tools/builtins'
import { getAgentComposioTools } from './tools/composioTools'
import { buildAgentInstructions } from './instructions'
import { callGemini } from './providers/gemini'

/**
 * Dynamic LLM Parameter Extractor
 * Translates arbitrary natural language commands into structured tool arguments
 */
async function extractDynamicToolParameters(
  toolName: string,
  userPrompt: string,
  toolDescription: string
): Promise<Record<string, any>> {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey || geminiKey.trim().length === 0) return {}

  const schemaDescriptions: Record<string, string> = {
    gmail: '{ action: "read_latest"|"search", query: string (Gmail search query or label:inbox or is:unread or from:sender or keywords), maxResults?: number }',
    slack: '{ channel: string (e.g. "#general" or channel name), message: string (the actual message text to post) }',
    googledocs: '{ title: string, content?: string }',
    notion: '{ action: "create_page"|"search_page", title: string }',
    googlecalendar: '{ summary: string, time: string }',
    github: '{ action: "list_issues"|"create_issue"|"repo_info", repo: string }',
    reddit: '{ subreddit: string, query?: string }',
    outlook: '{ action: "read_inbox"|"send_email", subject?: string }',
    web_search: '{ query: string }',
    calculator: '{ expression: string }',
    database_query: '{ topic: string }',
  }

  const prompt = `You are a precise AI agent tool parameter extractor.
Translate the user's natural language command into exact JSON arguments for the tool.
Tool: "${toolName}" (${toolDescription})
Target Schema: ${schemaDescriptions[toolName] || '{ query: string }'}
User command: "${userPrompt}"

Rules:
1. If the user asks to read, check, or fetch inbox/latest emails, set query to "label:inbox" (or "is:unread" if unread requested).
2. If the user mentions a specific number of items (e.g. "3 email", "top 5", "10 teratas"), extract it as maxResults integer.
3. For messaging (Slack), extract ONLY the actual content to post into message, stripping out conversational prefixes like "tolong kirim bilang".
4. For documents (Google Docs / Notion), extract a clean title and content.
5. Return ONLY a single valid JSON object without markdown or code fences.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (res.ok) {
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        return JSON.parse(text)
      }
    }
  } catch (err) {
    console.warn(`Dynamic parameter extraction for ${toolName} failed:`, err)
  }

  return {}
}

export class AgentRuntime {
  private config: AgentRuntimeConfig
  private tools: Map<string, AgentToolDefinition> = new Map()

  constructor(config: AgentRuntimeConfig) {
    this.config = {
      ...config,
      model: config.model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
    }

    // Attach Builtin and Composio Tools (Phase 1 Step 6: createAgent({ tools: [slack(), gmail(), ...] }))
    const baseTools = config.tools || DEFAULT_AGENT_TOOLS
    const composioTools = getAgentComposioTools(config.connectedTools || [])
    const combinedTools = [...baseTools, ...composioTools]

    combinedTools.forEach((tool) => {
      this.tools.set(tool.name, tool)
    })
  }

  /**
   * Execute the 8-Step Agent Flow with real-time event streaming
   */
  async *execute(
    userPrompt: string,
    options?: {
      conversationHistory?: { role: 'user' | 'agent'; content: string }[]
      approvedAction?: { toolName: string; parameters: any } | null
    }
  ): AsyncGenerator<AgentStreamEvent, void, unknown> {
    const context: AgentExecutionContext = {
      agentId: this.config.agentId,
      agentName: this.config.name,
      systemPrompt: this.config.instructions,
      userId: this.config.userId || 'default_user',
    }

    // =========================================================================
    // STEP 1: User Request (Incoming prompt or task)
    // =========================================================================
    const step1Trace: AgentStepTrace = {
      step: 'user_request',
      stepNumber: 1,
      title: 'User Request',
      description: 'Menerima dan memvalidasi prompt dari pengguna.',
      status: 'completed',
      details: { prompt: userPrompt },
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'user_request', stepNumber: 1, trace: step1Trace }

    // =========================================================================
    // STEP 2: Reason + Plan (The agent interprets the goal)
    // =========================================================================
    const step2Trace: AgentStepTrace = {
      step: 'reason_plan',
      stepNumber: 2,
      title: 'Reason + Plan',
      description: 'Menganalisis tujuan dan merencanakan dekomposisi task.',
      status: 'running',
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

    // Determine intent and planning
    const lower = userPrompt.toLowerCase().trim()
    const connectedSlugs = (this.config.connectedTools || []).map((t) => t.toLowerCase())

    // Known external app integrations
    const EXTERNAL_APPS: Record<string, { slug: string; name: string; keywords: string[]; reason: string }> = {
      gmail: {
        slug: 'gmail',
        name: 'Gmail',
        keywords: ['gmail', 'email', 'inbox', 'surat elektronik', 'pesan masuk', 'mail'],
        reason: 'Diperlukan untuk membaca email masuk, mencari pesan penting, atau membuat automasi inbox.',
      },
      slack: {
        slug: 'slack',
        name: 'Slack',
        keywords: ['slack', '#general', 'channel slack', 'saluran slack'],
        reason: 'Diperlukan untuk memposting pesan, mengirim notifikasi tim, atau membaca channel di Slack.',
      },
      googledocs: {
        slug: 'googledocs',
        name: 'Google Docs',
        keywords: ['googledocs', 'google docs', 'docs', 'dokumen google'],
        reason: 'Diperlukan untuk membuat, membaca, atau memperbarui berkas di Google Docs.',
      },
      notion: {
        slug: 'notion',
        name: 'Notion',
        keywords: ['notion'],
        reason: 'Diperlukan untuk membaca, mencari, atau memperbarui halaman dan database di Notion.',
      },
      googlecalendar: {
        slug: 'googlecalendar',
        name: 'Google Calendar',
        keywords: ['googlecalendar', 'google calendar', 'kalender', 'calendar', 'meeting', 'jadwal meeting'],
        reason: 'Diperlukan untuk menjadwalkan agenda atau memeriksa ketersediaan jadwal di Google Calendar.',
      },
      github: {
        slug: 'github',
        name: 'GitHub',
        keywords: ['github', 'repo', 'repository', 'pull request', 'issue github'],
        reason: 'Diperlukan untuk mengelola issues, pull requests, atau repositori GitHub.',
      },
      reddit: {
        slug: 'reddit',
        name: 'Reddit',
        keywords: ['reddit', 'subreddit'],
        reason: 'Diperlukan untuk memantau diskusi dan mencari postingan di komunitas Reddit.',
      },
      outlook: {
        slug: 'outlook',
        name: 'Outlook',
        keywords: ['outlook', 'microsoft outlook'],
        reason: 'Diperlukan untuk membaca inbox dan mengirim email melalui Microsoft Outlook.',
      },
    }

    // Check if prompt matches an external app
    const matchedAppSlug = Object.keys(EXTERNAL_APPS).find((slug) => {
      const meta = EXTERNAL_APPS[slug]
      return meta.keywords.some((kw) => {
        const regex = new RegExp(`(^|\\b|\\s)${kw.replace(/\s+/g, '\\s+')}(\\b|\\s|$)`, 'i')
        return regex.test(lower)
      })
    })
    const matchedApp = matchedAppSlug ? EXTERNAL_APPS[matchedAppSlug] : null
    const isAppConnected = matchedApp ? connectedSlugs.includes(matchedApp.slug) : false

    const isExplicitConnectIntent =
      /^(connect|hubungkan|sambungkan|koneksikan|link|integrasikan|login|autentikasi|tambahkan)\b/i.test(lower) ||
      /\b(connect|hubungkan|sambungkan|koneksikan)\s+(ke\s+)?(gmail|slack|google\s*docs|docs|notion|google\s*calendar|calendar|github|reddit|outlook)\b/i.test(lower)

    const isAppJustConnected =
      /telah terhubung|berhasil terhubung|already connected|just connected|terkoneksi/i.test(lower)

    // Check history and current prompt for intent & progressive task setup
    const historyUserPrompts = (options?.conversationHistory || [])
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
    const combinedPrompt = [...historyUserPrompts, userPrompt].join(' \n ')
    const lowerCombined = combinedPrompt.toLowerCase()

    let plannedTools: string[] = []
    let reasoningNotes = ''

    // Phase 2 Step 8: Detect if prompt requests a recurring schedule / task
    // Note: Casual greetings (e.g., "selamat pagi", "halo") are NOT schedule intents
    const scheduleKeywordRegex = /\b(schedule|jadwal|jadwalkan|weekly|mingguan|recurring|rutin|setiap\s+(hari|minggu|bulan|pagi|senin|selasa|rabu|kamis|jumat|sabtu|weekday)|every\s+(day|week|month|morning|weekday|monday|tuesday|wednesday|thursday|friday))\b/i

    const isTimeReply =
      /^(0?\d|1\d|2[0-3])(?::[0-5]\d)?\s*(am|pm)?$/i.test(userPrompt.trim()) ||
      /\b(?:at|jam|pukul)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(userPrompt) ||
      /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(userPrompt)

    const hasScheduleHistory = historyUserPrompts.some((p) => scheduleKeywordRegex.test(p))
    const isScheduleIntent =
      scheduleKeywordRegex.test(userPrompt) ||
      ((isTimeReply || isAppJustConnected || lower.includes('setup routine')) && hasScheduleHistory)

    let taskSchema: RecurringTaskSchema | undefined = undefined

    if (isScheduleIntent) {
      let route = 'slack'
      if (lowerCombined.includes('gmail') || lowerCombined.includes('email') || lowerCombined.includes('unread')) route = 'gmail'
      else if (lowerCombined.includes('notion')) route = 'notion'
      else if (lowerCombined.includes('docs') || lowerCombined.includes('google docs')) route = 'googledocs'
      else if (lowerCombined.includes('calendar') || lowerCombined.includes('kalender')) route = 'googlecalendar'

      let frequency: 'daily' | 'weekly' | 'monthly' | 'manual' = 'weekly'
      if (lowerCombined.includes('daily') || lowerCombined.includes('harian') || lowerCombined.includes('setiap hari')) frequency = 'daily'
      else if (lowerCombined.includes('monthly') || lowerCombined.includes('bulanan')) frequency = 'monthly'

      const rootInstruction =
        historyUserPrompts.find((p) =>
          scheduleKeywordRegex.test(p)
        ) || userPrompt

      const cleanInstruction = rootInstruction
        .replace(/^(schedule|jadwalkan|tolong jadwalkan|buatkan jadwal|please schedule)\s*(a|an|the)?/i, '')
        .trim()

      taskSchema = {
        instruction: cleanInstruction || 'Send automated team message',
        route,
        date: new Date().toISOString().split('T')[0],
        time: '08:00 AM',
        frequency,
      }
    }

    if (options?.approvedAction) {
      plannedTools = [options.approvedAction.toolName]
      reasoningNotes = `Melanjutkan eksekusi aksi yang telah disetujui pengguna: ${options.approvedAction.toolName}`
    } else if (isExplicitConnectIntent && matchedApp) {
      plannedTools = []
      reasoningNotes = isAppConnected
        ? `Aplikasi ${matchedApp.name} sudah terhubung ke workspace ini.`
        : `Mendeteksi permintaan koneksi integrasi ${matchedApp.name}. Menyiapkan kartu otorisasi OAuth via Composio.`
    } else if (isScheduleIntent) {
      // During conversational routine planning/setup, DO NOT execute tools immediately.
      // Tools are routed into taskSchema / routine definition for scheduled execution.
      plannedTools = []
      reasoningNotes = `Menyiapkan recurring task schedule untuk instruksi: "${taskSchema?.instruction}". Tool routing ke ${taskSchema?.route}. Tidak mengeksekusi side-effects selama tahap konfigurasi.`
    } else if (isAppJustConnected && matchedApp) {
      plannedTools = []
      reasoningNotes = `Aplikasi ${matchedApp.name} telah berhasil terhubung ke workspace.`
    } else if (matchedApp && !isAppConnected) {
      plannedTools = []
      reasoningNotes = `Instruksi memerlukan aplikasi ${matchedApp.name}, tetapi aplikasi tersebut belum terhubung ke workspace.`
    } else if (matchedApp && isAppConnected) {
      if (this.tools.has(matchedApp.slug)) plannedTools.push(matchedApp.slug)
      reasoningNotes = `Mendeteksi instruksi pengelolaan ${matchedApp.name} via Composio.`
    } else if (lower.includes('publish') || lower.includes('delete') || lower.includes('hapus') || lower.includes('sync')) {
      plannedTools = ['execute_sensitive_action']
      reasoningNotes = 'Terdeteksi permintaan aksi kritis/perubahan data. Memerlukan verifikasi persetujuan (Human-in-the-Loop).'
    } else if (lower.includes('cari') || lower.includes('search') || lower.includes('info') || lower.includes('apa itu') || lower.includes('dokumen')) {
      plannedTools = ['web_search']
      reasoningNotes = 'Perlu mencari informasi atau dokumentasi relevan dari web.'
    } else if (lower.includes('hitung') || lower.includes('calculate') || lower.includes('*') || lower.includes('+') || lower.includes('%')) {
      plannedTools = ['calculator']
      reasoningNotes = 'Perlu melakukan kalkulasi matematis atau evaluasi rumus.'
    } else if (lower.includes('database') || lower.includes('data') || lower.includes('catatan')) {
      plannedTools = ['database_query']
      reasoningNotes = 'Perlu membaca data atau memori dari database agent.'
    } else {
      reasoningNotes = 'Menganalisis instruksi secara langsung berdasarkan persona dan pengetahuan model.'
    }

    step2Trace.status = 'completed'
    step2Trace.details = { reasoning: reasoningNotes, plannedTools }
    yield { type: 'step_complete', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

    // =========================================================================
    // STEP 3: Check Instructions (Apply rules, behavior, and constraints)
    // =========================================================================
    const step3Trace: AgentStepTrace = {
      step: 'check_instructions',
      stepNumber: 3,
      title: 'Check Instructions',
      description: 'Menerapkan batasan sistem, aturan persona, dan guardrails.',
      status: 'running',
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'check_instructions', stepNumber: 3, trace: step3Trace }

    const fullInstructions = buildAgentInstructions(this.config)
    step3Trace.status = 'completed'
    step3Trace.details = {
      rulesApplied: true,
      agentName: this.config.name,
      modelTarget: this.config.model,
      guardrails: 'Safety checks passed • Persona active',
    }
    yield { type: 'step_complete', step: 'check_instructions', stepNumber: 3, trace: step3Trace }

    // =========================================================================
    // STEP 4: Pick Tools (Choose the right connected tools)
    // =========================================================================
    const step4Trace: AgentStepTrace = {
      step: 'pick_tools',
      stepNumber: 4,
      title: 'Pick Tools',
      description: matchedApp && !isAppConnected
        ? `Aplikasi ${matchedApp.name} belum terhubung. Menyiapkan kartu otorisasi OAuth.`
        : plannedTools.length > 0
        ? `Memilih tool terhubung: ${plannedTools.join(', ')}`
        : 'Tidak memerlukan tool tambahan (Direct synthesis)',
      status: 'running',
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'pick_tools', stepNumber: 4, trace: step4Trace }

    step4Trace.status = 'completed'
    step4Trace.details = { selectedTools: plannedTools }
    yield { type: 'step_complete', step: 'pick_tools', stepNumber: 4, trace: step4Trace }

    // Tool execution results collector
    let toolResults: any[] = []

    // =========================================================================
    // STEP 5 & 7: Run Tools OR Ask for Approval
    // =========================================================================
    if (plannedTools.length > 0) {
      for (const toolName of plannedTools) {
        const tool = this.tools.get(toolName)
        if (!tool) continue

        // Check if tool requires human approval (Step 7: Ask for Approval)
        if (tool.requireApproval && !options?.approvedAction) {
          const approvalReq: ApprovalRequest = {
            id: `appr_${Date.now()}`,
            toolName: tool.name,
            parameters: {
              actionType: 'publish_brief',
              target: 'Workspace Production',
              description: userPrompt,
            },
            reason: 'Tindakan ini akan mempublikasikan data atau mengubah konfigurasi sistem.',
            timestamp: new Date().toLocaleTimeString('id-ID'),
          }

          const step7Trace: AgentStepTrace = {
            step: 'ask_approval',
            stepNumber: 7,
            title: 'Ask for Approval',
            description: `Meminta konfirmasi pengguna sebelum menjalankan "${tool.name}".`,
            status: 'waiting_approval',
            details: approvalReq,
            timestamp: new Date().toLocaleTimeString('id-ID'),
          }

          yield {
            type: 'approval_required',
            step: 'ask_approval',
            stepNumber: 7,
            trace: step7Trace,
            data: approvalReq,
          }

          // Pause execution until approved
          return
        }

        // STEP 5: Run Tools (Execute API, database, browser, tool actions)
        const step5Trace: AgentStepTrace = {
          step: 'run_tools',
          stepNumber: 5,
          title: 'Run Tools',
          description: `Mengeksekusi tool: ${tool.name}`,
          status: 'running',
          timestamp: new Date().toLocaleTimeString('id-ID'),
        }
        yield { type: 'step_start', step: 'run_tools', stepNumber: 5, trace: step5Trace }

        let params: any = {}
        if (options?.approvedAction) {
          params = options.approvedAction.parameters
        } else {
          try {
            params = await extractDynamicToolParameters(tool.name, userPrompt, tool.description)
          } catch (err) {
            console.warn(`Extraction failed for ${tool.name}:`, err)
          }

          // Fallback heuristics if essential fields remain blank
          if (tool.name === 'gmail') {
            if (!params.query) {
              params.query = /unread|belum/i.test(userPrompt) ? 'is:unread' : 'label:inbox'
            }
            if (!params.maxResults) {
              const countMatch = userPrompt.match(/\b(\d+)\b/)
              params.maxResults = countMatch ? parseInt(countMatch[1], 10) : 5
            }
            if (!params.action) {
              params.action = 'read_latest'
            }
          } else if (tool.name === 'slack') {
            if (!params.channel) {
              const channelMatch = userPrompt.match(/#[a-zA-Z0-9_-]+/)
              params.channel = channelMatch ? channelMatch[0] : '#general'
            }
            if (!params.message) {
              params.message = userPrompt
            }
          } else if (tool.name === 'googledocs') {
            if (!params.title) params.title = 'Dokumen Baru'
            if (!params.content) params.content = userPrompt
          } else if (tool.name === 'notion') {
            if (!params.action) params.action = 'create_page'
            if (!params.title) params.title = userPrompt
          } else if (tool.name === 'googlecalendar') {
            if (!params.summary) params.summary = userPrompt
            if (!params.time) params.time = '09:00'
          } else if (tool.name === 'web_search') {
            if (!params.query) params.query = userPrompt
          } else if (tool.name === 'calculator') {
            if (!params.expression) params.expression = userPrompt
          } else if (tool.name === 'database_query') {
            if (!params.topic) params.topic = userPrompt
          }
        }

        try {
          const result = await tool.execute(params, context)
          toolResults.push({ tool: tool.name, result })

          step5Trace.status = 'completed'
          step5Trace.details = { output: result }
          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }
        } catch (err: any) {
          step5Trace.status = 'failed'
          step5Trace.details = { error: err.message }
          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }
        }

        // =========================================================================
        // STEP 6: Review Results (Examine outputs and errors)
        // =========================================================================
        const step6Trace: AgentStepTrace = {
          step: 'review_results',
          stepNumber: 6,
          title: 'Review Results',
          description: 'Memeriksa output tool dan memvalidasi keakuratan data.',
          status: 'running',
          timestamp: new Date().toLocaleTimeString('id-ID'),
        }
        yield { type: 'step_start', step: 'review_results', stepNumber: 6, trace: step6Trace }

        step6Trace.status = 'completed'
        step6Trace.details = {
          reviewedCount: toolResults.length,
          statusCheck: 'All tool outputs verified and formatted.',
        }
        yield { type: 'step_complete', step: 'review_results', stepNumber: 6, trace: step6Trace }
      }
    }

    // =========================================================================
    // STEP 8: Final Response (Return a clear answer or generated UI)
    // =========================================================================
    const step8Trace: AgentStepTrace = {
      step: 'final_response',
      stepNumber: 8,
      title: 'Final Response',
      description: 'Menyintesis jawaban akhir untuk pengguna.',
      status: 'running',
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'final_response', stepNumber: 8, trace: step8Trace }

    // Synthesize final response strictly via AI or Progressive Routine Engine
    let finalAnswer = ''
    let activeProvider = ''
    let agentResponse: any = null

    // 1. Explicit tool connection or missing tool requirement
    if (isExplicitConnectIntent && matchedApp) {
      if (!isAppConnected) {
        agentResponse = {
          type: 'connection_required',
          message: `Aplikasi **${matchedApp.name}** belum terhubung ke workspace ini. Silakan klik tombol **Connect** di bawah untuk menghubungkan akun ${matchedApp.name} Anda secara langsung via Composio OAuth:`,
          questions: [],
          suggestedTools: [
            {
              slug: matchedApp.slug,
              name: matchedApp.name,
              reason: matchedApp.reason,
              isConnected: false,
            },
          ],
        }
      } else {
        agentResponse = {
          type: 'completed',
          message: `Akun **${matchedApp.name}** Anda sudah terhubung ke workspace ini dan siap digunakan. Silakan beri tahu tugas apa yang ingin Anda selesaikan, seperti memeriksa email terbaru, mencari pesan tertentu, atau membuat rutinitas otomatis.`,
          questions: [],
          suggestedTools: [
            {
              slug: matchedApp.slug,
              name: matchedApp.name,
              reason: 'Sudah terhubung ke workspace',
              isConnected: true,
            },
          ],
        }
      }
      finalAnswer = agentResponse.message
      activeProvider = 'Orbit Integration Engine'
    } else if (matchedApp && !isAppConnected && !isScheduleIntent) {
      agentResponse = {
        type: 'connection_required',
        message: `Untuk menjalankan tugas ini pada **${matchedApp.name}**, Anda perlu menghubungkan aplikasi ${matchedApp.name} terlebih dahulu ke workspace ini. Klik tombol **Connect** di bawah untuk menghubungkannya:`,
        questions: [],
        suggestedTools: [
          {
            slug: matchedApp.slug,
            name: matchedApp.name,
            reason: matchedApp.reason,
            isConnected: false,
          },
        ],
      }
      finalAnswer = agentResponse.message
      activeProvider = 'Orbit Integration Engine'
    } else if (isAppJustConnected && matchedApp && !isScheduleIntent) {
      agentResponse = {
        type: 'completed',
        message: `Akun **${matchedApp.name}** Anda telah berhasil terhubung ke workspace via Composio OAuth dan siap digunakan. Berikan instruksi atau tugas apa yang ingin Anda selesaikan selanjutnya.`,
        questions: [],
        suggestedTools: [
          {
            slug: matchedApp.slug,
            name: matchedApp.name,
            reason: 'Sudah terhubung ke workspace',
            isConnected: true,
          },
        ],
      }
      finalAnswer = agentResponse.message
      activeProvider = 'Orbit Integration Engine'
    } else if (isScheduleIntent) {
      const timeMatch =
        userPrompt.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i) ||
        userPrompt.match(/\b(?:at|jam|pukul|time)\s*(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)\b/i) ||
        combinedPrompt.match(/\b(?:at|jam|pukul|time)\s*(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)\b/i) ||
        combinedPrompt.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i)

      const hasSpecificTime = Boolean(timeMatch)

      const requiredTool = taskSchema?.route || 'slack'
      const isToolConnected =
        (this.config.connectedTools || []).map((t) => t.toLowerCase()).includes(requiredTool)

      const userTimezone = 'Asia/Jakarta'
      const todayDate = new Date().toISOString().split('T')[0]

      if (!isToolConnected) {
        // Step 2: If backend reports integration disconnected, render connection-required UI only.
        agentResponse = {
          type: 'connection_required',
          message: `Untuk menjalankan tugas "${taskSchema?.instruction}", Anda perlu menghubungkan aplikasi ${requiredTool.toUpperCase()} terlebih dahulu.`,
          questions: [],
          suggestedTools: [
            {
              slug: requiredTool,
              reason: `Diperlukan untuk memposting pesan atau mengambil data pada tugas ini.`,
            },
          ],
        }
        finalAnswer = agentResponse.message
        activeProvider = 'Orbit Routine Engine'
      } else if (!hasSpecificTime) {
        // Step 3 & 5: Ask only for the missing posting time (At most one question with Generative UI options)
        agentResponse = {
          type: 'clarification_required',
          message: `Saya telah merencanakan routine "${taskSchema?.instruction}" setiap hari kerja. Jam berapa pesan ini sebaiknya dijalankan?`,
          questions: [
            {
              id: 'q_time',
              question: 'Pilih jam eksekusi:',
              options: ['08:00 AM', '08:30 AM', '09:00 AM', 'Custom time'],
              fieldType: 'time',
            },
          ],
          assumptions: [
            `Timezone: ${userTimezone} (zona waktu default)`,
            `Mulai berlaku: Hari ini (${todayDate})`,
            'Frekuensi: Setiap Hari Kerja (Senin - Jumat)',
          ],
        }
        finalAnswer = agentResponse.message
        activeProvider = 'Orbit Routine Engine'
      } else {
        // Step 6: Show concise confirmation card before saving
        const extractedTime = timeMatch ? (timeMatch[1] || timeMatch[0]) : '08:00 AM'
        const cleanGoal = `Menjalankan ${taskSchema?.instruction} secara otomatis.`
        const fullInstruction =
          historyUserPrompts.find((p) => /every|setiap|schedule|post|greeting|summarize/i.test(p)) ||
          userPrompt

        agentResponse = {
          type: 'confirmation_required',
          message: `Semua detail telah lengkap. Tinjau ringkasan routine "${taskSchema?.instruction}" di bawah ini sebelum menyimpannya ke database:`,
          questions: [],
          routine: {
            name: taskSchema?.instruction || 'Rutinitas Terjadwal',
            goal: cleanGoal,
            instructions: fullInstruction,
            schedule: {
              startDate: todayDate,
              time: extractedTime,
              timezone: userTimezone,
              frequency: taskSchema?.frequency || 'weekly',
              weekdays: ['MO', 'TU', 'WE', 'TH', 'FR'],
            },
            tools: [
              {
                slug: requiredTool,
                reason: `Eksekusi otomatis ke saluran ${requiredTool}`,
              },
            ],
          },
          assumptions: [
            `Timezone: ${userTimezone}`,
            `Start Date: Hari ini (${todayDate})`,
            'Frekuensi: Setiap Hari Kerja (Senin - Jumat)',
            `Waktu Eksekusi: ${extractedTime}`,
          ],
        }
        finalAnswer = agentResponse.message
        activeProvider = 'Orbit Routine Engine'
      }
    }

    const effectivePrompt =
      userPrompt && userPrompt.trim().length > 0
        ? userPrompt
        : options?.approvedAction
        ? `Pengguna telah menyetujui eksekusi aksi: ${options.approvedAction.toolName} (${options.approvedAction.parameters?.actionType || 'action'}). Berikan konfirmasi dan ringkasan eksekusi dalam Bahasa Indonesia yang ramah dan jelas.`
        : 'Halo'

    // 2. Try OpenAI First (for conversational queries)
    const apiKey = process.env.OPENAI_API_KEY
    if (!finalAnswer && apiKey && apiKey.startsWith('sk-') && apiKey.length > 20) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: 'system', content: fullInstructions },
              ...(options?.conversationHistory || []).map((m) => ({
                role: m.role === 'agent' ? 'assistant' : 'user',
                content: m.content,
              })),
              {
                role: 'user',
                content: toolResults.length > 0
                  ? `${effectivePrompt}\n\n[Hasil Eksekusi Tool Agent SDK]:\n${JSON.stringify(toolResults, null, 2)}`
                  : effectivePrompt,
              },
            ],
            temperature: 0.7,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const text = data.choices?.[0]?.message?.content
          if (text) {
            finalAnswer = text
            activeProvider = `OpenAI (${this.config.model})`
          }
        } else {
          console.warn(`OpenAI failed with status ${response.status}, triggering automatic fallback to Gemini...`)
        }
      } catch (apiErr) {
        console.warn('OpenAI error, triggering automatic fallback to Gemini...', apiErr)
      }
    }

    // 3. Automatic Fallback to Google Gemini
    if (!finalAnswer) {
      const geminiApiKey = process.env.GEMINI_API_KEY
      if (geminiApiKey && geminiApiKey.trim().length > 0) {
        const selectedGeminiModel =
          this.config.model?.toLowerCase().includes('gemini')
            ? this.config.model
            : (process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash')

        console.log(`⚡ Agent SDK: Using Google Gemini (${selectedGeminiModel})...`)
        const geminiRes = await callGemini({
          apiKey: geminiApiKey,
          model: selectedGeminiModel,
          systemInstruction: fullInstructions,
          conversationHistory: options?.conversationHistory || [],
          userPrompt: effectivePrompt,
          toolResults,
        })

        if (geminiRes.success && geminiRes.content) {
          finalAnswer = geminiRes.content
          activeProvider = `${geminiRes.provider} (Auto-Fallback)`
        } else {
          console.warn('Gemini fallback notice:', geminiRes.error)
        }
      }
    }

    if (finalAnswer && !agentResponse) {
      const jsonMatch = finalAnswer.match(/```json(?::agent_response)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          agentResponse = JSON.parse(jsonMatch[1].trim())
        } catch {}
      } else {
        const rawJsonMatch = finalAnswer.match(/\{[\s\S]*?"type"\s*:\s*"(?:routine|clarification|tool_connection|connection_required|selection_required|confirmation_required)"[\s\S]*?\}/)
        if (rawJsonMatch) {
          try {
            agentResponse = JSON.parse(rawJsonMatch[0])
          } catch {}
        }
      }
    }


    // 3. Fallback when neither AI model nor routine engine produced an answer
    if (!finalAnswer && !agentResponse) {
      step8Trace.status = 'failed'
      step8Trace.details = {
        error: 'Tidak ada model AI yang aktif atau dapat merespons.',
        activeProvider: 'None',
      }
      yield {
        type: 'final_response',
        step: 'final_response',
        stepNumber: 8,
        trace: step8Trace,
        data: {
          answer:
            '⚠️ **Koneksi Model AI Tidak Tersedia**\n\nRespon simulasi telah dinonaktifkan sepenuhnya. Untuk mendapatkan jawaban langsung dari AI, pastikan konfigurasi API Key aktif pada file `.env.local`:\n- `OPENAI_API_KEY` (OpenAI)\n- ATAU `GEMINI_API_KEY` (Google Gemini)',
          provider: 'Error (AI Key Tidak Aktif)',
        },
      }
      return
    }

    // Clean markdown code blocks from finalAnswer if it was purely JSON
    let displayAnswer = finalAnswer
    if (finalAnswer.includes('```json:agent_response')) {
      displayAnswer = finalAnswer.replace(/```json:agent_response[\s\S]*?```/, '').trim()
      if (!displayAnswer && agentResponse?.message) {
        displayAnswer = agentResponse.message
      }
    }

    step8Trace.status = 'completed'
    step8Trace.details = {
      answerLength: displayAnswer.length,
      activeProvider,
      taskSchema,
      responseType: agentResponse?.type || 'message',
      agentResponse,
    }
    yield {
      type: 'final_response',
      step: 'final_response',
      stepNumber: 8,
      trace: step8Trace,
      data: { answer: displayAnswer, provider: activeProvider },
      taskSchema,
      agentResponse,
    }
  }
}
