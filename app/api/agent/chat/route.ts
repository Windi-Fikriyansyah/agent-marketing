import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentRuntime } from '@/lib/agent-sdk/runtime'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentId, userPrompt, conversationHistory, approvedAction } = body

    if (!userPrompt && !approvedAction && (!conversationHistory || conversationHistory.length === 0)) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 })
    }

    // Connect to Supabase to fetch agent configuration with 2s timeout protection
    let agentData: any = null
    let authUserEmail: string | undefined = undefined
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      authUserEmail = user?.email || undefined

      const fetchPromise = supabase.from('agents').select('*').eq('id', agentId).single()
      const timeoutPromise = new Promise<any>((resolve) =>
        setTimeout(() => resolve({ data: null, error: 'timeout' }), 2000)
      )
      const res = await Promise.race([fetchPromise, timeoutPromise])
      agentData = res?.data || null
    } catch (e) {
      console.warn('Supabase agentData fetch warning:', e)
    }

    const agentName = agentData?.name || body.agentName || 'OpenAI Agent'
    const agentInstructions = agentData?.system_prompt || agentData?.description || body.instructions || ''
    const agentModel = agentData?.model || body.model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini'
    const connectedTools = body.connectedTools || agentData?.tools || []
    const composioSessionId = body.composioSessionId || agentData?.composio_session_id || null
    const effectiveUserId = authUserEmail || body.userId || 'default_user'

    const runtime = new AgentRuntime({
      agentId: agentId || 'default-agent',
      name: agentName,
      instructions: agentInstructions,
      model: agentModel,
      composioSessionId,
      connectedTools,
      userId: effectiveUserId,
    })

    // Create a streaming SSE response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const rawPrompt = (userPrompt || '').trim()
          const effectivePrompt =
            rawPrompt ||
            (approvedAction
              ? `Pengguna telah menyetujui eksekusi aksi ${approvedAction.toolName}. Lanjutkan eksekusi.`
              : 'Lanjutkan interaksi.')

          const generator = runtime.execute(effectivePrompt, {
            conversationHistory: conversationHistory || [],
            approvedAction: approvedAction || null,
          })

          for await (const event of generator) {
            const chunk = `data: ${JSON.stringify(event)}\n\n`
            controller.enqueue(encoder.encode(chunk))
          }

          controller.close()
        } catch (err: any) {
          const errorChunk = `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`
          controller.enqueue(encoder.encode(errorChunk))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('Agent chat API error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
