import { z } from 'zod'
import { AgentToolDefinition } from '../types'
import { composio } from '@/lib/composio/client'

/**
 * 1. Slack Tool (Real Composio Toolkit)
 */
export const slackTool: AgentToolDefinition = {
  name: 'slack',
  description: 'Send messages, post notifications, or read channels in Slack workspace.',
  parameters: z.object({
    channel: z.string().describe('Slack channel name (e.g. "#general" or "C01234567")'),
    message: z.string().describe('The message content to post'),
  }),
  requireApproval: false,
  execute: async ({ channel, message }, context) => {
    const userUuid = context.userId || 'default_user'
    const result = await composio.executeAction('SLACK_CHAT_POST_MESSAGE', {
      userUuid,
      data: {
        channel,
        text: message,
      },
    })

    if (!result.successful) {
      return {
        status: 'error',
        toolkit: 'slack',
        channel,
        error: result.error,
        connectionUrl: result.connectionUrl,
        summary: `Gagal mengirim ke Slack (${channel}): ${result.error}. ${
          result.connectionUrl ? `Silakan hubungkan akun Slack Anda di: ${result.connectionUrl}` : ''
        }`,
      }
    }

    return {
      status: 'success',
      toolkit: 'slack',
      channel,
      message,
      data: result.data,
      summary: `Pesan berhasil dikirimkan ke saluran ${channel} di Slack: "${message}"`,
    }
  },
}

/**
 * 2. Gmail Tool (Real Composio Toolkit)
 */
export const gmailTool: AgentToolDefinition = {
  name: 'gmail',
  description: 'Send emails, draft replies, or search emails via Gmail.',
  parameters: z.object({
    recipient: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content in plain text or HTML'),
  }),
  requireApproval: true, // Sending emails is sensitive -> Requires Human Approval
  execute: async ({ recipient, subject, body }, context) => {
    const userUuid = context.userId || 'default_user'
    const result = await composio.executeAction('GMAIL_SEND_EMAIL', {
      userUuid,
      data: {
        recipient_email: recipient,
        subject,
        body,
      },
    })

    if (!result.successful) {
      return {
        status: 'error',
        toolkit: 'gmail',
        recipient,
        error: result.error,
        connectionUrl: result.connectionUrl,
        summary: `Gagal mengirim email via Gmail ke ${recipient}: ${result.error}`,
      }
    }

    return {
      status: 'success',
      toolkit: 'gmail',
      recipient,
      subject,
      data: result.data,
      summary: `Email berhasil dikirim via Gmail ke ${recipient} dengan subjek "${subject}".`,
    }
  },
}

/**
 * 3. Google Calendar Tool (Real Composio Toolkit)
 */
export const googleCalendarTool: AgentToolDefinition = {
  name: 'googlecalendar',
  description: 'Create events or schedule meetings in Google Calendar.',
  parameters: z.object({
    summary: z.string().describe('Event title or meeting name'),
    description: z.string().optional().describe('Description or agenda of the meeting'),
    startDatetime: z.string().describe('Start date and time in ISO format or descriptive (e.g. 2026-10-23T09:00:00)'),
    durationMinutes: z.number().optional().describe('Duration in minutes, default 30'),
  }),
  requireApproval: false,
  execute: async ({ summary, description, startDatetime, durationMinutes = 30 }, context) => {
    const userUuid = context.userId || 'default_user'
    const result = await composio.executeAction('GOOGLECALENDAR_CREATE_EVENT', {
      userUuid,
      data: {
        summary,
        description: description || '',
        start_datetime: startDatetime,
        duration: durationMinutes,
      },
    })

    if (!result.successful) {
      return {
        status: 'error',
        toolkit: 'googlecalendar',
        error: result.error,
        connectionUrl: result.connectionUrl,
        summary: `Gagal membuat agenda di Google Calendar: ${result.error}`,
      }
    }

    return {
      status: 'success',
      toolkit: 'googlecalendar',
      summary,
      time: startDatetime,
      data: result.data,
      summaryText: `Agenda "${summary}" berhasil dijadwalkan di Google Calendar pada ${startDatetime}.`,
    }
  },
}

