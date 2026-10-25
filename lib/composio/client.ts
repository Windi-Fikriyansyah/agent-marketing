/**
 * Composio Official SDK Integration Module (v3.1 Sessions API)
 * Uses official @composio/core package as required by AGENTS.md §3.4
 */
import { Composio } from '@composio/core'

function getApiKey(): string {
  const key = process.env.COMPOSIO_API_KEY || ''
  if (!key || key.trim().length === 0) {
    throw new Error('COMPOSIO_API_KEY belum dikonfigurasi di file environment (.env.local).')
  }
  return key.trim()
}

export class ComposioService {
  private instance: Composio | null = null

  public getClient(): Composio {
    if (!this.instance) {
      const apiKey = getApiKey()
      this.instance = new Composio({ apiKey })
    }
    return this.instance
  }

  /**
   * Resolves the canonical user ID from Composio active connected accounts.
   * Handles user UUID, user email (e.g. diwin6634@gmail.com), or 'default_user' fallbacks.
   */
  async resolveCanonicalUserId(inputUserId?: string | null): Promise<string> {
    const rawId = (inputUserId || '').trim()
    try {
      const comp = this.getClient()
      const activeList = await (comp as any).client.connectedAccounts.list({ statuses: ['ACTIVE'] })
      const items: any[] = activeList.items || []

      if (items.length > 0) {
        // 1. Exact match with account user_id
        if (rawId) {
          const exactMatch = items.find((i) => i.user_id === rawId)
          if (exactMatch) return rawId

          // 2. Match with email in displayName
          const emailMatch = items.find(
            (i) =>
              i.data?.displayName?.toLowerCase() === rawId.toLowerCase() ||
              i.state?.val?.displayName?.toLowerCase() === rawId.toLowerCase()
          )
          if (emailMatch && emailMatch.user_id) {
            return emailMatch.user_id
          }
        }

        // 3. Fallback when rawId is default_user, user_default, or empty
        if (!rawId || rawId === 'default_user' || rawId === 'user_default') {
          const firstWithUser = items.find((i) => Boolean(i.user_id))
          if (firstWithUser?.user_id) {
            return firstWithUser.user_id
          }
        }
      }
    } catch (err: any) {
      console.warn('[ComposioService] Could not resolve canonical user ID:', err.message)
    }

    return rawId || 'default_user'
  }

  /**
   * Get an existing session or create a new session scoped to the user.
   * Session ID is saved and reused according to AGENTS.md §3.4 rule 3.
   * Automatically validates that restored sessions are alive and have access to user's connected accounts.
   */
  async getOrCreateSession(userId: string, existingSessionId?: string | null): Promise<any> {
    const comp = this.getClient()
    const canonicalUserId = await this.resolveCanonicalUserId(userId)

    const cleanId = (existingSessionId || '').trim()
    if (cleanId.length > 0 && cleanId.startsWith('trs_')) {
      try {
        const session = await comp.sessions.use(cleanId)
        if (session && session.sessionId) {
          // Check if restored session is active and has toolkits
          const toolkitsRes = await session.toolkits()
          const hasActiveConnections = (toolkitsRes.items || []).some((t: any) => Boolean(t.connection?.isActive))
          
          // If session has active connections, or if user has no connections anywhere, reuse it
          if (hasActiveConnections) {
            return session
          }

          // If restored session has 0 connections, verify if a fresh session for canonical user has connections
          const freshCandidate = await comp.create(canonicalUserId)
          const freshCandidateToolkits = await freshCandidate.toolkits()
          const freshHasConnections = (freshCandidateToolkits.items || []).some((t: any) => Boolean(t.connection?.isActive))
          if (freshHasConnections) {
            console.log(`[ComposioService] Replaced stale session ${cleanId} with active session ${freshCandidate.sessionId} for user ${canonicalUserId}`)
            return freshCandidate
          }

          return session
        }
      } catch (err: any) {
        console.warn(`Could not restore session ${cleanId}, creating a fresh one:`, err.message)
      }
    }

    // Create a new session for this canonical user
    const newSession = await comp.create(canonicalUserId)
    return newSession
  }

