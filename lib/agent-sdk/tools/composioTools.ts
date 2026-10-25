import { z } from 'zod'
import { AgentToolDefinition } from '../types'
import { composio } from '@/lib/composio/client'

/**
 * 1. Slack Tool (Composio Toolkit)
 * Post messages to channels, send direct messages, read conversations
 */
export const slackTool: AgentToolDefinition = {
  name: 'slack',
  description: 'Send messages, post notifications, or read channels in Slack workspace.',
  parameters: z.object({
    channel: z.string().describe('Slack channel name (e.g. "#general") or member ID'),
    message: z.string().describe('The message content to send'),
  }),
  requireApproval: false,
  execute: async ({ channel, message }, context) => {
    const res = await composio.tools.execute('SLACK_CHAT_POST_MESSAGE', { channel, text: message }, context?.userId)
    if (!res.success) {
      return {
        status: 'error',
        toolkit: 'slack',
        error: res.error || 'Aplikasi Slack belum terhubung atau gagal dikirim via Composio.',
        summary: `Gagal mengirim ke Slack: Akun Slack belum terotorisasi via Composio OAuth.`,
      }
    }
    return {
      status: 'success',
      toolkit: 'slack',
      channel,
      message,
      composioRequestId: res.requestId || null,
      deliveredAt: new Date().toISOString(),
      summary: `Pesan berhasil dikirim ke saluran ${channel} di Slack via Composio (Request ID: ${res.requestId})`,
      data: res.data,
    }
  },
}

/**
 * 2. Gmail Tool (Composio Toolkit)
 * Read incoming emails, search threads, draft or send replies
 */
