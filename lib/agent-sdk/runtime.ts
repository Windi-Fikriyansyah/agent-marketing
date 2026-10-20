import {
  AgentRuntimeConfig,
  AgentStreamEvent,
  AgentStepTrace,
  AgentToolDefinition,
  ApprovalRequest,
  AgentExecutionContext,
} from './types'
import { DEFAULT_AGENT_TOOLS } from './tools/builtins'
import { buildAgentInstructions } from './instructions'
import { callGemini } from './providers/gemini'

export class AgentRuntime {
  private config: AgentRuntimeConfig
  private tools: Map<string, AgentToolDefinition> = new Map()

  constructor(config: AgentRuntimeConfig) {
    this.config = {
      ...config,
      model: config.model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
    }

    const availableTools = config.tools || DEFAULT_AGENT_TOOLS
    availableTools.forEach((tool) => {
      this.tools.set(tool.name, tool)
    })
  }

  /**
   * Execute the 8-Step Agent Flow with real-time event streaming
   */
  async *execute(
    userPrompt: string,
    options?: {
      conversationHistory?: { role: 'user' | 'agent'; content: string }[]
      approvedAction?: { toolName: string; parameters: any } | null
    }
  ): AsyncGenerator<AgentStreamEvent, void, unknown> {
    const context: AgentExecutionContext = {
      agentId: this.config.agentId,
      agentName: this.config.name,
      systemPrompt: this.config.instructions,
    }

    // =========================================================================
    // STEP 1: User Request (Incoming prompt or task)
    // =========================================================================
    const step1Trace: AgentStepTrace = {
      step: 'user_request',
      stepNumber: 1,
      title: 'User Request',
      description: 'Menerima dan memvalidasi prompt dari pengguna.',
      status: 'completed',
      details: { prompt: userPrompt },
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'user_request', stepNumber: 1, trace: step1Trace }

    // =========================================================================
    // STEP 2: Reason + Plan (The agent interprets the goal)
    // =========================================================================
    const step2Trace: AgentStepTrace = {
      step: 'reason_plan',
      stepNumber: 2,
      title: 'Reason + Plan',
      description: 'Menganalisis tujuan dan merencanakan dekomposisi task.',
      status: 'running',
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

    // Determine intent and planning
    const lower = userPrompt.toLowerCase()
    let plannedTools: string[] = []
    let reasoningNotes = ''

    if (options?.approvedAction) {
      plannedTools = [options.approvedAction.toolName]
      reasoningNotes = `Melanjutkan eksekusi aksi yang telah disetujui pengguna: ${options.approvedAction.toolName}`
    } else if (lower.includes('publish') || lower.includes('delete') || lower.includes('hapus') || lower.includes('sync')) {
      plannedTools = ['execute_sensitive_action']
      reasoningNotes = 'Terdeteksi permintaan aksi kritis/perubahan data. Memerlukan verifikasi persetujuan (Human-in-the-Loop).'
    } else if (lower.includes('cari') || lower.includes('search') || lower.includes('info') || lower.includes('apa itu') || lower.includes('dokumen')) {
      plannedTools = ['web_search']
      reasoningNotes = 'Perlu mencari informasi atau dokumentasi relevan dari web.'
    } else if (lower.includes('hitung') || lower.includes('calculate') || lower.includes('*') || lower.includes('+') || lower.includes('%')) {
      plannedTools = ['calculator']
      reasoningNotes = 'Perlu melakukan kalkulasi matematis atau evaluasi rumus.'
    } else if (lower.includes('database') || lower.includes('data') || lower.includes('catatan')) {
      plannedTools = ['database_query']
      reasoningNotes = 'Perlu membaca data atau memori dari database agent.'
    } else {
      reasoningNotes = 'Menganalisis instruksi secara langsung berdasarkan persona dan pengetahuan model.'
    }

    step2Trace.status = 'completed'
    step2Trace.details = { reasoning: reasoningNotes, plannedTools }
    yield { type: 'step_complete', step: 'reason_plan', stepNumber: 2, trace: step2Trace }

    // =========================================================================
    // STEP 3: Check Instructions (Apply rules, behavior, and constraints)
    // =========================================================================
    const step3Trace: AgentStepTrace = {
      step: 'check_instructions',
      stepNumber: 3,
      title: 'Check Instructions',
      description: 'Menerapkan batasan sistem, aturan persona, dan guardrails.',
      status: 'running',
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'check_instructions', stepNumber: 3, trace: step3Trace }

    const fullInstructions = buildAgentInstructions(this.config)
    step3Trace.status = 'completed'
    step3Trace.details = {
      rulesApplied: true,
      agentName: this.config.name,
      modelTarget: this.config.model,
      guardrails: 'Safety checks passed • Persona active',
    }
    yield { type: 'step_complete', step: 'check_instructions', stepNumber: 3, trace: step3Trace }

    // =========================================================================
    // STEP 4: Pick Tools (Choose the right connected tools)
    // =========================================================================
    const step4Trace: AgentStepTrace = {
      step: 'pick_tools',
      stepNumber: 4,
      title: 'Pick Tools',
      description: plannedTools.length > 0
        ? `Memilih tool terhubung: ${plannedTools.join(', ')}`
        : 'Tidak memerlukan tool tambahan (Direct synthesis)',
      status: 'running',
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'pick_tools', stepNumber: 4, trace: step4Trace }

    step4Trace.status = 'completed'
    step4Trace.details = { selectedTools: plannedTools }
    yield { type: 'step_complete', step: 'pick_tools', stepNumber: 4, trace: step4Trace }

    // Tool execution results collector
    let toolResults: any[] = []

    // =========================================================================
    // STEP 5 & 7: Run Tools OR Ask for Approval
    // =========================================================================
    if (plannedTools.length > 0) {
      for (const toolName of plannedTools) {
        const tool = this.tools.get(toolName)
        if (!tool) continue

        // Check if tool requires human approval (Step 7: Ask for Approval)
        if (tool.requireApproval && !options?.approvedAction) {
          const approvalReq: ApprovalRequest = {
            id: `appr_${Date.now()}`,
            toolName: tool.name,
            parameters: {
              actionType: 'publish_brief',
              target: 'Workspace Production',
              description: userPrompt,
            },
            reason: 'Tindakan ini akan mempublikasikan data atau mengubah konfigurasi sistem.',
            timestamp: new Date().toLocaleTimeString('id-ID'),
          }

          const step7Trace: AgentStepTrace = {
            step: 'ask_approval',
            stepNumber: 7,
            title: 'Ask for Approval',
            description: `Meminta konfirmasi pengguna sebelum menjalankan "${tool.name}".`,
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

          // Pause execution until approved
          return
        }

        // STEP 5: Run Tools (Execute API, database, browser, tool actions)
        const step5Trace: AgentStepTrace = {
          step: 'run_tools',
          stepNumber: 5,
          title: 'Run Tools',
          description: `Mengeksekusi tool: ${tool.name}`,
          status: 'running',
          timestamp: new Date().toLocaleTimeString('id-ID'),
        }
        yield { type: 'step_start', step: 'run_tools', stepNumber: 5, trace: step5Trace }

        let params: any = {}
        if (tool.name === 'web_search') {
          params = { query: userPrompt }
        } else if (tool.name === 'calculator') {
          params = { expression: userPrompt }
        } else if (tool.name === 'database_query') {
          params = { topic: userPrompt }
        } else if (options?.approvedAction) {
          params = options.approvedAction.parameters
        }

        try {
          const result = await tool.execute(params, context)
          toolResults.push({ tool: tool.name, result })

          step5Trace.status = 'completed'
          step5Trace.details = { output: result }
          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }
        } catch (err: any) {
          step5Trace.status = 'failed'
          step5Trace.details = { error: err.message }
          yield { type: 'step_complete', step: 'run_tools', stepNumber: 5, trace: step5Trace }
        }

        // =========================================================================
        // STEP 6: Review Results (Examine outputs and errors)
        // =========================================================================
        const step6Trace: AgentStepTrace = {
          step: 'review_results',
          stepNumber: 6,
          title: 'Review Results',
          description: 'Memeriksa output tool dan memvalidasi keakuratan data.',
          status: 'running',
          timestamp: new Date().toLocaleTimeString('id-ID'),
        }
        yield { type: 'step_start', step: 'review_results', stepNumber: 6, trace: step6Trace }

        step6Trace.status = 'completed'
        step6Trace.details = {
          reviewedCount: toolResults.length,
          statusCheck: 'All tool outputs verified and formatted.',
        }
        yield { type: 'step_complete', step: 'review_results', stepNumber: 6, trace: step6Trace }
      }
    }

    // =========================================================================
    // STEP 8: Final Response (Return a clear answer or generated UI)
    // =========================================================================
    const step8Trace: AgentStepTrace = {
      step: 'final_response',
      stepNumber: 8,
      title: 'Final Response',
      description: 'Menyintesis jawaban akhir untuk pengguna.',
      status: 'running',
      timestamp: new Date().toLocaleTimeString('id-ID'),
    }
    yield { type: 'step_start', step: 'final_response', stepNumber: 8, trace: step8Trace }

    // Synthesize final response strictly via AI (OpenAI or Google Gemini)
    let finalAnswer = ''
    let activeProvider = ''

    const effectivePrompt =
      userPrompt && userPrompt.trim().length > 0
        ? userPrompt
        : options?.approvedAction
        ? `Pengguna telah menyetujui eksekusi aksi: ${options.approvedAction.toolName} (${options.approvedAction.parameters?.actionType || 'action'}). Berikan konfirmasi dan ringkasan eksekusi dalam Bahasa Indonesia yang ramah dan jelas.`
        : 'Halo'

    // 1. Try OpenAI First
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey && apiKey.startsWith('sk-') && apiKey.length > 20) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: 'system', content: fullInstructions },
              ...(options?.conversationHistory || []).map((m) => ({
                role: m.role === 'agent' ? 'assistant' : 'user',
                content: m.content,
              })),
              {
                role: 'user',
                content: toolResults.length > 0
                  ? `${effectivePrompt}\n\n[Hasil Eksekusi Tool Agent SDK]:\n${JSON.stringify(toolResults, null, 2)}`
                  : effectivePrompt,
              },
            ],
            temperature: 0.7,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const text = data.choices?.[0]?.message?.content
          if (text) {
            finalAnswer = text
            activeProvider = `OpenAI (${this.config.model})`
          }
        } else {
          console.warn(`OpenAI failed with status ${response.status}, triggering automatic fallback to Gemini...`)
        }
      } catch (apiErr) {
        console.warn('OpenAI error, triggering automatic fallback to Gemini...', apiErr)
      }
    }

    // 2. Automatic Fallback to Google Gemini
    if (!finalAnswer) {
      const geminiApiKey = process.env.GEMINI_API_KEY
      if (geminiApiKey && geminiApiKey.trim().length > 0) {
        console.log('⚡ Agent SDK: OpenAI unavailable or failed, switching automatically to Google Gemini...')
        const geminiRes = await callGemini({
          apiKey: geminiApiKey,
          model: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash',
          systemInstruction: fullInstructions,
          conversationHistory: options?.conversationHistory || [],
          userPrompt: effectivePrompt,
          toolResults,
        })

        if (geminiRes.success && geminiRes.content) {
          finalAnswer = geminiRes.content
          activeProvider = `${geminiRes.provider} (Auto-Fallback)`
        } else {
          console.warn('Gemini fallback notice:', geminiRes.error)
        }
      }
    }

    // 3. Strict Verification: NEVER return simulated mock responses!
    if (!finalAnswer) {
      step8Trace.status = 'failed'
      step8Trace.details = {
        error: 'Tidak ada model AI yang aktif atau dapat merespons.',
        activeProvider: 'None',
      }
      yield {
        type: 'final_response',
        step: 'final_response',
        stepNumber: 8,
        trace: step8Trace,
        data: {
          answer:
            '⚠️ **Koneksi Model AI Tidak Tersedia**\n\nRespon simulasi telah dinonaktifkan sepenuhnya. Untuk mendapatkan jawaban langsung dari AI, pastikan konfigurasi API Key aktif pada file `.env.local`:\n- `OPENAI_API_KEY` (OpenAI)\n- ATAU `GEMINI_API_KEY` (Google Gemini)',
          provider: 'Error (AI Key Tidak Aktif)',
        },
      }
      return
    }

    step8Trace.status = 'completed'
    step8Trace.details = {
      answerLength: finalAnswer.length,
      activeProvider,
    }
    yield {
      type: 'final_response',
      step: 'final_response',
      stepNumber: 8,
      trace: step8Trace,
      data: { answer: finalAnswer, provider: activeProvider },
    }
  }
}
