import { NextRequest, NextResponse } from 'next/server'
import { fetchOpenRouterCatalog, validateAgentModel } from '@/lib/agent-sdk/models/catalog'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') || '').toLowerCase().trim()
    const toolsOnly = searchParams.get('toolsOnly') === 'true'
    const agentReadyOnly = searchParams.get('agentReadyOnly') === 'true'
    const visionOnly = searchParams.get('visionOnly') === 'true'
    const sortBy = searchParams.get('sortBy') || 'agent_ready'
    const refresh = searchParams.get('refresh') === 'true'

    const catalog = await fetchOpenRouterCatalog(refresh)

    let filtered = catalog.filter((m) => {
      if (search && !m.id.toLowerCase().includes(search) && !m.name.toLowerCase().includes(search)) {
        return false
      }
      if (agentReadyOnly && !m.isAgentReady) return false
      if (toolsOnly && !m.supportsTools) return false
      if (visionOnly && !m.supportsVision) return false
      return true
    })

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'price_asc') {
        return a.pricing.prompt - b.pricing.prompt
      }
      if (sortBy === 'price_desc') {
        return b.pricing.prompt - a.pricing.prompt
      }
      if (sortBy === 'context_desc') {
        return b.contextLength - a.contextLength
      }
      if (sortBy === 'agent_ready') {
        if (a.isAgentReady !== b.isAgentReady) return a.isAgentReady ? -1 : 1
        return b.contextLength - a.contextLength
      }
      return a.name.localeCompare(b.name)
    })

    const totalEligible = catalog.filter((m) => m.isAgentReady).length
    const totalIneligible = catalog.length - totalEligible

    return NextResponse.json({
      total: catalog.length,
      eligibleAgentModels: totalEligible,
      ineligibleModels: totalIneligible,
      count: filtered.length,
      models: filtered,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal memuat katalog model OpenRouter' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { modelId } = body

    if (!modelId) {
      return NextResponse.json({ error: 'modelId is required' }, { status: 400 })
    }

    const validation = await validateAgentModel(modelId)
    return NextResponse.json(validation)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Validasi model gagal' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = await req.json()
    const { agentId, modelId } = body

    if (!agentId || !modelId) {
      return NextResponse.json({ error: 'agentId and modelId are required' }, { status: 400 })
    }

    // Validasi kelayakan model (KEBUTUHAN B: model harus valid dan layak agent)
    const validation = await validateAgentModel(modelId)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 })
    }

    let query = supabase.from('agents').update({ model: modelId, updated_at: new Date().toISOString() }).eq('id', agentId)
    if (user?.id) {
      query = query.eq('user_id', user.id)
    }
    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, modelId, model: validation.model })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
