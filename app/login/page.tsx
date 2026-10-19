'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  AlertCircle,
  CheckCircle2,
  Database,
  Terminal,
  KeyRound,
  ExternalLink,
  Info,
  X
} from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom')
  const initialError = searchParams.get('error')

  const getReadableError = (raw: string | null) => {
    if (!raw) return null
    if (raw.includes('Email link is invalid') || raw.includes('expired') || raw.includes('otp_expired')) {
      return 'Tautan email telah kedaluwarsa atau sudah pernah diklik sebelumnya. Jika akun Anda sudah terverifikasi, silakan langsung login dengan email dan kata sandi di bawah.'
    }
    if (raw.includes('Could not authenticate') || raw.includes('invalid_grant')) {
      return 'Tautan verifikasi sesi sudah tidak berlaku atau sudah terpakai. Silakan coba langsung login menggunakan email dan kata sandi Anda.'
    }
    return raw
  }

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(getReadableError(initialError))
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Forgot password dialog
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  // Supabase config check
  const [isConfigured, setIsConfigured] = useState(true)
  const [showSetupGuide, setShowSetupGuide] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key || url.includes('placeholder') || url.includes('your-project-id')) {
      setIsConfigured(false)
    }

    async function checkCurrentSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.push(redirectedFrom || '/dashboard')
      }
    }
    checkCurrentSession()
  }, [router, redirectedFrom, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!email || !password) {
      setErrorMsg('Harap lengkapi semua bidang yang diperlukan.')
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.')
      return
    }

    if (mode === 'register' && password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.')
      return
    }

    if (!isConfigured) {
      setErrorMsg('Konfigurasi .env.local belum diisi. Masukkan URL dan Anon Key Supabase Anda.')
      setShowSetupGuide(true)
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          setSuccessMsg('Login berhasil. Mengalihkan ke console...')
          setTimeout(() => {
            router.push(redirectedFrom || '/dashboard')
            router.refresh()
          }, 600)
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error

        if (data.user && !data.session) {
          setSuccessMsg(
            'Akun terdaftar. Tautan verifikasi telah dikirim ke email Anda. Silakan periksa inbox/spam.'
          )
        } else if (data.session) {
          setSuccessMsg('Akun berhasil dibuat. Mengalihkan...')
          setTimeout(() => {
            router.push('/dashboard')
            router.refresh()
          }, 800)
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      const message = err.message || 'Terjadi kesalahan autentikasi'
      if (message.includes('Invalid login credentials')) {
        setErrorMsg('Email atau kata sandi tidak cocok. Periksa kembali input Anda.')
      } else if (message.includes('Email not confirmed')) {
        setErrorMsg('Email Anda belum dikonfirmasi. Periksa kotak masuk email Anda.')
      } else if (message.includes('User already registered')) {
        setErrorMsg('Email ini telah terdaftar. Silakan pilih tab Masuk.')
      } else {
        setErrorMsg(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    if (!isConfigured) {
      setErrorMsg('Konfigurasi Supabase di .env.local belum lengkap.')
      setShowSetupGuide(true)
      return
    }

    try {
      setLoading(true)
      setErrorMsg(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      setErrorMsg(err.message || `Gagal login dengan ${provider}`)
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError(null)
    setResetSuccess(null)

    if (!resetEmail) {
      setResetError('Silakan masukkan alamat email.')
      return
    }

    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      })
      if (error) throw error
      setResetSuccess('Tautan reset kata sandi telah dikirim ke email Anda.')
    } catch (err: any) {
      setResetError(err.message || 'Gagal mengirim email reset.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 bg-dev-grid text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-sm my-8 space-y-6">
        {/* Brand & Context */}
        <div className="text-center space-y-1.5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white border border-slate-200 text-xs font-mono text-slate-600 hover:text-slate-900 transition-colors mb-2 shadow-2xs"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-600" />
            <span>grok-bot / auth</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {mode === 'login' ? 'Masuk ke Sistem' : 'Pendaftaran Akun'}
          </h1>
          <p className="text-xs text-slate-500">
            Autentikasi terpusat berbasis Supabase PostgreSQL
          </p>
        </div>

        {/* Warning if env is missing */}
        {!isConfigured && (
          <div className="p-3.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold text-[11px] uppercase tracking-wider text-amber-800">
                Konfigurasi Diperlukan
              </div>
              <p className="text-slate-600 text-xs">
                Kredensial Supabase di <code className="text-amber-800 font-mono">.env.local</code> belum lengkap.
              </p>
              <button
                type="button"
                onClick={() => setShowSetupGuide(true)}
                className="text-amber-800 hover:text-amber-900 underline text-xs font-medium cursor-pointer"
              >
                Lihat Panduan Setup SQL & Key
              </button>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="dev-card rounded-lg p-6 space-y-5 bg-white shadow-sm">
          {/* Segmented Mode Control */}
          <div className="grid grid-cols-2 p-1 rounded bg-slate-100 border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setErrorMsg(null)
                setSuccessMsg(null)
              }}
              className={`py-1.5 rounded transition-all text-center cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setErrorMsg(null)
                setSuccessMsg(null)
              }}
              className={`py-1.5 rounded transition-all text-center cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Daftar Akun
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{successMsg}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nama Anda"
                    className="dev-input w-full pl-9 pr-3 py-2 rounded text-xs placeholder-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="dev-input w-full pl-9 pr-3 py-2 rounded text-xs placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-600">
                  Kata Sandi
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email)
                      setShowForgotModal(true)
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Lupa sandi?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="dev-input w-full pl-9 pr-9 py-2 rounded text-xs placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-600 mb-1">
                  Konfirmasi Sandi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="dev-input w-full pl-9 pr-3 py-2 rounded text-xs placeholder-slate-400"
                  />
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-slate-600 select-none cursor-pointer">
                  Ingat sesi pada perangkat ini
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2 px-3 dev-btn-primary rounded text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Masuk ke Console' : 'Daftar Akun Baru'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Social Auth */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="text-center text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Opsi Provider OAuth
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                className="py-1.5 px-3 rounded dev-btn-secondary text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuthSignIn('github')}
                className="py-1.5 px-3 rounded dev-btn-secondary text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 fill-current text-slate-800" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>GitHub</span>
              </button>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-800 transition-colors">
              ← Beranda
            </Link>
            <button
              type="button"
              onClick={() => setShowSetupGuide(true)}
              className="hover:text-slate-800 font-mono text-[11px] transition-colors cursor-pointer"
            >
              schema.sql
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="dev-card w-full max-w-sm rounded-lg p-5 space-y-4 relative border-slate-200 shadow-xl bg-white">
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false)
                setResetSuccess(null)
                setResetError(null)
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">Reset Kata Sandi</h3>
              <p className="text-xs text-slate-500">
                Masukkan email Anda untuk menerima tautan pemulihan sandi.
              </p>
            </div>

            {resetError && (
              <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800 text-xs">
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                {resetSuccess}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="nama@domain.com"
                className="dev-input w-full px-3 py-2 rounded text-xs placeholder-slate-400"
              />

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-2 dev-btn-primary rounded text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                {resetLoading ? 'Mengirim...' : 'Kirim Tautan Reset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Setup Guide Modal */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="dev-card w-full max-w-lg rounded-lg p-6 space-y-5 relative max-h-[85vh] overflow-y-auto bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setShowSetupGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">Panduan Setup Database Supabase</h3>
              <p className="text-xs text-slate-500">
                Langkah menghubungkan otentikasi dan database PostgreSQL
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800">1. Kredensial di .env.local</div>
                <p className="text-slate-600">
                  Dapatkan URL dan Anon Key di menu <strong>Project Settings → API</strong> di Supabase Console.
                </p>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800">2. Jalankan Skrip Database SQL</div>
                <p className="text-slate-600">
                  Buka menu <strong>SQL Editor</strong> di Supabase dan jalankan isi file:
                </p>
                <code className="block p-2 rounded bg-slate-100 border border-slate-200 text-blue-700 font-mono text-[11px]">
                  supabase/schema.sql
                </code>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800">3. Nonaktifkan &apos;Confirm Email&apos; (Opsional untuk Dev)</div>
                <p className="text-slate-600">
                  Di menu <strong>Authentication → Providers → Email</strong>, matikan toggle <em>Confirm email</em> agar registrasi langsung aktif tanpa menunggu link email.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="px-4 py-2 dev-btn-primary rounded text-xs font-medium cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500 font-mono text-xs">
          <span>Memuat halaman login...</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
