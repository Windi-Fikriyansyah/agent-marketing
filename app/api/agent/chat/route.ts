import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AgentRuntime, resolveEffectiveModel } from '@/lib/agent-sdk/runtime'
import { validateAgentModel } from '@/lib/agent-sdk/models/catalog'
import { composioService } from '@/lib/composio/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentId, userPrompt, conversationHistory, approvedAction } = body

    if (!userPrompt && !approvedAction && (!conversationHistory || conversationHistory.length === 0)) {
      return NextResponse.json({ error: 'userPrompt is required' }, { status: 400 })
    }

    // Connect to Supabase to fetch agent configuration and authenticated user
    let agentData: any = null
    let authUserId: string | undefined = undefined
    let supabaseClient: any = null

    try {
      supabaseClient = await createClient()
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()
      authUserId = user?.id || user?.email || undefined

      if (agentId) {
        const { data } = await supabaseClient.from('agents').select('*').eq('id', agentId).single()
        agentData = data || null
      }
    } catch (e) {
      console.warn('Supabase agentData fetch warning:', e)
    }

    const agentName = agentData?.name || body.agentName || 'Grok AI Agent'
    const agentInstructions = agentData?.system_prompt || agentData?.description || body.instructions || ''
    const requestedModel = body.model || agentData?.model
    const agentModel = resolveEffectiveModel(requestedModel)

    // Validasi kelayakan model terhadap katalog OpenRouter (KEBUTUHAN C)
    const validation = await validateAgentModel(agentModel)
    if (!validation.valid && validation.reason?.includes('tidak mendukung tool')) {
      return NextResponse.json(
        {
          error: `⚠️ Mode Agent Memerlukan Tool: ${validation.reason} Silakan pilih model yang mendukung tools di katalog OpenRouter.`,
        },
        { status: 400 }
      )
    }

    const composioSessionId = agentData?.composio_session_id || body.composioSessionId || null
    // Secure user_id from server authentication session or database agent owner (AGENTS.md §6.3)
    const rawUserId = authUserId || body.userId || agentData?.user_id || 'default_user'
    const effectiveUserId = await composioService.resolveCanonicalUserId(rawUserId)

    const rawTools: string[] = Array.isArray(body.connectedTools)
      ? body.connectedTools
      : Array.isArray(agentData?.tools)
      ? agentData.tools
      : ['gmail']
    if (!rawTools.includes('gmail')) {
      rawTools.push('gmail')
    }

    const runtime = new AgentRuntime({
      agentId: agentId || 'default-agent',
      name: agentName,
      instructions: agentInstructions,
      model: agentModel,
      composioSessionId,
      userId: effectiveUserId,
      connectedTools: rawTools,
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
            // If final_response carries a new composioSessionId and we have agentId, persist to database
            if (event.type === 'final_response' && event.data?.composioSessionId && agentId && supabaseClient) {
              const newSid = event.data.composioSessionId
              if (newSid !== composioSessionId) {
                supabaseClient
                  .from('agents')
                  .update({ composio_session_id: newSid })
                  .eq('id', agentId)
                  .then(undefined, console.warn)
              }
            }

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
