import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composioService } from '@/lib/composio/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { toolkit, userId } = body

    if (!toolkit) {
      return NextResponse.json({ error: 'toolkit slug is required' }, { status: 400 })
    }

    let effectiveUserId = userId || 'default_user'
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.id || user?.email) {
        effectiveUserId = user.id || user.email
      }
    } catch {}

    const host = req.headers.get('host') || 'localhost:3000'
    const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const callbackUrl = `${protocol}://${host}/api/composio/callback`

    const session = await composioService.getOrCreateSession(effectiveUserId)
    const result = await composioService.createConnectLink(session, toolkit, callbackUrl)

    if (!result.success || !result.redirectUrl) {
      return NextResponse.json(
        {
          error: result.error || `Gagal membuat Link OAuth untuk toolkit ${toolkit}`,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      toolkit,
      userId: effectiveUserId,
      redirectUrl: result.redirectUrl,
      connectionId: result.connectionId,
    })
  } catch (err: any) {
    console.error('Error in /api/composio/connect:', err.message)
    const isInvalidKey = err.message?.includes('Invalid API key') || err.message?.includes('801')
    const friendlyMessage = isInvalidKey
      ? 'Composio API Key tidak valid. Pastikan menggunakan Project API Key backend (berawalan "ak_...") dari dashboard Composio (https://dashboard.composio.dev/settings), bukan Consumer Key ("ck_...").'
      : err.message
    return NextResponse.json({ error: friendlyMessage }, { status: isInvalidKey ? 401 : 500 })
  }
}