  /**
   * Generate a real Connect Link (OAuth) for an external toolkit using the session
   */
  async createConnectLink(
    session: any,
    toolkitSlug: string,
    callbackUrl?: string
  ): Promise<{
    success: boolean
    redirectUrl?: string
    connectionId?: string
    status?: string
    error?: string
  }> {
    try {
      const authRes = await session.authorize(toolkitSlug.toLowerCase(), {
        callbackUrl,
      })

      return {
        success: true,
        redirectUrl: authRes.redirectUrl,
        connectionId: authRes.id,
        status: authRes.status,
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `Gagal membuat Connect Link untuk ${toolkitSlug}`,
      }
    }
  }

  /**
   * List toolkits and their active connection status for the session
   */
  async getSessionToolkits(session: any, filterConnected?: boolean): Promise<any[]> {
    try {
      const res = await session.toolkits(filterConnected ? { isConnected: true } : undefined)
      return res.items || []
    } catch (err) {
      console.warn('Error fetching toolkits from session:', err)
      return []
    }
  }

  /**
   * Execute a tool inside the session router
   */
  async executeTool(
    session: any,
    toolSlug: string,
    args: Record<string, unknown> = {}
  ): Promise<{
    success: boolean
    resultType: 'completed' | 'failed' | 'blocked'
    data: any
    error: string | null
    logId?: string
  }> {
    try {
      const res = await session.execute(toolSlug, args)
      const isCompleted = res.resultType === 'completed'
      return {
        success: isCompleted,
        resultType: res.resultType,
        data: res.data,
        error: res.error || (isCompleted ? null : 'Tool execution failed'),
        logId: res.logId,
      }
    } catch (err: any) {
      return {
        success: false,
        resultType: 'failed',
        data: null,
        error: err.message || 'Execution error',
      }
    }
  }
}

export const composioService = new ComposioService()

// Legacy compatibility helper for routes expecting `composio` object
export const composio = {
  get sessions() {
    return {
      create: async (params: { userId: string; toolkits?: string[] }) => {
        const s = await composioService.getOrCreateSession(params.userId)
        return {
          sessionId: s.sessionId,
          userId: params.userId,
          toolkits: params.toolkits || [],
        }
      },
    }
  },
  get connectedAccounts() {
    return {
      list: async (params: { userIds?: string[]; statuses?: string[] }) => {
        try {
          const userId = params.userIds?.[0] || 'default_user'
          const s = await composioService.getOrCreateSession(userId)
          const items = await composioService.getSessionToolkits(s, params.statuses?.includes('ACTIVE'))
          return {
            items: items.map((i: any) => ({
              id: i.connection?.connectedAccount?.id || `ca_${i.slug}`,
              userId,
              toolkit: { slug: i.slug, name: i.name },
              status: i.connection?.isActive ? 'ACTIVE' : 'NOT_CONNECTED',
            })),
          }
        } catch {
          return { items: [] }
        }
      },
    }
  },
}

export const getActiveConnectedAccounts = async (userEmail: string, toolSlugs: string[]) => {
  if (!toolSlugs || toolSlugs.length === 0) return {}
  try {
    const s = await composioService.getOrCreateSession(userEmail)
    const items = await composioService.getSessionToolkits(s, true)
    const result: Record<string, string[]> = {}
    for (const item of items) {
      const slug = item.slug?.toLowerCase()
      if (slug && toolSlugs.includes(slug)) {
        result[slug] = [item.connection?.connectedAccount?.id || `ca_${slug}`]
      }
    }
    return result
  } catch (err) {
    console.error('Error fetching active connected accounts:', err)
    return {}
  }
}

export { buildAgentInstructions } from '../agent-sdk/instructions'
