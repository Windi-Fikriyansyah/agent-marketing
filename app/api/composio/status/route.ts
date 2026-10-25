import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composioService } from '@/lib/composio/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const toolkit = searchParams.get('toolkit')
    const userIdParam = searchParams.get('userId')
    const agentId = searchParams.get('agentId')

    let effectiveUserId = userIdParam || 'default_user'
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.id || user?.email) {
        effectiveUserId = user.id || user.email || 'default_user'
      }
    } catch {}

    const session = await composioService.getOrCreateSession(effectiveUserId)
    const toolkits = await composioService.getSessionToolkits(session)

    if (toolkit) {
      const norm = toolkit.toLowerCase()
      let found = toolkits.find((t: any) => t.slug?.toLowerCase() === norm)
      let isConnected = Boolean(found?.connection?.isActive || found?.isNoAuth)

      // Fallback cross-check jika user terdaftar dengan user.id atau email
      if (!isConnected && userIdParam && userIdParam !== effectiveUserId) {
        try {
          const altSession = await composioService.getOrCreateSession(userIdParam)
          const altToolkits = await composioService.getSessionToolkits(altSession)
          const altFound = altToolkits.find((t: any) => t.slug?.toLowerCase() === norm)
          if (altFound?.connection?.isActive) {
            isConnected = true
            found = altFound
          }
        } catch {}
      }

      return NextResponse.json({
        connected: isConnected,
        status: isConnected ? 'ACTIVE' : 'NOT_CONNECTED',
        toolkit: norm,
        account: found?.connection?.connectedAccount || null,
      })
    }

    const activeToolkits = toolkits
      .filter((t: any) => t.connection?.isActive || t.isNoAuth)
      .map((t: any) => t.slug?.toLowerCase())

    return NextResponse.json({
      success: true,
      activeToolkits,
    })
  } catch (err: any) {
    console.error('Error in /api/composio/status:', err.message)
    const isInvalidKey = err.message?.includes('Invalid API key') || err.message?.includes('801')
    const friendlyMessage = isInvalidKey
      ? 'Composio API Key tidak valid. Pastikan menggunakan Project API Key backend (berawalan "ak_...") dari dashboard Composio (https://dashboard.composio.dev/settings), bukan Consumer Key ("ck_...").'
      : err.message
    return NextResponse.json({ connected: false, error: friendlyMessage }, { status: isInvalidKey ? 401 : 500 })
  }
}
