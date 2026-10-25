/**
 * Dynamic OpenRouter Models Catalog & Validation Service
 * Conforms to KEBUTUHAN B in user specification.
 *
 * Features:
 * - Fetches real-time model catalog from OpenRouter /api/v1/models
 * - In-memory caching with 1-hour TTL
 * - Determines "agent-readiness": supports 'tools' & context_length >= MIN_CONTEXT_LENGTH (64k)
 * - Metadata extraction: id, name, context_length, pricing, modalities, supported_parameters
 */

export interface OpenRouterModelMetadata {
  id: string
  name: string
  description?: string
  contextLength: number
  pricing: {
    prompt: number
    completion: number
  }
  inputModalities: string[]
  outputModalities: string[]
  supportedParameters: string[]
  supportsTools: boolean
  supportsVision: boolean
  isAgentReady: boolean
  warning?: string
}

let cachedModels: OpenRouterModelMetadata[] | null = null
let cacheExpiry: number = 0
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function fetchOpenRouterCatalog(forceRefresh: boolean = false): Promise<OpenRouterModelMetadata[]> {
  const now = Date.now()
  if (!forceRefresh && cachedModels && now < cacheExpiry) {
    return cachedModels
  }

  const minContextLength = parseInt(process.env.MIN_CONTEXT_LENGTH || '64000', 10)
  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const apiKey = process.env.OPENROUTER_API_KEY || ''

  try {
    const headers: Record<string, string> = {}
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers,
    })

    if (!res.ok) {
      throw new Error(`OpenRouter models API returned ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    const rawList: any[] = data.data || []

    cachedModels = rawList.map((m: any) => {
      const supportedParams: string[] = m.supported_parameters || []
      const supportsTools = supportedParams.includes('tools')
      const contextLength = m.context_length || 0
      const isContextSufficient = contextLength >= minContextLength
      const isAgentReady = supportsTools && isContextSufficient

      const inputModalities = m.architecture?.input_modalities || ['text']
      const outputModalities = m.architecture?.output_modalities || ['text']
      const supportsVision = inputModalities.includes('image')

      let warning: string | undefined = undefined
      if (!supportsTools) {
        warning = 'Model ini tidak mendukung function/tool calling, tidak dapat dipakai untuk mode agent.'
      } else if (!isContextSufficient) {
        warning = `Panjang konteks (${contextLength}) kurang dari batas minimum ${minContextLength} token.`
      }

      const promptPrice = parseFloat(m.pricing?.prompt || '0') * 1000000
      const completionPrice = parseFloat(m.pricing?.completion || '0') * 1000000

      return {
        id: m.id,
        name: m.name || m.id,
        description: m.description,
        contextLength,
        pricing: {
          prompt: promptPrice, // per 1M tokens in USD
          completion: completionPrice, // per 1M tokens in USD
        },
        inputModalities,
        outputModalities,
        supportedParameters: supportedParams,
        supportsTools,
        supportsVision,
        isAgentReady,
        warning,
      }
    })

    cacheExpiry = now + CACHE_TTL_MS
    return cachedModels
  } catch (err: any) {
    console.error('[OpenRouter Catalog Fetch Error]:', err.message)
    // If cache exists even if expired, fallback to it
    if (cachedModels && cachedModels.length > 0) {
      console.warn('[OpenRouter Catalog] Menggunakan cache lama karena fetch gagal.')
      return cachedModels
    }
    throw err
  }
}

/**
 * Validates a model ID for agent usage.
 * Returns { valid: boolean, reason?: string, model?: OpenRouterModelMetadata }
 */
export async function validateAgentModel(modelId: string): Promise<{
  valid: boolean
  reason?: string
  model?: OpenRouterModelMetadata
}> {
  const catalog = await fetchOpenRouterCatalog()
  const found = catalog.find((m) => m.id.toLowerCase() === modelId.trim().toLowerCase())

  if (!found) {
    return {
      valid: false,
      reason: `Model '${modelId}' tidak ditemukan di katalog OpenRouter.`,
    }
  }

  if (!found.supportsTools) {
    return {
      valid: false,
      reason: `Model '${found.name}' (${found.id}) tidak mendukung tool calling. Silakan pilih model yang mendukung tools.`,
      model: found,
    }
  }

  const minContext = parseInt(process.env.MIN_CONTEXT_LENGTH || '64000', 10)
  if (found.contextLength < minContext) {
    return {
      valid: false,
      reason: `Model '${found.name}' memiliki context length (${found.contextLength}) yang lebih kecil dari ${minContext}.`,
      model: found,
    }
  }

  return { valid: true, model: found }
}
