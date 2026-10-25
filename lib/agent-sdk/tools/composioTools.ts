import { z } from 'zod'
import { AgentToolDefinition, AgentExecutionContext } from '../types'
import { composioService } from '@/lib/composio/client'

/**
 * Helper to execute tool inside a Composio session with automatic connection detection
 */
async function executeComposioAction(
  toolkit: string,
  actionSlug: string,
  args: Record<string, any>,
  context: AgentExecutionContext
) {
  let session = context.composioSession
  if (!session) {
    try {
      session = await composioService.getOrCreateSession(context.userId || 'default_user', context.sessionId)
      context.composioSession = session
    } catch (sessionErr: any) {
      console.warn('[ComposioTool] Gagal memulihkan session Composio:', sessionErr.message)
    }
  }

  if (!session) {
    return {
      status: 'error',
      toolkit,
      error: 'Composio session tidak aktif atau COMPOSIO_API_KEY belum dikonfigurasi.',
    }
  }

  try {
    const res = await session.execute(actionSlug, args)
    if (res.resultType === 'completed') {
      return {
        status: 'success',
        toolkit,
        action: actionSlug,
        data: res.data,
        logId: res.logId,
      }
    } else {
      return {
        status: 'failed',
        toolkit,
        action: actionSlug,
        error: res.error || 'Eksekusi tool gagal pada server Composio',
        logId: res.logId,
      }
    }
  } catch (err: any) {
    // Detect missing connection error code 4302 / No active connection found
    const isNoConnection =
      err?.error?.error?.code === 4302 ||
      err?.message?.includes('No active connection found') ||
      err?.error?.error?.slug === 'ToolRouterV2_NoActiveConnection'

    if (isNoConnection) {
      // Auto-recovery attempt: check if canonical user has an active connection that was missed
      try {
        const canonicalUserId = await composioService.resolveCanonicalUserId(context.userId)
        const freshSession = await composioService.getOrCreateSession(canonicalUserId, null)
        const retryRes = await freshSession.execute(actionSlug, args)
        if (retryRes.resultType === 'completed') {
          context.composioSession = freshSession
          context.sessionId = freshSession.sessionId
          return {
            status: 'success',
            toolkit,
            action: actionSlug,
            data: retryRes.data,
            logId: retryRes.logId,
          }
        }
      } catch {
        // Fall through to real authorization link generation below
      }

      try {
        const auth = await session.authorize(toolkit.toLowerCase())
        return {
          status: 'connection_required',
          toolkit,
          requires_auth: true,
          connect_link: auth.redirectUrl,
          message: `Akun ${toolkit.toUpperCase()} Anda belum terhubung ke workspace. Silakan klik tautan otorisasi di bawah ini untuk menghubungkan akun secara langsung.`,
          connectLink: auth.redirectUrl,
          connectionId: auth.id,
        }
      } catch (authErr: any) {
        return {
          status: 'connection_required',
          toolkit,
          requires_auth: true,
          message: `Akun ${toolkit.toUpperCase()} belum terhubung (${authErr.message}).`,
        }
      }
    }

    return {
      status: 'error',
      toolkit,
      action: actionSlug,
      error: err.message || 'Terjadi kesalahan saat memanggil Composio API',
    }
  }
}

/**
 * 1. Gmail Tool (Composio)
 */
