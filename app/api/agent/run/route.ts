import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentRuntime } from '@/lib/agent-sdk/runtime'

/**
 * Execute an agent run and track history in public.agent_runs
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { agentId, missionTitle, prompt, triggerType = 'manual' } = body

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    // Fetch agent record
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentErr || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const title = missionTitle || agent.recurring_task_schema?.instruction || prompt || 'Routine Task Run'
    const tools = agent.tools || []

    // 1. Create run record in agent_runs
    const { data: runRecord, error: runErr } = await supabase
      .from('agent_runs')
      .insert({
        agent_id: agentId,
        user_id: user.id,
        mission_title: title,
        status: 'running',
        tasks_count: 3,
        completed_tasks: 1,
        health_percent: 33,
        tool_routes: tools,
        trigger_type: triggerType,
      })
      .select()
      .single()

    if (runErr) {
      console.warn('Could not insert to agent_runs:', runErr)
    }

    // 2. Initialize runtime
    const runtime = new AgentRuntime({
      agentId,
      name: agent.name,
      instructions: agent.system_prompt || '',
      model: agent.model || process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash',
      connectedTools: tools,
    })

    const traces: any[] = []
    let finalAnswer = ''
    let approvalGate: any = null
    let status: 'completed' | 'waiting_approval' | 'failed' = 'completed'

    const generator = runtime.execute(prompt || title, {
      userId: user.id,
    })

    for await (const event of generator) {
      if (event.trace) {
        traces.push(event.trace)
      }
      if (event.type === 'approval_required') {
        approvalGate = event.data
        status = 'waiting_approval'
        break
      }
      if (event.type === 'final_response' && event.data?.answer) {
        finalAnswer = event.data.answer
      }
    }

    // 3. Update run record
    if (runRecord?.id) {
      await supabase
        .from('agent_runs')
        .update({
          status,
          completed_tasks: status === 'completed' ? 3 : 2,
          health_percent: status === 'completed' ? 100 : 82,
          traces,
          approval_gate: approvalGate,
          output_summary: finalAnswer,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', runRecord.id)
    }

    return NextResponse.json({
      success: true,
      runId: runRecord?.id,
      status,
      missionTitle: title,
      traces,
      output: finalAnswer,
      approvalGate,
    })
  } catch (err: any) {
    console.error('Error executing agent run:', err)
    return NextResponse.json({ error: err.message || 'Run execution failed' }, { status: 500 })
  }
}

/**
 * GET list of runs for an agent
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')

    let query = supabase.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(20)

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data: runs, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message, runs: [] })
    }

    return NextResponse.json({ success: true, runs: runs || [] })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, runs: [] })
  }
}
