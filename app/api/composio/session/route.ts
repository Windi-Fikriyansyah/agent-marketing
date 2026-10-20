import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composio } from '@/lib/composio/client'

/**
 * Phase 1 Step 5: Create Composio Session
 * Initializes a session (e.g. cs_m8412k9s...) for user and connected toolkits.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = await req.json().catch(() => ({}))
    const { agentId, toolkits } = body

    const userId = user?.id || user?.email || 'user_default'
    const targetToolkits = toolkits && Array.isArray(toolkits) && toolkits.length > 0
      ? toolkits
      : ['slack', 'gmail', 'googledocs', 'notion', 'googlecalendar']

    // Create session via Composio Client
    const session = await composio.sessions.create({
      userId,
      toolkits: targetToolkits,
    })

    // If agentId provided, persist composio_session_id to database
    if (agentId) {
      try {
        await supabase
          .from('agents')
          .update({
            composio_session_id: session.sessionId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', agentId)
      } catch (dbErr) {
        console.warn('Could not persist composio_session_id to agents table:', dbErr)
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      session,
    })
  } catch (err: any) {
    console.error('Error in /api/composio/session:', err)
    return NextResponse.json({ error: err.message || 'Failed to create session' }, { status: 500 })
  }
}
