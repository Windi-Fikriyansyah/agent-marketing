/**
 * Google Gemini Provider for Agent SDK (Automatic Fallback)
 * Connects directly to Google Generative Language API
 */

export interface GeminiCallOptions {
  apiKey: string
  model?: string
  systemInstruction?: string
  conversationHistory?: { role: 'user' | 'agent'; content: string }[]
  userPrompt: string
  toolResults?: any[]
}

export async function callGemini(options: GeminiCallOptions): Promise<{
  success: boolean
  content?: string
  provider: string
  error?: string
}> {
  const { apiKey, systemInstruction, conversationHistory = [], userPrompt, toolResults = [] } = options
  const model = options.model || process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash'

  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, provider: 'Google Gemini', error: 'No GEMINI_API_KEY provided.' }
  }

  try {
    // Format Gemini contents payload
    const contents: any[] = []

    // Map conversation history
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'agent' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }

    // Append latest user message + tool results context
    let currentMessageText = userPrompt
    if (toolResults.length > 0) {
      currentMessageText += `\n\n[Hasil Eksekusi Tool Agent SDK]:\n${JSON.stringify(toolResults, null, 2)}`
    }

    contents.push({
      role: 'user',
      parts: [{ text: currentMessageText }],
    })

    const payload: any = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      }
    }

    // Ordered candidate models for automatic multi-model redundancy
    const candidateModels = Array.from(
      new Set([
        model || 'gemini-flash-latest',
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-3.5-flash',
        'gemini-2.5-flash',
      ])
    )

    let lastError = 'No models available'

    for (const currentModel of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey.trim()}`

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errBody = await res.text()
          lastError = `Model ${currentModel} returned ${res.status}: ${errBody.slice(0, 150)}`
          console.warn(`Gemini model ${currentModel} error (${res.status}), trying next candidate...`)
          continue
        }

        const data = await res.json()
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (generatedText && generatedText.trim().length > 0) {
          return {
            success: true,
            content: generatedText,
            provider: `Google Gemini (${currentModel})`,
          }
        }
      } catch (err: any) {
        lastError = err.message || 'Network error'
        console.warn(`Gemini model ${currentModel} network error, trying next candidate...`, err)
      }
    }

    return {
      success: false,
      provider: 'Google Gemini',
      error: lastError,
    }
  } catch (err: any) {
    return {
      success: false,
      provider: 'Google Gemini',
      error: err.message || 'Network error calling Gemini API',
    }
  }
}
