/**
 * Live Composio REST API Client
 * Real integration with Composio Platform (https://backend.composio.dev/api/v1)
 */

export interface ComposioConnectedAccount {
  id: string
  userUuid?: string
  appName: string
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'INITIATED' | 'FAILED'
  authConfig?: Record<string, any>
  createdAt?: string
}

export interface ComposioInitiateResult {
  connectionUrl?: string
  connectedAccountId?: string
  status: string
  message?: string
}

export interface ComposioActionResult {
  successful: boolean
  data?: any
  error?: string
  connectionUrl?: string
}

export class ComposioClient {
  private apiKey: string
  private baseUrl: string = 'https://backend.composio.dev/api/v1'

  constructor(apiKey?: string) {
    this.apiKey = (apiKey || process.env.COMPOSIO_API_KEY || '').trim()
  }

  private get headers(): HeadersInit {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 10 && !this.apiKey.includes('demo'))
  }

  /**
   * List connected accounts for a specific user UUID
   */
  async listConnectedAccounts(userUuid: string, appNames?: string[]): Promise<ComposioConnectedAccount[]> {
    if (!this.isConfigured) {
      return []
    }

    try {
      const query = new URLSearchParams()
      if (userUuid) query.set('user_uuid', userUuid)

      const res = await fetch(`${this.baseUrl}/connectedAccounts?${query.toString()}`, {
        method: 'GET',
        headers: this.headers,
      })

      if (!res.ok) {
        console.warn(`[Composio] listConnectedAccounts failed (${res.status}):`, await res.text())
        return []
      }

      const data = await res.json()
      const items = (data.items || data.connectedAccounts || data || []) as any[]

      const parsed: ComposioConnectedAccount[] = items.map((it) => ({
        id: it.id || it.connectedAccountId,
        userUuid: it.userUuid || userUuid,
        appName: (it.appName || it.appUniqueId || it.toolkit?.slug || '').toLowerCase(),
        status: it.status || 'ACTIVE',
        createdAt: it.createdAt,
      }))

      if (appNames && appNames.length > 0) {
        const lowerApps = appNames.map((a) => a.toLowerCase())
        return parsed.filter((it) => lowerApps.includes(it.appName))
      }

      return parsed
    } catch (err) {
      console.error('[Composio] listConnectedAccounts network error:', err)
      return []
    }
  }

  /**
   * Initiate an OAuth connection link for an app (e.g. slack, gmail, googlecalendar)
   */
  async initiateConnection(appName: string, userUuid: string, redirectUrl?: string): Promise<ComposioInitiateResult> {
    if (!this.isConfigured) {
      return {
        status: 'unconfigured',
        message: 'COMPOSIO_API_KEY belum dikonfigurasi di .env.local',
      }
    }

    try {
      const payload: any = {
        appName: appName.toLowerCase(),
        userUuid,
      }
      if (redirectUrl) payload.redirectUrl = redirectUrl

      const res = await fetch(`${this.baseUrl}/connectedAccounts`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errText = await res.text()
        return {
          status: 'error',
          message: `Composio initiate failed (${res.status}): ${errText}`,
        }
      }

      const data = await res.json()
      return {
        connectionUrl: data.connectionUrl || data.redirectUrl || data.url,
        connectedAccountId: data.connectedAccountId || data.id,
        status: data.status || 'INITIATED',
      }
    } catch (err: any) {
      return {
        status: 'error',
        message: err.message || 'Gagal memulai koneksi Composio',
      }
    }
  }

  /**
   * Execute a real action on Composio
   */
  async executeAction(
    actionName: string,
    params: {
      userUuid: string
      data: Record<string, any>
      connectedAccountId?: string
    }
  ): Promise<ComposioActionResult> {
    if (!this.isConfigured) {
      return {
        successful: false,
        error: 'COMPOSIO_API_KEY belum diisi di .env.local. Dapatkan key di https://app.composio.dev',
      }
    }

    try {
      const endpoint = `${this.baseUrl}/actions/${actionName.toUpperCase()}/execute`
      const payload: any = {
        data: params.data,
      }
      if (params.connectedAccountId) payload.connectedAccountId = params.connectedAccountId
      if (params.userUuid) payload.userUuid = params.userUuid

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      })

      const resText = await res.text()
      let resJson: any = {}
      try {
        resJson = JSON.parse(resText)
      } catch {
        resJson = { text: resText }
      }

      if (!res.ok) {
        // If account not connected, try to extract connectionUrl if provided
        const connectionUrl = resJson?.connectionUrl || resJson?.redirectUrl
        return {
          successful: false,
          error: resJson?.message || resJson?.error || `Gagal menjalankan aksi ${actionName} (${res.status})`,
          connectionUrl,
        }
      }

      return {
        successful: resJson.successful !== false,
        data: resJson.data || resJson.response_data || resJson,
      }
    } catch (err: any) {
      return {
        successful: false,
        error: err.message || `Network error executing ${actionName}`,
      }
    }
  }
}

export const composio = new ComposioClient()

export const buildAgentInstructions = (agentName: string, customInstructions?: string) => {
  return `
You are ${agentName}, an intelligent autonomous AI Agent.
${customInstructions || 'You assist users in executing tasks, managing tools, and handling automated workflows.'}

Guidelines for Tool Execution:
- When the user asks you to perform an action (e.g. send an email, post to Slack, create a calendar event, query data), use your tools.
- Never fake tool execution. Return the exact outcome.
- If a tool requires authentication or is not connected yet, politely report the status and guide the user.
- If an action modifies or deletes sensitive resources, verify or yield for approval.
- Be concise, direct, and helpful.
`.trim()
}