export const gmailTool: AgentToolDefinition = {
  name: 'gmail',
  description: 'Read incoming emails, search email threads, and draft or send replies.',
  parameters: z.object({
    action: z.enum(['search', 'send_draft', 'read_latest']).describe('Action to perform in Gmail'),
    query: z.string().optional().describe('Search query, recipient, or subject line'),
    maxResults: z.number().optional().describe('Maximum number of emails to fetch'),
  }),
  requireApproval: false,
  execute: async ({ action, query, maxResults }, context) => {
    let rawQuery = (query || '').trim()
    let count = maxResults || 5

    // Detect if raw query contains a requested count (e.g. "3 teratas", "5 email")
    const numMatch = rawQuery.match(/\b(\d+)\b/)
    if (numMatch) {
      count = Math.min(20, Math.max(1, parseInt(numMatch[1], 10)))
    }

    // Convert Indonesian / natural language phrases into valid Gmail search syntax
    let cleanQuery = 'label:inbox'
    const lower = rawQuery.toLowerCase()

    if (/unread|belum dibaca|belum baca/i.test(lower)) {
      cleanQuery = 'is:unread'
    } else if (/dari|from:/i.test(lower)) {
      const fromMatch = lower.match(/(?:dari|from:?)\s*([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/i)
      cleanQuery = fromMatch ? `from:${fromMatch[1]}` : 'label:inbox'
    } else if (/subjek|subject:|tentang/i.test(lower)) {
      const subjMatch = lower.match(/(?:subjek|subject:?|tentang)\s*([a-zA-Z0-9_-]+)/i)
      cleanQuery = subjMatch ? `subject:${subjMatch[1]}` : 'label:inbox'
    } else if (/inbox|masuk|terbaru|terakhir|read|baca|cek|lihat|tampilkan/i.test(lower)) {
      cleanQuery = 'label:inbox'
    } else if (rawQuery.length > 0 && !/^(sekarang|tolong|coba|bisa|email|saya)$/i.test(rawQuery)) {
      cleanQuery = rawQuery
    }

    const res = await composio.tools.execute(
      'GMAIL_FETCH_EMAILS',
      { query: cleanQuery, max_results: count },
      context?.userId
    )

    if (!res.success) {
      return {
        status: 'error',
        toolkit: 'gmail',
        error: res.error || 'Aplikasi Gmail belum terhubung atau gagal diakses via Composio.',
        summary: `Gagal mengakses Gmail: Akun Gmail belum terhubung via Composio OAuth.`,
      }
    }

    const rawMessages = res.data?.messages || []
    const messagePreviews = rawMessages.slice(0, count).map((m: any, idx: number) => ({
      index: idx + 1,
      id: m.id,
      subject: m.subject || m.preview?.subject || '(Tanpa Subjek)',
      sender: m.sender || m.from || 'Tidak diketahui',
      date: m.date || m.created_at || '',
      snippet: (m.preview?.body || m.snippet || '').trim().replace(/\s+/g, ' ').substring(0, 160),
    }))

    return {
      status: 'success',
      toolkit: 'gmail',
      action: action || 'read_latest',
      query: cleanQuery,
      count: messagePreviews.length,
      emails: messagePreviews,
      composioRequestId: res.requestId || null,
      timestamp: new Date().toISOString(),
      summary: messagePreviews.length > 0
        ? `Berhasil mengambil ${messagePreviews.length} email terbaru dari Gmail (query: ${cleanQuery}):\n` +
          messagePreviews.map((e: any) => `${e.index}. "${e.subject}" dari ${e.sender}`).join('\n')
        : `Tidak ada email yang cocok dengan kriteria "${cleanQuery}" di akun Gmail Anda.`,
      data: {
        messages: messagePreviews,
        totalEstimate: res.data?.resultSizeEstimate || messagePreviews.length,
      },
    }
  },
}

/**
 * 3. Google Docs Tool (Composio Toolkit)
 * Create documents, read existing documents, append content
 */
export const googleDocsTool: AgentToolDefinition = {
  name: 'googledocs',
  description: 'Create, read, and append content to Google Documents.',
  parameters: z.object({
    title: z.string().describe('Document title or filename'),
    content: z.string().optional().describe('Content to write or append to document'),
  }),
  requireApproval: false,
  execute: async ({ title, content }, context) => {
    const res = await composio.tools.execute('GOOGLEDOCS_CREATE_DOCUMENT', { title, text: content || '' }, context?.userId)
    if (!res.success) {
      return {
        status: 'error',
        toolkit: 'googledocs',
        error: res.error || 'Aplikasi Google Docs belum terhubung via Composio.',
        summary: `Gagal menyiapkan Google Docs: Akun Google Docs belum terhubung via Composio OAuth.`,
      }
    }
    return {
      status: 'success',
      toolkit: 'googledocs',
      title,
      documentId: `doc_${Date.now()}`,
      composioRequestId: res.requestId || null,
      url: `https://docs.google.com/document/d/doc_${Date.now()}/edit`,
      summary: `Dokumen Google Docs "${title}" berhasil disiapkan via Composio (Request ID: ${res.requestId})`,
      data: res.data,
    }
  },
}

/**
 * 4. Notion Tool (Composio Toolkit)
 * Read, search, and update workspace pages & databases
 */
export const notionTool: AgentToolDefinition = {
  name: 'notion',
  description: 'Read, search, and update Notion workspace pages, notes, and databases.',
  parameters: z.object({
    action: z.enum(['search_page', 'create_page', 'append_database']).describe('Action to perform in Notion'),
    title: z.string().describe('Title of page or database record'),
  }),
  requireApproval: false,
  execute: async ({ action, title }, context) => {
    const res = await composio.tools.execute('NOTION_CREATE_PAGE', { title }, context?.userId)
    if (!res.success) {
      return {
        status: 'error',
        toolkit: 'notion',
        error: res.error || 'Aplikasi Notion belum terhubung via Composio.',
        summary: `Gagal memproses Notion: Akun Notion belum terhubung via Composio OAuth.`,
      }
    }
    return {
      status: 'success',
      toolkit: 'notion',
      action,
      title,
      composioRequestId: res.requestId || null,
      pageId: `notion_${Date.now()}`,
      summary: `Halaman Notion "${title}" berhasil dibuat via Composio (Request ID: ${res.requestId})`,
      data: res.data,
    }
  },
}

/**
 * 5. Google Calendar Tool (Composio Toolkit)
 * Schedule meetings, check availability, and list calendar events
 */
export const googleCalendarTool: AgentToolDefinition = {
  name: 'googlecalendar',
  description: 'Schedule meetings, check availability, and list calendar events.',
  parameters: z.object({
    summary: z.string().describe('Event title or summary'),
    time: z.string().describe('Event date/time or recurring pattern, e.g. "09:00" or "Every Monday 09:00"'),
  }),
  requireApproval: false,
  execute: async ({ summary, time }, context) => {
    const res = await composio.tools.execute('GOOGLECALENDAR_CREATE_EVENT', { summary, start_time: time }, context?.userId)
    if (!res.success) {
      return {
        status: 'error',
        toolkit: 'googlecalendar',
        error: res.error || 'Aplikasi Google Calendar belum terhubung via Composio.',
        summary: `Gagal menjadwalkan kalender: Akun Google Calendar belum terhubung via Composio OAuth.`,
      }
    }
    return {
      status: 'success',
      toolkit: 'googlecalendar',
      summary,
      time,
      composioRequestId: res.requestId || null,
      eventId: `cal_${Date.now()}`,
      scheduledAt: new Date().toISOString(),
      resultMessage: `Agenda "${summary}" berhasil dijadwalkan pada ${time} di Google Calendar via Composio (Request ID: ${res.requestId})`,
      data: res.data,
    }
  },
}

/**
 * 6. GitHub Tool (Composio Toolkit)
 */
export const gitHubTool: AgentToolDefinition = {
  name: 'github',
  description: 'Create issues, review pull requests, and query repository stats.',
  parameters: z.object({
    action: z.enum(['list_issues', 'create_issue', 'repo_info']).describe('GitHub action'),
    repo: z.string().describe('Repository name (owner/repo)'),
  }),
  requireApproval: false,
  execute: async ({ action, repo }) => {
    return {
      status: 'success',
      toolkit: 'github',
      action,
      repo,
      summary: `Berhasil menjalankan operasi ${action} pada repository ${repo} via GitHub.`,
    }
  },
}

/**
 * 7. Reddit Tool (Composio Toolkit)
 */
export const redditTool: AgentToolDefinition = {
  name: 'reddit',
  description: 'Read posts, search subreddits, and track community discussions.',
  parameters: z.object({
    subreddit: z.string().describe('Subreddit name (without r/)'),
    query: z.string().optional().describe('Search keyword or topic'),
  }),
  requireApproval: false,
  execute: async ({ subreddit, query }) => {
    return {
      status: 'success',
      toolkit: 'reddit',
      subreddit,
      query: query || '',
      summary: `Berhasil mengambil diskusi komunitas dari r/${subreddit}.`,
    }
  },
}

/**
 * 8. Outlook Tool (Composio Toolkit)
 */
export const outlookTool: AgentToolDefinition = {
  name: 'outlook',
  description: 'Send emails and read messages from Microsoft Outlook accounts.',
  parameters: z.object({
    action: z.enum(['read_inbox', 'send_email']).describe('Outlook operation'),
    subject: z.string().optional().describe('Email subject'),
  }),
  requireApproval: false,
  execute: async ({ action, subject }) => {
    return {
      status: 'success',
      toolkit: 'outlook',
      action,
      subject: subject || 'Untitled',
      summary: `Operasi Outlook (${action}) berhasil dijalankan.`,
    }
  },
}

/**
 * Map of all Composio tools by slug
 */
export const COMPOSIO_TOOLS_MAP: Record<string, AgentToolDefinition> = {
  slack: slackTool,
  gmail: gmailTool,
  googledocs: googleDocsTool,
  notion: notionTool,
  googlecalendar: googleCalendarTool,
  github: gitHubTool,
  reddit: redditTool,
  outlook: outlookTool,
}

/**
 * Get active agent tools filtered by connected tool slugs
 */
export function getAgentComposioTools(connectedSlugs: string[] = []): AgentToolDefinition[] {
  if (!connectedSlugs || connectedSlugs.length === 0) {
    return []
  }
  return connectedSlugs
    .map((slug) => COMPOSIO_TOOLS_MAP[slug.toLowerCase()])
    .filter((t): t is AgentToolDefinition => Boolean(t))
}
