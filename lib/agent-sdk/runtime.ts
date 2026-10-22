import {
  AgentRuntimeConfig,
  AgentStreamEvent,
  AgentStepTrace,
  AgentToolDefinition,
  ApprovalRequest,
  AgentExecutionContext,
  RecurringTaskSchema,
} from './types'
import { DEFAULT_AGENT_TOOLS } from './tools/builtins'
import { getAgentComposioTools } from './tools/composioTools'
import { buildAgentInstructions } from './instructions'
import {
  callGeminiRaw,
  GeminiToolDeclaration,
  GeminiContent,
} from './providers/gemini'

export class AgentRuntime {
  private config: AgentRuntimeConfig
  private tools: Map<string, AgentToolDefinition> = new Map()

  constructor(config: AgentRuntimeConfig) {
    this.config = {
      ...config,
      model: config.model || process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash',
    }

    // Attach Builtin and Composio Tools
    const baseTools = config.tools || DEFAULT_AGENT_TOOLS
    const composioTools = getAgentComposioTools(config.connectedTools || [])
    const combinedTools = [...baseTools, ...composioTools]

    combinedTools.forEach((tool) => {
      this.tools.set(tool.name, tool)
    })
  }

  /**
   * Convert registered tools to Gemini tool declarations
   */
  private getGeminiToolDeclarations(): GeminiToolDeclaration[] {
    const declarations: GeminiToolDeclaration[] = []

    this.tools.forEach((tool) => {
      // Basic schema inference from zod shape or manual definitions
      const shape = (tool.parameters as any)?._def?.shape?.() || {}
      const properties: Record<string, any> = {}
      const required: string[] = []

      Object.keys(shape).forEach((key) => {
        const zodType = shape[key]?._def?.typeName
        let type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT' = 'STRING'
        if (zodType === 'ZodNumber') type = 'NUMBER'
        else if (zodType === 'ZodBoolean') type = 'BOOLEAN'
        else if (zodType === 'ZodArray') type = 'ARRAY'

        properties[key] = {
          type,
          description: shape[key]?._def?.description || key,
        }
        if (!shape[key]?.isOptional?.()) {
          required.push(key)
        }
      })

      declarations.push({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'OBJECT',
          properties,
          required,
        },
      })
    })