/**
 * 4. Google Docs Tool (Real Composio Toolkit)
 */
export const googleDocsTool: AgentToolDefinition = {
  name: 'googledocs',
  description: 'Create a new Google Document with specified title and content.',
  parameters: z.object({
    title: z.string().describe('Document title'),
    content: z.string().optional().describe('Initial text content of the document'),
  }),
  requireApproval: false,
  execute: async ({ title, content }, context) => {
    const userUuid = context.userId || 'default_user'
    const result = await composio.executeAction('GOOGLEDOCS_CREATE_DOCUMENT', {
      userUuid,
      data: {
        title,
        text: content || '',
      },
    })

    if (!result.successful) {
      return {
        status: 'error',
        toolkit: 'googledocs',
        title,
        error: result.error,
        summary: `Gagal membuat Google Docs "${title}": ${result.error}`,
      }
    }

    return {
      status: 'success',
      toolkit: 'googledocs',
      title,
      data: result.data,
      summary: `Dokumen Google Docs "${title}" berhasil dibuat dan disimpan.`,
    }
  },
}

/**
 * 5. Notion Tool (Real Composio Toolkit)
 */
export const notionTool: AgentToolDefinition = {
  name: 'notion',
  description: 'Create or append a page to Notion workspace.',
  parameters: z.object({
    title: z.string().describe('Title of the Notion page'),
    content: z.string().optional().describe('Text body of the page'),
  }),
  requireApproval: false,
  execute: async ({ title, content }, context) => {
    const userUuid = context.userId || 'default_user'
    const result = await composio.executeAction('NOTION_CREATE_NOTION_PAGE', {
      userUuid,
      data: {
        title,
        content: content || '',
      },
    })

    if (!result.successful) {
      return {
        status: 'error',
        toolkit: 'notion',
        title,
        error: result.error,
        summary: `Gagal memproses Notion "${title}": ${result.error}`,
      }
    }

    return {
      status: 'success',
      toolkit: 'notion',
      title,
      data: result.data,
      summary: `Halaman Notion "${title}" berhasil dibuat via Composio.`,
    }
  },
}

/**
 * 6. GitHub Tool (Real Composio Toolkit)
 */
export const gitHubTool: AgentToolDefinition = {
  name: 'github',
  description: 'Create an issue in a GitHub repository.',
  parameters: z.object({
    owner: z.string().describe('GitHub repository owner or organization'),
    repo: z.string().describe('GitHub repository name'),
    title: z.string().describe('Issue title'),
    body: z.string().optional().describe('Issue description body'),
  }),
  requireApproval: false,
  execute: async ({ owner, repo, title, body }, context) => {
    const userUuid = context.userId || 'default_user'
    const result = await composio.executeAction('GITHUB_CREATE_AN_ISSUE', {
      userUuid,
      data: {
        owner,
        repo,
        title,
        body: body || '',
      },
    })

    if (!result.successful) {
      return {
        status: 'error',
        toolkit: 'github',
        error: result.error,
        summary: `Gagal membuat issue di ${owner}/${repo}: ${result.error}`,
      }
    }

    return {
      status: 'success',
      toolkit: 'github',
      owner,
      repo,
      title,
      data: result.data,
      summary: `Issue "${title}" berhasil dipublikasikan di repositori ${owner}/${repo}.`,
    }
  },
}

export const COMPOSIO_TOOLS_MAP: Record<string, AgentToolDefinition> = {
  slack: slackTool,
  gmail: gmailTool,
  googlecalendar: googleCalendarTool,
  googledocs: googleDocsTool,
  notion: notionTool,
  github: gitHubTool,
}

export function getAgentComposioTools(connectedSlugs: string[] = []): AgentToolDefinition[] {
  if (!connectedSlugs || connectedSlugs.length === 0) {
    return Object.values(COMPOSIO_TOOLS_MAP)
  }
  return connectedSlugs
    .map((slug) => COMPOSIO_TOOLS_MAP[slug.toLowerCase()])
    .filter((t): t is AgentToolDefinition => Boolean(t))
}
