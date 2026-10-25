import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { composio } from '@/lib/composio/client'

/**
 * GET /api/composio/session?agentId=...
 * Fetch existing composio_session_id from database
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: agentData, error } = await supabase
      .from('agents')
      .select('id, composio_session_id')
      .eq('id', agentId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      sessionId: agentData?.composio_session_id || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/composio/session
 * Initializes or reuses a Composio session for the agent.
 * Rule: If the agent already has a composio_session_id in the database, reuse it and do not create a new one!
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = await req.json().catch(() => ({}))
    const { agentId, toolkits, forceNew } = body

    // 1. If agent already exists, check if composio_session_id already exists in database
    if (agentId && !forceNew) {
      const { data: existingAgent } = await supabase
        .from('agents')
        .select('id, composio_session_id')
        .eq('id', agentId)
        .maybeSingle()

      if (existingAgent?.composio_session_id && existingAgent.composio_session_id.trim().length > 0) {
        return NextResponse.json({
          success: true,
          sessionId: existingAgent.composio_session_id,
          reused: true,
          message: 'Using existing Composio session ID from database',
        })
      }
    }

    const userId = user?.id || user?.email || 'user_default'
    const targetToolkits = toolkits && Array.isArray(toolkits) && toolkits.length > 0
      ? toolkits
      : ['slack', 'gmail', 'googledocs', 'notion', 'googlecalendar']

    // 2. Create new session via Composio Client
    const session = await composio.sessions.create({
      userId,
      toolkits: targetToolkits,
    })

    // 3. Persist new composio_session_id to database
    if (agentId) {
      try {
        const { error: dbErr } = await supabase
          .from('agents')
          .update({
            composio_session_id: session.sessionId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', agentId)

        if (dbErr) {
          console.error('Failed to update composio_session_id in database:', dbErr)
        } else {
          console.log(`Successfully stored composio_session_id ${session.sessionId} for agent ${agentId}`)
        }
      } catch (dbErr) {
        console.warn('Could not persist composio_session_id to agents table:', dbErr)
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      reused: false,
      session,
    })
  } catch (err: any) {
    console.error('Error in /api/composio/session:', err)
    return NextResponse.json({ error: err.message || 'Failed to create session' }, { status: 500 })
  }
}