export const gmailTool: AgentToolDefinition = {
  name: 'gmail',
  description:
    'Akses akun Gmail pengguna untuk membaca inbox, mencari pesan, memeriksa email yang belum dibaca, atau MENGIRIM email baru secara nyata. WAJIB dipanggil setiap kali pengguna meminta mengirim atau membaca email.',
  parameters: z.object({
    action: z.enum(['read_latest', 'search', 'send_email']).describe('Aksi yang akan dilakukan'),
    query: z
      .string()
      .optional()
      .describe(
        'Kueri pencarian email Gmail (contoh: "is:unread", "label:inbox", "from:atasan@company.com", atau subjek email)'
      ),
    maxResults: z.number().optional().describe('Jumlah maksimal email yang diambil (default: 5)'),
    recipient: z.string().optional().describe('Alamat email tujuan jika mengirim email'),
    recipient_email: z.string().optional().describe('Alamat email tujuan jika mengirim email (alias to)'),
    to: z.string().optional().describe('Alamat email tujuan jika mengirim email (alias recipient_email)'),
    subject: z.string().optional().describe('Subjek email jika mengirim email'),
    body: z.string().optional().describe('Isi konten pesan email jika mengirim email'),
  }),
  requireApproval: false, // Write actions require approval dynamically handled or marked below
  execute: async ({ action, query, maxResults, recipient, recipient_email, to, subject, body }, context) => {
    if (action === 'send_email') {
      const targetRecipient = (recipient_email || to || recipient || '').trim()
      if (!targetRecipient) {
        return {
          status: 'failed',
          toolkit: 'gmail',
          action: 'send_email',
          error: 'Alamat email tujuan (recipient_email atau to) wajib diisi untuk mengirim email.',
        }
      }

      return executeComposioAction(
        'gmail',
        'GMAIL_SEND_EMAIL',
        {
          recipient_email: targetRecipient,
          to: targetRecipient,
          subject: subject || '(Tanpa Subjek)',
          body: body || '',
        },
        context
      )
    }

    // Read / Search action
    let cleanQuery = (query || '').trim()
    if (!cleanQuery) cleanQuery = 'label:inbox'
    const count = maxResults || 5

    const res = await executeComposioAction(
      'gmail',
      'GMAIL_FETCH_EMAILS',
      { query: cleanQuery, max_results: count },
      context
    )

    if (res.status === 'connection_required') return res
    if (res.status !== 'success') return res

    const rawMessages = res.data?.messages || []
    const messagePreviews = rawMessages.slice(0, count).map((m: any, idx: number) => ({
      index: idx + 1,
      id: m.id,
      subject: m.subject || m.preview?.subject || '(Tanpa Subjek)',
      sender: m.sender || m.from || 'Tidak diketahui',
      date: m.date || m.created_at || '',
      snippet: (m.preview?.body || m.snippet || '').trim().replace(/\s+/g, ' ').substring(0, 200),
    }))

    return {
      status: 'success',
      toolkit: 'gmail',
      count: messagePreviews.length,
      emails: messagePreviews,
      summary:
        messagePreviews.length > 0
          ? `Ditemukan ${messagePreviews.length} email dari Gmail:`
          : `Tidak ada email yang ditemukan untuk kueri "${cleanQuery}".`,
    }
  },
}

/**
 * 2. Slack Tool (Composio)
 */
export const slackTool: AgentToolDefinition = {
  name: 'slack',
  description:
    'Kirim pesan atau periksa saluran komunikasi di tim Slack pengguna. (Aksi pengiriman pesan adalah aksi eksternal).',
  parameters: z.object({
    channel: z
      .string()
      .describe('Nama channel Slack (misal: "general" atau "#general") atau ID percakapan (contoh: "C0123456789")'),
    message: z.string().describe('Teks pesan (mendukung markdown) yang ingin dikirim ke Slack'),
  }),
  requireApproval: false,
  execute: async ({ channel, message }, context) => {
    // Strip leading '#' if present (Composio requirement)
    const cleanChannel = (channel || '').trim().replace(/^#/, '')
    const payload = {
      channel: cleanChannel,
      markdown_text: message,
      text: message,
    }

    try {
      const res = await executeComposioAction('slack', 'SLACK_SEND_MESSAGE', payload, context)
      if (res.status === 'success' || res.status === 'connection_required') return res
    } catch {
      // Fallback to legacy action if needed
    }

    return executeComposioAction('slack', 'SLACK_CHAT_POST_MESSAGE', payload, context)
  },
}

/**
 * 3. GitHub Tool (Composio)
 */
export const gitHubTool: AgentToolDefinition = {
  name: 'github',
  description:
    'Akses GitHub untuk melihat daftar issues, informasi repositori, atau membuat issue baru.',
  parameters: z.object({
    action: z.enum(['list_issues', 'create_issue', 'repo_info']).describe('Aksi GitHub yang dilakukan'),
    owner: z.string().describe('Pemilik repositori (username atau organisasi, contoh: "facebook" atau "octocat")'),
    repo: z.string().describe('Nama repositori tanpa .git (contoh: "react" atau "Hello-World")'),
    title: z.string().optional().describe('Judul issue jika membuat issue baru'),
    body: z.string().optional().describe('Deskripsi atau isi konten issue baru'),
    state: z.enum(['open', 'closed', 'all']).optional().describe('Filter status issue (default: open)'),
  }),
  requireApproval: false,
  execute: async ({ action, owner, repo, title, body, state }, context) => {
    const cleanOwner = (owner || '').trim()
    const cleanRepo = (repo || '').trim().replace(/\.git$/, '')

    if (action === 'create_issue') {
      return executeComposioAction(
        'github',
        'GITHUB_CREATE_AN_ISSUE',
        {
          owner: cleanOwner,
          repo: cleanRepo,
          title: title || 'Issue Baru',
          body: body || '',
        },
        context
      )
    }

    if (action === 'list_issues') {
      return executeComposioAction(
        'github',
        'GITHUB_LIST_REPOSITORY_ISSUES',
        {
          owner: cleanOwner,
          repo: cleanRepo,
          state: state || 'open',
          per_page: 15,
        },
        context
      )
    }

    return executeComposioAction(
      'github',
      'GITHUB_GET_A_REPOSITORY',
      { owner: cleanOwner, repo: cleanRepo },
      context
    )
  },
}

/**
 * Helper to normalize date/time inputs to ISO 8601 (YYYY-MM-DDTHH:MM:SS)
 */
function normalizeCalendarDateTime(rawInput?: string): string {
  if (!rawInput) return ''
  const trimmed = rawInput.trim()

  // Match YYYY-MM-DDTHH:MM(:SS)?
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
    const clean = trimmed.split('+')[0].split('Z')[0]
    return clean.length === 16 ? `${clean}:00` : clean
  }

  // Match YYYY-MM-DD HH:MM(:SS)?
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
    const parts = trimmed.split(/\s+/)
    const time = parts[1].length === 5 ? `${parts[1]}:00` : parts[1]
    return `${parts[0]}T${time}`
  }

  // Parse standard Date
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = parsed.getFullYear()
    const m = pad(parsed.getMonth() + 1)
    const d = pad(parsed.getDate())
    const h = pad(parsed.getHours())
    const min = pad(parsed.getMinutes())
    const s = pad(parsed.getSeconds())
    return `${y}-${m}-${d}T${h}:${min}:${s}`
  }

  return trimmed
}

