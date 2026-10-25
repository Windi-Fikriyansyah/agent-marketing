import {
  AgentRuntimeConfig,
  AgentStreamEvent,
  AgentStepTrace,
  AgentToolDefinition,
  ApprovalRequest,
  AgentExecutionContext,
} from './types'
import { DEFAULT_AGENT_TOOLS } from './tools/builtins'
import { COMPOSIO_APP_TOOLS } from './tools/composioTools'
import { BROWSER_TOOLS } from '@/lib/browser/tools'
import { buildAgentInstructions } from './instructions'
import { streamOpenRouterTurn } from './providers/openrouter'
import { composioService } from '@/lib/composio/client'

/**
 * Checks if a specific tool call is a modifying/destructive action
 * that requires explicit human approval (Human-in-the-Loop, AGENTS.md §3.4 rule 7)
 */
function isActionRequiringApproval(toolName: string, args: Record<string, any>): { requires: boolean; reason: string } {
  if (toolName === 'gmail' && args?.action === 'send_email') {
    const target = args.recipient_email || args.to || args.recipient || '(Penerima)'
    return {
      requires: true,
      reason: `Agent ingin mengirim email ke "${target}" dengan subjek "${args.subject || '(Tanpa Subjek)'}".`,
    }
  }

  if (toolName === 'slack' && args?.message) {
    return {
      requires: true,
      reason: `Agent ingin memposting pesan ke saluran ${args.channel || '#general'}: "${args.message.substring(0, 80)}..."`,
    }
  }

  if (toolName === 'github' && (args?.action === 'create_issue' || args?.action === 'close_issue')) {
    return {
      requires: true,
      reason: `Agent ingin ${args.action === 'create_issue' ? 'membuat' : 'menutup'} issue pada repository "${args.repo}": "${args.title || ''}".`,
    }
  }

  if (toolName === 'googlecalendar' && args?.action === 'create_event') {
    const timeDisplay = args.start_datetime || args.startTime || args.start_time || 'terjadwal'
    return {
      requires: true,
      reason: `Agent ingin menjadwalkan agenda "${args.summary || 'Agenda Baru'}" pada waktu ${timeDisplay} di Google Calendar.`,
    }
  }

  if (toolName === 'googledocs' && args?.title) {
    return {
      requires: true,
      reason: `Agent ingin membuat berkas Google Docs baru berjudul "${args.title}".`,
    }
  }

  if (toolName === 'notion' && args?.action === 'create_page') {
    return {
      requires: true,
      reason: `Agent ingin membuat halaman catatan baru di Notion berjudul "${args.title}".`,
    }
  }

  if (toolName === 'browser_act') {
    const instr = (args?.instruction || '').toLowerCase()
    const sensitiveKeywords = [
      'submit',
      'kirim',
      'bayar',
      'pay',
      'checkout',
      'beli',
      'order',
      'pesan',
      'delete',
      'hapus',
      'login',
      'masuk',
      'sign in',
      'password',
      'sandi',
      'kata sandi',
      'daftar',
      'register',
      'sign up',
      'transfer',
    ]
    const isSensitive = sensitiveKeywords.some((k) => instr.includes(k))
    if (isSensitive) {
      return {
        requires: true,
        reason: `Agent meminta persetujuan untuk melakukan aksi browser interaktif sensitif: "${args.instruction}". Konfirmasi diperlukan sebelum mengeksekusi di browser.`,
      }
    }
  }

  if (toolName === 'execute_sensitive_action') {
    return {
      requires: true,
      reason: `Aksi kritis: ${args?.description || 'Mengubah data eksternal'}`,
    }
  }

  return { requires: false, reason: '' }
}

/**
 * Normalizes and resolves the effective LLM model for OpenRouter Gateway.
 * Maps legacy/unsupported model names (e.g. 'grok-2', 'grok-beta')
 * to supported OpenRouter models based on environment configuration.
 */
