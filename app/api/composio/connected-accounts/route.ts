import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composio } from '@/lib/composio/client'

/**
 * GET connected accounts for user from Composio API
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

    const userEmail = user?.email || user?.id || 'default_user'
    const accounts = await composio.listConnectedAccounts(userEmail, toolSlugs)

    // Map into lookup dictionary
    const connectedAccounts = accounts.reduce((acc: Record<string, string[]>, account) => {
      const slug = account.appName.toLowerCase()
      if (!acc[slug]) acc[slug] = []
      acc[slug].push(account.id)
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      userEmail,
      accounts,
      connectedAccounts,
      isConfigured: composio.isConfigured,
    })
  } catch (err: any) {
    console.error('Error fetching connected accounts:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
