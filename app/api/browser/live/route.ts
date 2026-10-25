import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveBrowserSession, closeBrowserSession, cleanupOrphanSessions } from '@/lib/browser/manager'
import { composioService } from '@/lib/composio/client'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    let authUserId: string | undefined = undefined
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      authUserId = user?.id || user?.email || undefined
    } catch {}

    const searchParams = req.nextUrl.searchParams
    const rawUserId = authUserId || searchParams.get('userId') || 'default_user'
    const effectiveUserId = await composioService.resolveCanonicalUserId(rawUserId)

    const session = getActiveBrowserSession(effectiveUserId)
    if (!session) {
      return NextResponse.json({ active: false })
    }

    return NextResponse.json({
      active: true,
      sessionId: session.sessionId,
      debuggerUrl: session.debuggerUrl,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    let authUserId: string | undefined = undefined
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      authUserId = user?.id || user?.email || undefined
    } catch {}

    const body = await req.json().catch(() => ({}))
    const rawUserId = authUserId || body.userId || 'default_user'
    const effectiveUserId = await composioService.resolveCanonicalUserId(rawUserId)

    const closed = await closeBrowserSession(effectiveUserId)

    return NextResponse.json({
      success: true,
      closed,
      message: closed ? 'Sesi browser cloud berhasil ditutup.' : 'Tidak ada sesi aktif.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  return POST(req)
}

/**
 * PUT: Membersihkan orphan / expired browser sessions (Cron / Maintenance Handler)
 */
export async function PUT() {
  try {
    const result = await cleanupOrphanSessions()
    return NextResponse.json({
      success: true,
      cleanedCount: result.cleanedCount,
      message: `Berhasil membersihkan ${result.cleanedCount} sesi browser kedaluwarsa.`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal membersihkan orphan sessions' }, { status: 500 })
  }
}