export function resolveEffectiveModel(requestedModel?: string | null): string {
  const model = (requestedModel || '').trim()

  // Jika model mengandung grok atau kosong, fallback ke OPENROUTER_DEFAULT_MODEL
  if (!model || model.toLowerCase().includes('grok')) {
    return process.env.OPENROUTER_DEFAULT_MODEL || 'thinkingmachines/inkling:free'
  }

  // Jika model masih berupa nama pendek vendor lama (misal gemini-flash-latest atau gpt-4o),
  // map ke id OpenRouter resmi
  if (model === 'gemini-flash-latest' || model === 'gemini-2.5-flash') {
    return 'google/gemini-2.5-flash'
  }
  if (model === 'gpt-4o' || model === 'GPT-4o') {
    return 'openai/gpt-4o'
  }
  if (model === 'gpt-4o-mini') {
    return 'openai/gpt-4o-mini'
  }

  return model
}

export class AgentRuntime {
  private config: AgentRuntimeConfig
  private tools: Map<string, AgentToolDefinition> = new Map()

  constructor(config: AgentRuntimeConfig) {
    this.config = {
      ...config,
      model: resolveEffectiveModel(config.model),
    }

    // Attach Builtin Local Tools
    const localTools = config.tools || DEFAULT_AGENT_TOOLS
    localTools.forEach((t) => this.tools.set(t.name, t))

    // Attach Composio App Tools
    COMPOSIO_APP_TOOLS.forEach((t) => this.tools.set(t.name, t))

    // Attach Cloud Browser Tools (Browserbase + Stagehand)
    BROWSER_TOOLS.forEach((t) => this.tools.set(t.name, t))
  }

