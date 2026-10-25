import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveConnectedAccounts } from '@/lib/composio/client'


/**
 * Image 2: GET COMPOSIO CONNECT TOOLS LIST
 * Calls getActiveConnectedAccounts(userEmail, toolSlugs)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { searchParams } = new URL(req.url)
    const slugsParam = searchParams.get('tools')
    const toolSlugs = slugsParam ? slugsParam.split(',').map((s) => s.trim().toLowerCase()) : []

    const userEmail = user?.email || 'user@example.com'
    const connectedAccounts = await getActiveConnectedAccounts(userEmail, toolSlugs)

    return NextResponse.json({
      success: true,
      userEmail,
      connectedAccounts,
    })
  } catch (err: any) {
    console.error('Error fetching connected accounts:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