/**
 * 4. Google Calendar Tool (Composio)
 */
export const googleCalendarTool: AgentToolDefinition = {
  name: 'googlecalendar',
  description:
    'Akses Google Calendar untuk membuat agenda/event baru, memeriksa jadwal meeting mendatang, atau mencari event. Mendukung pembuatan Google Meet otomatis.',
  parameters: z.object({
    action: z
      .enum(['list_events', 'create_event', 'find_event'])
      .describe('Aksi kalender: create_event untuk membuat agenda baru, list_events untuk melihat agenda mendatang, find_event untuk mencari agenda.'),
    summary: z.string().optional().describe('Judul atau nama agenda acara'),
    start_datetime: z
      .string()
      .optional()
      .describe('Waktu mulai acara dalam format ISO YYYY-MM-DDTHH:MM:SS (contoh: "2026-10-26T14:00:00")'),
    startTime: z.string().optional().describe('Alias untuk start_datetime'),
    start_time: z.string().optional().describe('Alias untuk start_datetime'),
    endTime: z.string().optional().describe('Waktu selesai acara (format ISO YYYY-MM-DDTHH:MM:SS)'),
    end_time: z.string().optional().describe('Alias untuk endTime'),
    event_duration_hour: z.number().optional().describe('Durasi acara dalam jam (default: 1)'),
    event_duration_minutes: z.number().optional().describe('Durasi acara dalam menit (default: 0)'),
    timezone: z.string().optional().describe('Zona waktu acara (default: "Asia/Jakarta")'),
    description: z.string().optional().describe('Deskripsi atau agenda acara'),
    location: z.string().optional().describe('Lokasi acara atau link meeting'),
    attendees: z.array(z.string()).optional().describe('Daftar email peserta acara'),
  }),
  requireApproval: false,
  execute: async (
    {
      action,
      summary,
      start_datetime,
      startTime,
      start_time,
      endTime,
      end_time,
      event_duration_hour,
      event_duration_minutes,
      timezone,
      description,
      location,
      attendees,
    },
    context
  ) => {
    if (action === 'create_event') {
      const rawStart = start_datetime || startTime || start_time
      const startFormatted = normalizeCalendarDateTime(rawStart)

      if (!startFormatted) {
        return {
          status: 'failed',
          toolkit: 'googlecalendar',
          action: 'create_event',
          error:
            'Parameter start_datetime wajib diisi dengan format ISO YYYY-MM-DDTHH:MM:SS (contoh: "2026-10-26T14:00:00"). Harap sertakan tanggal dan jam yang jelas.',
        }
      }

      let durationHour = event_duration_hour ?? 1
      let durationMinutes = event_duration_minutes ?? 0

      const rawEnd = endTime || end_time
      if (rawEnd) {
        const endFormatted = normalizeCalendarDateTime(rawEnd)
        const startMs = new Date(startFormatted).getTime()
        const endMs = new Date(endFormatted).getTime()
        if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
          const diffMinutes = Math.round((endMs - startMs) / 60000)
          durationHour = Math.floor(diffMinutes / 60)
          durationMinutes = diffMinutes % 60
        }
      }

      const payload: any = {
        summary: summary || 'Agenda Baru',
        start_datetime: startFormatted,
        timezone: timezone || 'Asia/Jakarta',
        event_duration_hour: durationHour,
        event_duration_minutes: durationMinutes,
        create_meeting_room: true,
      }

      if (description) payload.description = description
      if (location) payload.location = location
      if (attendees && Array.isArray(attendees) && attendees.length > 0) {
        payload.attendees = attendees
      }

      return executeComposioAction('googlecalendar', 'GOOGLECALENDAR_CREATE_EVENT', payload, context)
    }

    if (action === 'find_event') {
      return executeComposioAction(
        'googlecalendar',
        'GOOGLECALENDAR_FIND_EVENT',
        summary ? { query: summary } : {},
        context
      )
    }

    return executeComposioAction('googlecalendar', 'GOOGLECALENDAR_EVENTS_LIST', {}, context)
  },
}

