import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // If Supabase redirected here with an explicit error in query params
  if (error || errorDescription) {
    const message = errorDescription || error || 'Tautan autentikasi tidak valid atau telah kedaluwarsa.'
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`)
  }

  // Handle token_hash verification (standard Supabase email confirmation)
  if (token_hash && type) {
    const supabase = await createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!verifyError) {
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(verifyError.message)}`
      )
    }
  }

  // Handle PKCE code exchange
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } else {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      )
    }
  }

  // Fallback if no valid code or token was provided
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Tautan verifikasi tidak valid atau sesi telah kedaluwarsa. Silakan coba masuk kembali.')}`
  )
}
