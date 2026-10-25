/**
 * Centralized OpenRouter LLM Provider for Agent SDK
 * Conforms to OpenAI-compatible Chat Completions API specification:
 * https://openrouter.ai/docs
 *
 * Supports:
 * - Native Function/Tool Calling
 * - Real-time SSE Token Streaming
 * - Delta accumulation for fragmented tool_call arguments
 * - JSON argument validation with error recovery (no crash)
 * - Provider fallback and observability (token usage, serving model)
 */

import { AgentToolDefinition } from '../types'

export interface OpenRouterStreamChunk {
  type: 'token' | 'function_call' | 'error' | 'meta'
  token?: string
  functionCall?: {
    id: string
    name: string
    args: Record<string, any>
  }
  meta?: {
    servingModel?: string
    usage?: {
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
    }
  }
  error?: string
}

export interface StreamOpenRouterOptions {
  apiKey?: string
  baseUrl?: string
  model: string
  fallbackModels?: string[]
  systemInstruction?: string
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool'
    content?: string | null
    tool_calls?: any[]
    tool_call_id?: string
    name?: string
  }>
  tools?: AgentToolDefinition[]
  temperature?: number
  maxTokens?: number
  appUrl?: string
  appName?: string
}

/**
 * Converts AgentToolDefinition (Zod) to OpenAI-compatible Function Schema for OpenRouter
 */
export function convertToolsToOpenAISchema(tools: AgentToolDefinition[]): any[] {
  if (!tools || tools.length === 0) return []

  return tools.map((t) => {
    let jsonParameters: any = { type: 'object', properties: {} }

    try {
      if (t.parameters && typeof (t.parameters as any).safeParse === 'function') {
        const shape = (t.parameters as any).shape
        if (shape) {
          const properties: Record<string, any> = {}
          const required: string[] = []

          for (const key of Object.keys(shape)) {
            const field = shape[key]
            let description = field.description || ''
            let type = 'string'

            const defName = field.constructor?.name || ''
            if (defName.includes('Number')) type = 'number'
            else if (defName.includes('Boolean')) type = 'boolean'
            else if (defName.includes('Array')) type = 'array'
            else if (defName.includes('Object')) type = 'object'

            properties[key] = { type, description }
            if (!defName.includes('Optional') && !defName.includes('Nullable')) {
              required.push(key)
            }
          }

          jsonParameters = {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
          }
        }
      }
    } catch {
      jsonParameters = { type: 'object', properties: {} }
    }

    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: jsonParameters,
      },
    }
  })
}

/**
 * Streams a turn from OpenRouter with delta accumulation for tool calls.
 * Handles fallbacks if the primary model fails or encounters errors.
 */
export async function* streamOpenRouterTurn(
  options: StreamOpenRouterOptions
): AsyncGenerator<
  OpenRouterStreamChunk,
  {
    text: string
    functionCalls: Array<{ id: string; name: string; args: any }>
    servingModel: string
    usage?: any
  },
  unknown