/**
 * 5. Google Docs Tool (Composio)
 */
export const googleDocsTool: AgentToolDefinition = {
  name: 'googledocs',
  description: 'Buat dokumen baru atau perbarui konten berkas di Google Docs.',
  parameters: z.object({
    title: z.string().describe('Judul berkas Google Docs baru'),
    content: z.string().optional().describe('Isi konten teks yang ditulis pada dokumen'),
  }),
  requireApproval: false,
  execute: async ({ title, content }, context) => {
    return executeComposioAction(
      'googledocs',
      'GOOGLEDOCS_CREATE_DOCUMENT',
      { title, text: content || '' },
      context
    )
  },
}

/**
 * 6. Notion Tool (Composio)
 */
export const notionTool: AgentToolDefinition = {
  name: 'notion',
  description: 'Cari catatan atau baca halaman di workspace Notion pengguna.',
  parameters: z.object({
    action: z
      .enum(['search', 'retrieve_page'])
      .describe('Aksi Notion: "search" untuk mencari catatan/halaman, "retrieve_page" untuk membaca detail halaman.'),
    query: z.string().optional().describe('Kata kunci pencarian judul halaman atau database Notion'),
    title: z.string().optional().describe('Alias untuk query pencarian'),
    page_id: z.string().optional().describe('UUID ID halaman Notion jika mengambil detail halaman spesifik'),
  }),
  requireApproval: false,
  execute: async ({ action, query, title, page_id }, context) => {
    if (action === 'retrieve_page' && (page_id || title)) {
      const cleanId = (page_id || title || '').trim()
      return executeComposioAction('notion', 'NOTION_RETRIEVE_PAGE', { page_id: cleanId }, context)
    }

    const cleanQuery = (query || title || '').trim()
    return executeComposioAction(
      'notion',
      'NOTION_SEARCH_NOTION_PAGE',
      { query: cleanQuery, page_size: 25 },
      context
    )
  },
}

/**
 * 7. Composio Manage Connections Tool
 * Directly triggers or inspects OAuth connection for any app toolkit
 */
export const composioManageConnectionsTool: AgentToolDefinition = {
  name: 'composio_manage_connections',
  description:
    'Hubungkan akun baru atau periksa status otorisasi aplikasi eksternal (seperti Gmail, Slack, GitHub, Google Calendar, Notion, dsb). Menghasilkan link otorisasi OAuth resmi jika belum terhubung.',
  parameters: z.object({
    toolkit: z.string().describe('Nama slug aplikasi, contoh: "gmail", "slack", "github", "notion"'),
  }),
  requireApproval: false,
  execute: async ({ toolkit }, context) => {
    const session = context.composioSession
    if (!session) {
      return { status: 'error', error: 'Composio session tidak aktif.' }
    }
    try {
      const auth = await session.authorize(toolkit.toLowerCase())
      return {
        status: 'connection_link_generated',
        toolkit,
        connectLink: auth.redirectUrl,
        connectionId: auth.id,
        message: `Silakan hubungkan akun ${toolkit.toUpperCase()} Anda melalui tautan otorisasi berikut:`,
      }
    } catch (err: any) {
      return { status: 'error', error: err.message }
    }
  },
}

export const COMPOSIO_APP_TOOLS: AgentToolDefinition[] = [
  gmailTool,
  slackTool,
  gitHubTool,
  googleCalendarTool,
  googleDocsTool,
  notionTool,
  composioManageConnectionsTool,
]
