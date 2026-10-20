import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentRuntime } from '@/lib/agent-sdk/runtime'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentId, userPrompt, conversationHistory, approvedAction } = body

    if (!userPrompt && !approvedAction) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 })
    }

    // Connect to Supabase to fetch agent configuration
    const supabase = await createClient()
    const { data: agentData } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single()

    const agentName = agentData?.name || 'OpenAI Agent'
    const agentInstructions = agentData?.system_prompt || agentData?.description || ''
    const agentModel = agentData?.model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini'

    const runtime = new AgentRuntime({
      agentId: agentId || 'default-agent',
      name: agentName,
      instructions: agentInstructions,
      model: agentModel,
    })

    // Create a streaming SSE response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = runtime.execute(userPrompt || '', {
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
