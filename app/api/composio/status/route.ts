import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composio } from '@/lib/composio/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const toolkit = searchParams.get('toolkit')
    const userIdParam = searchParams.get('userId')
    const agentId = searchParams.get('agentId')

    let userEmail: string | undefined = undefined
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userEmail = user?.email || undefined
    } catch {
      // Continue without user
    }

    const userIdsToCheck: string[] = []
    if (userEmail) userIdsToCheck.push(userEmail)
    if (userIdParam && !userIdsToCheck.includes(userIdParam)) userIdsToCheck.push(userIdParam)
    if (agentId && !userIdsToCheck.includes(agentId)) userIdsToCheck.push(agentId)
    if (userIdsToCheck.length === 0) {
      userIdsToCheck.push('default_user')
    }

    // If a specific toolkit is requested to verify
    if (toolkit) {
      const result = await composio.isAccountConnected(toolkit, userIdsToCheck)
      return NextResponse.json(result)
    }

    // Otherwise, return all active toolkits from Composio
    const activeToolkits = await composio.getActiveToolkits(userIdsToCheck)
    return NextResponse.json({
      success: true,
      activeToolkits,
    })
  } catch (err: any) {
    console.error('Error in /api/composio/status:', err)
    return NextResponse.json({ connected: false, error: err.message }, { status: 500 })
  }
}
