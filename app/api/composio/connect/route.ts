import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composio } from '@/lib/composio/client'

/**
 * Initiate real OAuth connection for a tool via Composio
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = await req.json().catch(() => ({}))
    const { appName, redirectUrl } = body

    if (!appName) {
      return NextResponse.json({ error: 'appName is required' }, { status: 400 })
    }

    const userUuid = user?.email || user?.id || 'default_user'
    const result = await composio.initiateConnection(appName, userUuid, redirectUrl)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Error in /api/composio/connect:', err)
    return NextResponse.json({ error: err.message || 'Failed to initiate connection' }, { status: 500 })
  }
}