  /**
   * Execute the Agent Loop with real-time SSE event streaming
   * Conforms strictly to AGENTS.md §3.1 and §2 (NO regex/keyword intent classification).
   */
  async *execute(
    userPrompt: string,
    options?: {
      conversationHistory?: { role: 'user' | 'agent'; content: string }[]
      approvedAction?: { toolName: string; parameters: any } | null
    }
  ): AsyncGenerator<AgentStreamEvent, void, unknown> {
    const startTime = Date.now()
    const activeUserId = this.config.userId || 'default_user'

    // =========================================================================
    // STEP 1: Understand Request
    // =========================================================================
    const step1Trace: AgentStepTrace = {
      step: 'user_request',
      stepNumber: 1,
      title: 'Understand Request',
      description: 'Menganalisis permintaan pengguna dengan pemahaman bahasa alami.',
      status: 'completed',
      details: { promptLength: userPrompt?.length || 0, userId: activeUserId },
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'user_request', stepNumber: 1, trace: step1Trace }

    // Initialize or restore persistent Composio session (AGENTS.md §3.4 rule 3)
    let composioSession: any = null
    let composioSessionId = this.config.composioSessionId
    try {
      const session = await composioService.getOrCreateSession(activeUserId, composioSessionId)
      composioSession = session
      composioSessionId = session.sessionId
    } catch (err: any) {
      console.warn('[AgentRuntime] Composio session setup warning:', err.message)
    }

    let liveViewUpdate: { url: string; sessionId: string } | null = null

    const context: AgentExecutionContext = {
      userId: activeUserId,
      conversationId: this.config.conversationId,
      sessionId: composioSessionId || undefined,
      agentId: this.config.agentId,
      composioSession,
      model: this.config.model,
      onLiveViewUrl: (url, sid) => {
        liveViewUpdate = { url, sessionId: sid }
      },
    }

    // =========================================================================
    // STEP 2: Reason + Plan
    // =========================================================================
    const step2Trace: AgentStepTrace = {
      step: 'reason_plan',
      stepNumber: 2,
      title: 'Reason + Plan',
      description: `Menganalisis tujuan percakapan via gateway OpenRouter model: ${this.config.model}.`,
      status: 'completed',
      details: { model: this.config.model, toolsAvailable: Array.from(this.tools.keys()) },
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

    // =========================================================================
    // STEP 3: Check Instructions
    // =========================================================================
    const fullInstructions = buildAgentInstructions(this.config)
    const step3Trace: AgentStepTrace = {
      step: 'check_instructions',
      stepNumber: 3,
      title: 'Check Instructions',
      description: 'Menerapkan persona, batasan sistem, dan guardrails keamanan.',
      status: 'completed',
      details: { rulesApplied: true, modelTarget: this.config.model },
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'check_instructions', stepNumber: 3, trace: step3Trace }

    // Build OpenAI-compatible messages array
    const messages: Array<{
      role: 'user' | 'assistant' | 'system' | 'tool'
      content?: string | null
      tool_calls?: any[]
      tool_call_id?: string
      name?: string
    }> = []

    // Truncate message history to prevent context overflow while keeping recent context (AGENTS.md §3.2)
    const rawHistory = options?.conversationHistory || []
    // Append current user prompt
    const effectivePrompt =
      userPrompt && userPrompt.trim().length > 0
        ? userPrompt.trim()
        : options?.approvedAction
        ? `Pengguna telah menyetujui aksi ${options.approvedAction.toolName}. Lanjutkan eksekusi dan berikan laporan hasil.`
        : 'Halo'

    // Deduplicate if the last message in rawHistory already contains effectivePrompt
    const cleanedHistory =
      rawHistory.length > 0 &&
      rawHistory[rawHistory.length - 1].role === 'user' &&
      rawHistory[rawHistory.length - 1].content?.trim() === effectivePrompt.trim()
        ? rawHistory.slice(0, -1)
        : rawHistory

    const boundedHistory =
      cleanedHistory.length > 20
        ? [...cleanedHistory.slice(0, 2), ...cleanedHistory.slice(-16)]
        : cleanedHistory

    for (const msg of boundedHistory) {
      messages.push({
        role: msg.role === 'agent' ? 'assistant' : 'user',
        content: msg.content,
      })
    }

    messages.push({
      role: 'user',
      content: effectivePrompt,
    })

    // Prepare tools list for LLM function calling
    const availableToolsList = Array.from(this.tools.values())

    // In-memory set of executed approval IDs for idempotency (AGENTS.md §F)
    const executedApprovalIds = (globalThis as any).__executedApprovalIds || ((globalThis as any).__executedApprovalIds = new Set<string>())

    // If an action was already approved by user in UI (Human-In-The-Loop resume)
    if (options?.approvedAction) {
      const tool = this.tools.get(options.approvedAction.toolName)
      const approvalId =
        (options.approvedAction as any).id ||
        (options.approvedAction as any).idempotencyKey ||
        `${options.approvedAction.toolName}_${JSON.stringify(options.approvedAction.parameters)}`

      if (tool && !executedApprovalIds.has(approvalId)) {
        executedApprovalIds.add(approvalId)
        yield {
          type: 'step_start',
          step: 'run_tools',
          stepNumber: 5,
          trace: {
            step: 'run_tools',
            stepNumber: 5,
            title: 'Run Tools (Approved)',
            description: `Mengeksekusi aksi yang telah disetujui pengguna: ${tool.name}`,
            status: 'running',
            timestamp: new Date().toLocaleTimeString('id-ID'),
          },
        }

        let execResult: any
        try {
          execResult = await tool.execute(options.approvedAction.parameters, context)
        } catch (err: any) {
          execResult = { status: 'error', error: err.message }
        }

        const approvedCallId = `call_appr_${Date.now()}`
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: approvedCallId,
              type: 'function',
              function: {
                name: tool.name,
                arguments: JSON.stringify(options.approvedAction.parameters),
              },
            },
          ],
        })
        messages.push({
          role: 'tool',
          tool_call_id: approvedCallId,
          name: tool.name,
          content: JSON.stringify(execResult),
        })
      }
    }

    // =========================================================================
    // AGENT LOOP (AGENTS.md §3.1)
    // 1. Send messages + tool schemas to OpenRouter
    // 2. If tool_call: execute tool, append to messages, repeat
    // 3. If final text: stream tokens, finish
    // =========================================================================
    const maxIterations = 8
    let iteration = 0
    let finalAnswer = ''
    let actualServingModel = this.config.model
    let totalTokensUsage: any = null
    const tracesRecorded: AgentStepTrace[] = []

    const openRouterApiKey = process.env.OPENROUTER_API_KEY
    if (!openRouterApiKey || openRouterApiKey.trim().length === 0) {
      yield {
        type: 'error',
        data: {
          error:
            '⚠️ API Key tidak ditemukan. Pastikan `OPENROUTER_API_KEY` telah diatur di file `.env.local` pada server backend.',
        },
      }
      return
    }

    while (iteration < maxIterations) {
      iteration++

      let currentFunctionCalls: Array<{ id: string; name: string; args: any }> = []
      let currentTurnText = ''

      try {
        const stream = streamOpenRouterTurn({
          model: this.config.model || 'nvidia/nemotron-3-ultra-550b-a55b:free',
          systemInstruction: fullInstructions,
          messages,
          tools: availableToolsList,
        })

        for await (const chunk of stream) {
          if (chunk.type === 'token' && chunk.token) {
            currentTurnText += chunk.token
            yield { type: 'token', data: { token: chunk.token } }
          } else if (chunk.type === 'function_call' && chunk.functionCall) {
            currentFunctionCalls.push(chunk.functionCall)
          } else if (chunk.type === 'meta' && chunk.meta) {
            if (chunk.meta.servingModel) actualServingModel = chunk.meta.servingModel
            if (chunk.meta.usage) totalTokensUsage = chunk.meta.usage
          }
        }
      } catch (llmErr: any) {
        console.error('LLM API Error during Agent Loop turn:', llmErr)
        yield {
          type: 'error',
          data: {
            error: `Gagal berkomunikasi dengan gateway OpenRouter: ${llmErr.message}. Periksa API key atau koneksi internet server.`,
          },
        }
        return
      }

      // If LLM returned one or more tool calls:
      if (currentFunctionCalls.length > 0) {
        for (const fn of currentFunctionCalls) {
          const toolName = fn.name
          const toolArgs = fn.args || {}

          // STEP 4: Pick Tools
          const step4Trace: AgentStepTrace = {
            step: 'pick_tools',
            stepNumber: 4,
            title: 'Pick Tools',
            description: `LLM memilih tool: ${toolName}`,
            status: 'completed',
            details: { toolName, arguments: toolArgs, callId: fn.id },
            timestamp: new Date().toLocaleTimeString('id-ID'),
          }
          yield { type: 'step_start', step: 'pick_tools', stepNumber: 4, trace: step4Trace }
          tracesRecorded.push(step4Trace)

          // STEP 7: Check if tool call requires Human-In-The-Loop Approval (AGENTS.md §3.4 rule 7)
          const approvalCheck = isActionRequiringApproval(toolName, toolArgs)
          if (approvalCheck.requires) {
            const approvalReq: ApprovalRequest = {
              id: fn.id || `appr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              toolName,
              parameters: toolArgs,
              reason: approvalCheck.reason,
              timestamp: new Date().toLocaleTimeString('id-ID'),
            }

            const step7Trace: AgentStepTrace = {
              step: 'ask_approval',
              stepNumber: 7,
              title: 'Ask for Approval',
              description: `Memerlukan konfirmasi persetujuan pengguna sebelum mengeksekusi "${toolName}".`,
              status: 'waiting_approval',
              details: approvalReq,
              timestamp: new Date().toLocaleTimeString('id-ID'),
            }

            yield {
              type: 'approval_required',
              step: 'ask_approval',
              stepNumber: 7,
              trace: step7Trace,
              data: approvalReq,
            }
            // Pause execution and wait for user's approval in UI
            return
          }

          // STEP 5: Run Tools
          const step5Trace: AgentStepTrace = {
            step: 'run_tools',
            stepNumber: 5,
            title: 'Run Tools',
            description: `Mengeksekusi tool "${toolName}" secara nyata...`,
            status: 'running',
            details: { toolName, args: toolArgs },
            timestamp: new Date().toLocaleTimeString('id-ID'),
          }
          yield { type: 'step_start', step: 'run_tools', stepNumber: 5, trace: step5Trace }

          const tool = this.tools.get(toolName)
          let toolExecutionResult: any

          if (tool) {
            try {
              toolExecutionResult = await tool.execute(toolArgs, context)
              step5Trace.status = 'completed'
              step5Trace.details = { output: toolExecutionResult }

              // Check if tool indicates user needs to connect external account
              if (toolExecutionResult?.requires_auth && toolExecutionResult?.connect_link) {
                yield {
                  type: 'connect_required',
                  data: {
                    toolkit: toolExecutionResult.toolkit || toolName,
                    connectUrl: toolExecutionResult.connect_link,
                    message: toolExecutionResult.message,
                  },
                }
              }

              // Check if tool produced a live view url (browser_navigate / browser_act)
              const liveViewObj = liveViewUpdate as { url: string; sessionId: string } | null
              if (toolExecutionResult?.liveViewUrl || liveViewObj) {
                const lvw = toolExecutionResult?.liveViewUrl || liveViewObj?.url
                const sid = toolExecutionResult?.sessionId || liveViewObj?.sessionId
                yield {
                  type: 'browser_live_view',
                  data: {
                    debuggerUrl: lvw,
                    sessionId: sid,
                    currentUrl: toolExecutionResult?.currentUrl,
                    title: toolExecutionResult?.title,
                  },
                }
                liveViewUpdate = null
              }
            } catch (execErr: any) {
              step5Trace.status = 'failed'
              step5Trace.details = { error: execErr.message }
              toolExecutionResult = { status: 'error', error: execErr.message }
            }
          } else {
            step5Trace.status = 'failed'
            toolExecutionResult = { status: 'error', error: `Tool ${toolName} tidak terdaftar di agent runtime.` }
          }

          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }
          tracesRecorded.push(step5Trace)

          // STEP 6: Review Results
          const step6Trace: AgentStepTrace = {
            step: 'review_results',
            stepNumber: 6,
            title: 'Review Results',
            description: `Memeriksa hasil eksekusi tool ${toolName}.`,
            status: 'completed',
            details: { status: toolExecutionResult?.status || 'ok' },
            timestamp: new Date().toLocaleTimeString('id-ID'),
          }
          yield { type: 'step_start', step: 'review_results', stepNumber: 6, trace: step6Trace }
          tracesRecorded.push(step6Trace)

          // Append assistant tool call and tool result to OpenAI messages array
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: fn.id,
                type: 'function',
                function: {
                  name: toolName,
                  arguments: JSON.stringify(toolArgs),
                },
              },
            ],
          })

          messages.push({
            role: 'tool',
            tool_call_id: fn.id,
            name: toolName,
            content: typeof toolExecutionResult === 'string' ? toolExecutionResult : JSON.stringify(toolExecutionResult),
          })
        }

        // Continue agent loop to allow LLM to synthesize tool results
        continue
      }

      // If no function call, LLM finished synthesizing final text
      if (currentTurnText && currentTurnText.trim().length > 0) {
        finalAnswer = currentTurnText.trim()
        break
      }
    }

    // =========================================================================
    // STEP 8: Final Response
    // =========================================================================
    const step8Trace: AgentStepTrace = {
      step: 'final_response',
      stepNumber: 8,
      title: 'Final Response',
      description: 'Menyajikan jawaban akhir percakapan.',
      status: 'completed',
      details: {
        servingModel: actualServingModel,
        iterationsUsed: iteration,
        durationMs: Date.now() - startTime,
        usage: totalTokensUsage,
      },
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'final_response', stepNumber: 8, trace: step8Trace }
    tracesRecorded.push(step8Trace)

    yield {
      type: 'final_response',
      step: 'final_response',
      stepNumber: 8,
      trace: step8Trace,
      data: {
        text: finalAnswer,
        answer: finalAnswer,
        servingModel: actualServingModel,
        usage: totalTokensUsage,
        composioSessionId,
        traces: tracesRecorded,
      },
    }
  }
}