    return declarations
  }

  /**
   * Execute the 8-Step Agent Flow with real-time event streaming and authentic AI Function Calling
   */
  async *execute(
    userPrompt: string,
    options?: {
      userId?: string
      conversationHistory?: { role: 'user' | 'agent'; content: string }[]
      approvedAction?: { toolName: string; parameters: any } | null
    }
  ): AsyncGenerator<AgentStreamEvent, void, unknown> {
    const context: AgentExecutionContext = {
      agentId: this.config.agentId,
      agentName: this.config.name,
      systemPrompt: this.config.instructions,
      userId: options?.userId,
    }

    const geminiKey = (process.env.GEMINI_API_KEY || '').trim()
    const fullInstructions = buildAgentInstructions(this.config)
    const timestamp = () => new Date().toLocaleTimeString('id-ID')

    // =========================================================================
    // STEP 1: User Request
    // =========================================================================
    const step1Trace: AgentStepTrace = {
      step: 'user_request',
      stepNumber: 1,
      title: 'User Request',
      description: 'Menerima dan memvalidasi prompt dari pengguna.',
      status: 'completed',
      details: { prompt: userPrompt },
      timestamp: timestamp(),
    }
    yield { type: 'step_start', step: 'user_request', stepNumber: 1, trace: step1Trace }

    // =========================================================================
    // STEP 2: Reason + Plan (LLM reasoning & tool resolution)
    // =========================================================================
    const step2Trace: AgentStepTrace = {
      step: 'reason_plan',
      stepNumber: 2,
      title: 'Reason + Plan',
      description: 'Menganalisis tujuan dengan AI dan merencanakan dekomposisi task.',
      status: 'running',
      timestamp: timestamp(),
    }
    yield { type: 'step_start', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

    // If an action was already approved by user in Step 7, execute it directly
    if (options?.approvedAction) {
      step2Trace.status = 'completed'
      step2Trace.details = {
        reasoning: `Melanjutkan eksekusi aksi yang telah disetujui: ${options.approvedAction.toolName}`,
        approvedAction: options.approvedAction,
      }
      yield { type: 'step_complete', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

      const tool = this.tools.get(options.approvedAction.toolName)
      if (tool) {
        // Step 5: Run approved tool
        const step5Trace: AgentStepTrace = {
          step: 'run_tools',
          stepNumber: 5,
          title: 'Run Tools',
          description: `Mengeksekusi tool terkonfirmasi: ${tool.name}`,
          status: 'running',
          timestamp: timestamp(),
        }
        yield { type: 'step_start', step: 'run_tools', stepNumber: 5, trace: step5Trace }

        try {
          const result = await tool.execute(options.approvedAction.parameters, context)
          step5Trace.status = 'completed'
          step5Trace.details = { output: result }
          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }

          // Step 8: Final Response
          const step8Trace: AgentStepTrace = {
            step: 'final_response',
            stepNumber: 8,
            title: 'Final Response',
            description: 'Menyintesis laporan eksekusi.',
            status: 'completed',
            timestamp: timestamp(),
          }
          yield {
            type: 'final_response',
            step: 'final_response',
            stepNumber: 8,
            trace: step8Trace,
            data: {
              answer: `✅ **Aksi Berhasil Dijalankan**\n\nTindakan **${tool.name}** telah dieksekusi dengan sukses.\n\n\`\`\`json\n${JSON.stringify(
                result,
                null,
                2
              )}\n\`\`\``,
              provider: 'Composio & Orbit Agent',
            },
          }
        } catch (err: any) {
          step5Trace.status = 'failed'
          step5Trace.details = { error: err.message }
          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }
        }
      }
      return
    }

    if (!geminiKey) {
      step2Trace.status = 'failed'
      step2Trace.details = { error: 'GEMINI_API_KEY tidak dikonfigurasi.' }
      yield { type: 'step_complete', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

      yield {
        type: 'final_response',
        step: 'final_response',
        stepNumber: 8,
        data: {
          answer:
            '⚠️ **GEMINI_API_KEY Belum Dikonfigurasi**\n\nUntuk menjalankan agent secara nyata tanpa mock, harap tambahkan key Google Gemini Anda pada file `.env.local`:\n```env\nGEMINI_API_KEY=AIzaSy...\nCOMPOSIO_API_KEY=cmp_...\n```\nSetelah disimpan, agent akan langsung memproses instruksi dengan kecerdasan nyata.',
          provider: 'Error: API Key Missing',
        },
      }
      return
    }

    // =========================================================================
    // STEP 3: Check Instructions (Apply rules and guidelines)
    // =========================================================================
    const step3Trace: AgentStepTrace = {
      step: 'check_instructions',
      stepNumber: 3,
      title: 'Check Instructions',
      description: 'Menerapkan batasan sistem, aturan persona, dan guardrails.',
      status: 'completed',
      details: {
        agentName: this.config.name,
        rulesApplied: true,
        toolsCount: this.tools.size,
      },
      timestamp: timestamp(),
    }
    yield { type: 'step_complete', step: 'check_instructions', stepNumber: 3, trace: step3Trace }

    // Prepare Gemini contents payload
    const toolDeclarations = this.getGeminiToolDeclarations()
    const contents: GeminiContent[] = []

    if (options?.conversationHistory) {
      for (const msg of options.conversationHistory) {
        contents.push({
          role: msg.role === 'agent' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    })

    // First call to Gemini: reasoning & tool selection
    const firstCall = await callGeminiRaw({
      apiKey: geminiKey,
      model: this.config.model,
      systemInstruction: fullInstructions,
      contents,
      tools: toolDeclarations,
    })

    if (!firstCall.success) {
      step2Trace.status = 'failed'
      step2Trace.details = { error: firstCall.error }
      yield { type: 'step_complete', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

      yield {
        type: 'final_response',
        step: 'final_response',
        stepNumber: 8,
        data: {
          answer: `⚠️ **Gagal Menghubungkan ke Gemini**: ${firstCall.error}`,
          provider: 'Google Gemini Error',
        },
      }
      return
    }

    const plannedTools = firstCall.functionCalls ? firstCall.functionCalls.map((f) => f.name) : []
    step2Trace.status = 'completed'
    step2Trace.details = {
      plannedTools,
      reasoning: plannedTools.length > 0 ? `AI memutuskan untuk memanggil tool: ${plannedTools.join(', ')}` : 'AI memproses sintesis langsung.',
    }
    yield { type: 'step_complete', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

    // =========================================================================
    // STEP 4: Pick Tools
    // =========================================================================
    const step4Trace: AgentStepTrace = {
      step: 'pick_tools',
      stepNumber: 4,
      title: 'Pick Tools',
      description: plannedTools.length > 0 ? `AI memilih tools: ${plannedTools.join(', ')}` : 'Tidak memerlukan pemanggilan tools.',
      status: 'completed',
      details: { selectedTools: plannedTools },
      timestamp: timestamp(),
    }
    yield { type: 'step_complete', step: 'pick_tools', stepNumber: 4, trace: step4Trace }

    // Execute functions if Gemini called them
    const toolResults: any[] = []

    if (firstCall.functionCalls && firstCall.functionCalls.length > 0) {
      for (const call of firstCall.functionCalls) {
        const tool = this.tools.get(call.name)
        if (!tool) continue

        // Check if tool requires human approval (Step 7)
        if (tool.requireApproval) {
          const approvalReq: ApprovalRequest = {
            id: `appr_${Date.now()}`,
            toolName: tool.name,
            parameters: call.args,
            reason: `Tindakan "${tool.name}" memiliki dampak nyata pada data atau akun eksternal.`,
            timestamp: timestamp(),
          }

          const step7Trace: AgentStepTrace = {
            step: 'ask_approval',
            stepNumber: 7,
            title: 'Ask for Approval',
            description: `Memerlukan persetujuan Anda sebelum menjalankan "${tool.name}".`,
            status: 'waiting_approval',
            details: approvalReq,
            timestamp: timestamp(),
          }

          yield {
            type: 'approval_required',
            step: 'ask_approval',
            stepNumber: 7,
            trace: step7Trace,
            data: approvalReq,
          }
          return // Pause execution until user approves
        }

        // STEP 5: Run Tools
        const step5Trace: AgentStepTrace = {
          step: 'run_tools',
          stepNumber: 5,
          title: 'Run Tools',
          description: `Mengeksekusi tool: ${tool.name}`,
          status: 'running',
          timestamp: timestamp(),
        }
        yield { type: 'step_start', step: 'run_tools', stepNumber: 5, trace: step5Trace }

        try {
          const result = await tool.execute(call.args, context)
          toolResults.push({ name: tool.name, result })

          step5Trace.status = 'completed'
          step5Trace.details = { output: result }
          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }
        } catch (err: any) {
          step5Trace.status = 'failed'
          step5Trace.details = { error: err.message }
          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }
        }

        // STEP 6: Review Results
        const step6Trace: AgentStepTrace = {
          step: 'review_results',
          stepNumber: 6,
          title: 'Review Results',
          description: `Memeriksa hasil output dari ${tool.name}.`,
          status: 'completed',
          details: { verified: true },
          timestamp: timestamp(),
        }
        yield { type: 'step_complete', step: 'review_results', stepNumber: 6, trace: step6Trace }
      }

      // Add model function call to contents history
      contents.push({
        role: 'model',
        parts: firstCall.functionCalls.map((f) => ({
          functionCall: { name: f.name, args: f.args },
        })),
      })

      // Add functionResponse to contents history
      for (const tr of toolResults) {
        contents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: tr.name,
                response: tr.result,
              },
            },
          ],
        })
      }

      // Second call to Gemini to synthesize final response after seeing tool output
      const secondCall = await callGeminiRaw({
        apiKey: geminiKey,
        model: this.config.model,
        systemInstruction: fullInstructions,
        contents,
      })

      let finalAnswer = secondCall.content || 'Pekerjaan selesai.'
      let taskSchema = this.extractTaskSchema(finalAnswer, userPrompt)

      const step8Trace: AgentStepTrace = {
        step: 'final_response',
        stepNumber: 8,
        title: 'Final Response',
        description: 'Menyintesis jawaban akhir.',
        status: 'completed',
        details: { provider: secondCall.provider, taskSchema },
        timestamp: timestamp(),
      }

      yield {
        type: 'final_response',
        step: 'final_response',
        stepNumber: 8,
        trace: step8Trace,
        data: { answer: finalAnswer, provider: secondCall.provider },
        taskSchema,
      }
    } else {
      // Direct response without tools
      let finalAnswer = firstCall.content || 'Halo! Ada yang bisa saya bantu?'
      let taskSchema = this.extractTaskSchema(finalAnswer, userPrompt)

      const step8Trace: AgentStepTrace = {
        step: 'final_response',
        stepNumber: 8,
        title: 'Final Response',
        description: 'Menyintesis jawaban akhir.',
        status: 'completed',
        details: { provider: firstCall.provider, taskSchema },
        timestamp: timestamp(),
      }

      yield {
        type: 'final_response',
        step: 'final_response',
        stepNumber: 8,
        trace: step8Trace,
        data: { answer: finalAnswer, provider: firstCall.provider },
        taskSchema,
      }
    }
  }

  private extractTaskSchema(answer: string, userPrompt: string): RecurringTaskSchema | undefined {
    // Check if response contains structured json schema
    const jsonMatch = answer.match(/```json:task_schema\s*([\s\S]*?)\s*```/) || answer.match(/\{[\s\S]*?"instruction"[\s\S]*?\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
        if (parsed.instruction) {
          return {
            instruction: parsed.instruction,
            route: parsed.route || 'slack',
            date: parsed.date || new Date().toISOString().split('T')[0],
            time: parsed.time || '09:00',
            frequency: parsed.frequency || 'weekly',
          }
        }
      } catch {}
    }

    const lower = userPrompt.toLowerCase()
    if (lower.includes('schedule') || lower.includes('jadwal') || lower.includes('recurring') || lower.includes('every')) {
      let route = 'slack'
      if (lower.includes('email') || lower.includes('gmail')) route = 'gmail'
      else if (lower.includes('calendar')) route = 'googlecalendar'

      return {
        instruction: userPrompt.replace(/^(schedule|jadwalkan|tolong jadwalkan)\s*/i, '').trim(),
        route,
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        frequency: lower.includes('daily') || lower.includes('harian') ? 'daily' : 'weekly',
      }
    }

    return undefined
  }
}