> {
  const apiKey = (options.apiKey || process.env.OPENROUTER_API_KEY || '').trim()
  const baseUrl = (options.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const appUrl = options.appUrl || process.env.OPENROUTER_APP_URL || 'https://agent-marketing.local'
  const appName = options.appName || process.env.OPENROUTER_APP_NAME || 'Agent Marketing'

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY belum dikonfigurasi di lingkungan (.env.local).')
  }

  // Model list to try: primary model first, followed by fallbacks
  const candidateModels: string[] = [options.model]
  if (options.fallbackModels && options.fallbackModels.length > 0) {
    options.fallbackModels.forEach((fm) => {
      if (fm && !candidateModels.includes(fm.trim())) candidateModels.push(fm.trim())
    })
  } else if (process.env.OPENROUTER_FALLBACK_MODELS) {
    process.env.OPENROUTER_FALLBACK_MODELS.split(',').forEach((fm) => {
      const clean = fm.trim()
      if (clean && !candidateModels.includes(clean)) candidateModels.push(clean)
    })
  }

  const openAITools = convertToolsToOpenAISchema(options.tools || [])

  // Build messages array
  const formattedMessages: any[] = []
  if (options.systemInstruction) {
    formattedMessages.push({
      role: 'system',
      content: options.systemInstruction,
    })
  }

  options.messages.forEach((m) => {
    formattedMessages.push({
      role: m.role,
      content: m.content || (m.role === 'tool' ? '' : null),
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    })
  })

  let lastError: any = null

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx]
    const isFallback = mIdx > 0

    if (isFallback) {
      console.warn(`[OpenRouter] Mengalihkan ke model fallback: ${currentModel} (percobaan ${mIdx + 1}/${candidateModels.length})`)
    }

    const payload: any = {
      model: currentModel,
      messages: formattedMessages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }

    if (openAITools.length > 0) {
      payload.tools = openAITools
      payload.tool_choice = 'auto'
    }

    const maxRetries = 2
    let res: Response | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': appUrl,
            'X-Title': appName,
          },
          body: JSON.stringify(payload),
        })

        // Retry on 429 rate limit or 5xx temporary upstream errors
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          const waitTime = (attempt + 1) * 3000
          console.warn(`[OpenRouter] Status ${res.status} pada ${currentModel}, mencoba lagi dalam ${waitTime}ms...`)
          await new Promise((r) => setTimeout(r, waitTime))
          continue
        }
        break
      } catch (networkErr: any) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000))
          continue
        }
        lastError = networkErr
        break
      }
    }

    if (!res || !res.ok) {
      const errBody = res ? await res.text() : String(lastError?.message || 'Network error')
      console.warn(`[OpenRouter Error pada model ${currentModel} (${res?.status || 500})]: ${errBody.slice(0, 300)}`)

      // If there are fallback models available, continue to next model
      if (mIdx < candidateModels.length - 1) {
        lastError = new Error(`OpenRouter (${currentModel}): ${errBody.slice(0, 200)}`)
        continue
      }
      throw new Error(`OpenRouter API error (${res?.status || 500}): ${errBody}`)
    }

    if (!res.body) {
      if (mIdx < candidateModels.length - 1) continue
      throw new Error('Respon OpenRouter tidak menyertakan readable stream body.')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let servingModel = currentModel
    let finalUsage: any = null

    // Map to accumulate fragmented tool_calls delta: index -> { id, name, arguments }
    const accumulatedToolCalls: Record<number, { id: string; name: string; arguments: string }> = {}

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const dataStr = trimmed.replace(/^data:\s*/, '').trim()
          if (dataStr === '[DONE]') continue
          if (!dataStr) continue

          try {
            const parsed = JSON.parse(dataStr)

            // Capture actual serving model and usage from OpenRouter headers/chunks
            if (parsed.model) servingModel = parsed.model
            if (parsed.usage) finalUsage = parsed.usage

            const choice = parsed.choices?.[0]
            if (!choice) continue

            const delta = choice.delta
            if (!delta) continue

            // 1. Text token streaming
            if (delta.content) {
              fullText += delta.content
              yield { type: 'token', token: delta.content }
            }

            // 2. Fragmented Tool Call accumulation
            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
              for (const tcDelta of delta.tool_calls) {
                const idx = tcDelta.index ?? 0
                if (!accumulatedToolCalls[idx]) {
                  accumulatedToolCalls[idx] = {
                    id: tcDelta.id || `call_${Date.now()}_${idx}`,
                    name: '',
                    arguments: '',
                  }
                }

                if (tcDelta.id) accumulatedToolCalls[idx].id = tcDelta.id
                if (tcDelta.function?.name) {
                  accumulatedToolCalls[idx].name += tcDelta.function.name
                }
                if (tcDelta.function?.arguments) {
                  accumulatedToolCalls[idx].arguments += tcDelta.function.arguments
                }
              }
            }
          } catch {
            // Ignore single malformed SSE chunk parse error
          }
        }
      }
    } catch (streamErr: any) {
      if (mIdx < candidateModels.length - 1) {
        console.warn(`[OpenRouter] Stream terputus pada ${currentModel}, mencoba fallback berikutnya...`)
        continue
      }
      throw streamErr
    }

    // Process and validate reconstructed tool calls
    const completedFunctionCalls: Array<{ id: string; name: string; args: any }> = []

    for (const key of Object.keys(accumulatedToolCalls)) {
      const tc = accumulatedToolCalls[Number(key)]
      if (!tc.name) continue

      let parsedArgs: Record<string, any> = {}
      const rawArgs = tc.arguments.trim()

      if (rawArgs.length > 0) {
        try {
          parsedArgs = JSON.parse(rawArgs)
        } catch (jsonErr: any) {
          console.warn(`[OpenRouter] Argumen JSON tool '${tc.name}' tidak valid: "${rawArgs}". Melakukan recovery...`)
          // Self-healing attempt: sanitize trailing commas or unescaped quotes
          try {
            const sanitized = rawArgs.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
            parsedArgs = JSON.parse(sanitized)
          } catch {
            // Error ditandai dalam args agar agent loop dapat mengembalikan pesan koreksi ke model (tanpa crash)
            parsedArgs = {
              _parse_error: true,
              raw: rawArgs,
              error: `JSON arguments parsing failed: ${jsonErr.message}`,
            }
          }
        }
      }

      completedFunctionCalls.push({
        id: tc.id,
        name: tc.name,
        args: parsedArgs,
      })

      yield {
        type: 'function_call',
        functionCall: {
          id: tc.id,
          name: tc.name,
          args: parsedArgs,
        },
      }
    }

    // Emit metadata (serving model & usage)
    yield {
      type: 'meta',
      meta: {
        servingModel,
        usage: finalUsage,
      },
    }

    return {
      text: fullText,
      functionCalls: completedFunctionCalls,
      servingModel,
      usage: finalUsage,
    }
  }

  throw new Error(`Semua kandidat model OpenRouter gagal. Error terakhir: ${lastError?.message || 'Tidak ada respons valid.'}`)
}
