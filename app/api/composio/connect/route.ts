import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composio } from '@/lib/composio/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { toolkit, userId } = body

    if (!toolkit) {
      return NextResponse.json({ error: 'toolkit slug is required' }, { status: 400 })
    }

    // Try to get authenticated user from Supabase session if userId not provided
    let effectiveUserId = userId || 'default_user'
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.email) {
        effectiveUserId = user.email
      }
    } catch {
      // Keep effectiveUserId
    }

    const host = req.headers.get('host') || 'localhost:3000'
    const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const callbackUrl = `${protocol}://${host}/api/composio/callback`

    const result = await composio.createConnectLink(toolkit, effectiveUserId, callbackUrl)

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
      linkToken: result.linkToken,
    })
  } catch (err: any) {
    console.error('Error in /api/composio/connect:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
