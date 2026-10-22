/**
 * Google Gemini Provider for Agent SDK with Real Native Function Calling
 * Connects directly to Google Generative Language API
 */

export interface GeminiToolDeclaration {
  name: string
  description: string
  parameters: {
    type: 'OBJECT'
    properties: Record<string, {
      type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT'
      description?: string
      enum?: string[]
    }>
    required?: string[]
  }
}

export interface GeminiMessagePart {
  text?: string
  functionCall?: {
    name: string
    args: Record<string, any>
  }
  functionResponse?: {
    name: string
    response: Record<string, any>
  }
}

export interface GeminiContent {
  role: 'user' | 'model' | 'function'
  parts: GeminiMessagePart[]
}

export interface GeminiRunOptions {
  apiKey: string
  model?: string
  systemInstruction?: string
  contents: GeminiContent[]
  tools?: GeminiToolDeclaration[]
  temperature?: number
}

export interface GeminiRunResult {
  success: boolean
  content?: string
  functionCalls?: Array<{
    name: string
    args: Record<string, any>
  }>
  rawCandidate?: any
  provider: string
  error?: string
}

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
]

export async function callGeminiRaw(options: GeminiRunOptions): Promise<GeminiRunResult> {
  const { apiKey, systemInstruction, contents, tools = [], temperature = 0.5 } = options
  const targetModel = options.model || process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash'

  if (!apiKey || apiKey.trim().length === 0) {
    return {
      success: false,
      provider: 'Google Gemini',
      error: 'GEMINI_API_KEY tidak ditemukan. Harap tambahkan di .env.local',
    }
  }

  // Format request payload
  const payload: any = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: 2048,
    },
  }

  if (systemInstruction && systemInstruction.trim().length > 0) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    }
  }

  if (tools && tools.length > 0) {
    payload.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: {
            type: 'OBJECT',
            properties: t.parameters.properties,
            required: t.parameters.required || [],
          },
        })),
      },
    ]
  }

  const modelsToTry = Array.from(new Set([targetModel, ...CANDIDATE_MODELS]))
  let lastError = 'No models responded'

  for (const modelName of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorText = await res.text()
        lastError = `Model ${modelName} returned HTTP ${res.status}: ${errorText.slice(0, 200)}`
        console.warn(`[Gemini Provider] ${modelName} failed (${res.status}), trying next candidate...`)
        continue
      }

      const data = await res.json()
      const candidate = data.candidates?.[0]
      if (!candidate) {
        lastError = `Model ${modelName} returned empty candidate`
        continue
      }

      const parts: GeminiMessagePart[] = candidate.content?.parts || []
      const functionCalls: Array<{ name: string; args: Record<string, any> }> = []
      let textContent = ''

      for (const part of parts) {
        if (part.functionCall) {
          functionCalls.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {},
          })
        }
        if (part.text) {
          textContent += (textContent ? '\n' : '') + part.text
        }
      }

      return {
        success: true,
        content: textContent,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        rawCandidate: candidate,
        provider: `Google Gemini (${modelName})`,
      }
    } catch (err: any) {
      lastError = err.message || 'Network error'
      console.warn(`[Gemini Provider] Network error with ${modelName}:`, err)
    }
  }

  return {
    success: false,
    provider: 'Google Gemini',
    error: lastError,
  }
}
