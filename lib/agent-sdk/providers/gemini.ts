/**
 * Google Gemini Provider for Agent SDK
 * Supports native Tool Calling (functionDeclarations) and SSE Token Streaming
 */
import { z } from 'zod'
import { AgentToolDefinition } from '../types'

export interface GeminiStreamChunk {
  type: 'token' | 'function_call'
  token?: string
  functionCall?: {
    name: string
    args: Record<string, any>
  }
}

export function zodFieldToGemini(field: any): any {
  let cur = field
  let description = cur.description
  if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) {
    cur = cur.unwrap()
    if (!description && cur.description) description = cur.description
  }
  if (cur instanceof z.ZodString) {
    return { type: 'string', description }
  }
  if (cur instanceof z.ZodNumber) {
    return { type: 'number', description }
  }
  if (cur instanceof z.ZodBoolean) {
    return { type: 'boolean', description }
  }
  if (cur instanceof z.ZodEnum) {
    return { type: 'string', enum: cur._def.values, description }
  }
  if (cur instanceof z.ZodArray) {
    return { type: 'array', items: zodFieldToGemini(cur._def.type), description }
  }
  return { type: 'string', description }
}

export function zodToGeminiParameters(schema: any): any {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    const properties: Record<string, any> = {}
    const required: string[] = []
    for (const key of Object.keys(shape)) {
      const field = shape[key]
      properties[key] = zodFieldToGemini(field)
      if (!(field instanceof z.ZodOptional) && !(field instanceof z.ZodNullable)) {
        required.push(key)
      }
    }
    return { type: 'object', properties, required }
  }
  return { type: 'object', properties: {} }
}

export interface StreamGeminiOptions {
  apiKey: string
  model?: string
  systemInstruction?: string
  contents: Array<{
    role: 'user' | 'model'
    parts: Array<any>
  }>
  tools?: AgentToolDefinition[]
}

/**
 * Streams a turn from Google Gemini with function calling and token emission
 */
export async function* streamGeminiTurn(
  options: StreamGeminiOptions
): AsyncGenerator<GeminiStreamChunk, { text: string; functionCalls: Array<{ name: string; args: any }>; provider: string }, unknown> {
  const { apiKey, systemInstruction, contents, tools = [] } = options
  const model = options.model || process.env.GEMINI_DEFAULT_MODEL || 'gemini-flash-latest'

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di .env.local.')
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey.trim()}`

  const payload: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  }

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    }
  }

  if (tools.length > 0) {
    payload.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: zodToGeminiParameters(t.parameters),
        })),
      },
    ]
  }

  let res: Response | null = null
  const maxRetries = 3

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.status === 429 && attempt < maxRetries) {
      const waitTime = (attempt + 1) * 6000
      console.warn(`[Gemini Provider] Rate limit (429) hit, retrying in ${waitTime}ms...`)
      await new Promise((r) => setTimeout(r, waitTime))
      continue
    }
    break
  }

  if (!res || !res.ok) {
    const errBody = res ? await res.text() : 'No response from Gemini API'
    console.error('[Gemini API Full Error Body]:', errBody)
    throw new Error(`Gemini API error (${res?.status || 500}): ${errBody}`)
  }

  if (!res.body) {
    throw new Error('Respon Gemini tidak menyertakan readable stream body.')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const functionCalls: Array<{ name: string; args: any }> = []

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const jsonStr = trimmed.replace('data: ', '').trim()
      if (!jsonStr) continue

      try {
        const chunk = JSON.parse(jsonStr)
        const candidates = chunk.candidates || []
        for (const candidate of candidates) {
          const parts = candidate.content?.parts || []
          for (const part of parts) {
            if (part.functionCall) {
              const fc = {
                name: part.functionCall.name,
                args: part.functionCall.args || {},
              }
              functionCalls.push(fc)
              yield { type: 'function_call', functionCall: fc }
            }
            if (part.text) {
              fullText += part.text
              yield { type: 'token', token: part.text }
            }
          }
        }
      } catch {
        // Continue buffering if JSON split across chunks
      }
    }
  }

  return {
    text: fullText,
    functionCalls,
    provider: `Google Gemini (${model})`,
  }
}

/**
 * Non-streaming call (compatibility)
 */
export async function callGemini(options: {
  apiKey: string
  model?: string
  systemInstruction?: string
  conversationHistory?: { role: 'user' | 'agent'; content: string }[]
  userPrompt: string
  toolResults?: any[]
}): Promise<{
  success: boolean
  content?: string
  provider: string
  error?: string
}> {
  const contents: any[] = []
  for (const m of options.conversationHistory || []) {
    contents.push({
      role: m.role === 'agent' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  }

  let text = options.userPrompt
  if (options.toolResults && options.toolResults.length > 0) {
    text += `\n\n[Hasil Eksekusi Tool]:\n${JSON.stringify(options.toolResults, null, 2)}`
  }
  contents.push({ role: 'user', parts: [{ text }] })

  try {
    const gen = streamGeminiTurn({
      apiKey: options.apiKey,
      model: options.model,
      systemInstruction: options.systemInstruction,
      contents,
    })

    let fullText = ''
    for await (const chunk of gen) {
      if (chunk.type === 'token' && chunk.token) {
        fullText += chunk.token
      }
    }
    return {
      success: true,
      content: fullText,
      provider: `Google Gemini (${options.model || 'gemini-flash-latest'})`,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      provider: 'Google Gemini',
    }
  }
}
