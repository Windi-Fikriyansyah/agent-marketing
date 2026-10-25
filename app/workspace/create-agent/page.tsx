'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Shuffle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft
} from 'lucide-react'

// Avatar presets & configurations
const AVATAR_COLORS = [
  { name: 'purple', bg: '#c084fc', border: '#a855f7' },
  { name: 'blue', bg: '#60a5fa', border: '#3b82f6' },
  { name: 'emerald', bg: '#34d399', border: '#10b981' },
  { name: 'amber', bg: '#fbbf24', border: '#f59e0b' },
  { name: 'rose', bg: '#fb7185', border: '#f43f5e' },
  { name: 'indigo', bg: '#818cf8', border: '#6366f1' },
  { name: 'cyan', bg: '#2dd4bf', border: '#06b6d4' },
  { name: 'fuchsia', bg: '#e879f9', border: '#d946ef' },
]

const AVATAR_SHAPES = ['diamond', 'squircle', 'circle', 'blob'] as const
type AvatarShape = (typeof AVATAR_SHAPES)[number]

const AVATAR_EYES = ['dots', 'happy', 'sparkle', 'wink'] as const
type AvatarEye = (typeof AVATAR_EYES)[number]

export default function CreateAgentPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loadingUser, setLoadingUser] = useState(true)
  const [user, setUser] = useState<any>(null)

  // Form states matching user request exactly
  const [agentName, setAgentName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Avatar state
  const [colorIndex, setColorIndex] = useState(0) // Default: purple like in screenshot
  const [shapeIndex, setShapeIndex] = useState<AvatarShape>('diamond')
  const [eyeIndex, setEyeIndex] = useState<AvatarEye>('dots')
  const [shuffling, setShuffling] = useState(false)

  // Ensure user is authenticated
  useEffect(() => {
    async function checkAuth() {
      setLoadingUser(true)
      try {
        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser()

        if (error || !currentUser) {
          router.push('/login?redirectedFrom=/workspace/create-agent')
          return
        }

        setUser(currentUser)
      } catch (err) {
        console.error('Auth error:', err)
      } finally {
        setLoadingUser(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  // Shuffle Avatar generator
  const handleShuffleAvatar = () => {
    setShuffling(true)
    setTimeout(() => {
      setColorIndex(
        (prev) => (prev + 1 + Math.floor(Math.random() * (AVATAR_COLORS.length - 1))) % AVATAR_COLORS.length
      )
      setShapeIndex(AVATAR_SHAPES[Math.floor(Math.random() * AVATAR_SHAPES.length)])
      setEyeIndex(AVATAR_EYES[Math.floor(Math.random() * AVATAR_EYES.length)])
      setShuffling(false)
    }, 150)
  }

  // Handle form submission to Supabase database
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agentName.trim()) {
      setErrorMessage('Please enter an agent name.')
      return
    }

    if (!user) return

    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const avatarId = `${AVATAR_COLORS[colorIndex].name}-${shapeIndex}-${eyeIndex}`

    try {
      const payload = {
        user_id: user.id,
        name: agentName.trim(),
        description: instructions.trim() ? instructions.trim().slice(0, 150) : null,
        system_prompt: instructions.trim() || null,
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        avatar: avatarId,
      }

      let createdAgentId: string | null = null

      const { data, error } = await supabase
        .from('agents')
        .insert(payload)
        .select()
        .single()

      if (error) {
        // If avatar column does not exist yet or schema cache has not reloaded
        if (
          error.message.toLowerCase().includes('avatar') ||
          error.message.toLowerCase().includes('schema cache')
        ) {
          console.warn('Avatar column missing or schema cache outdated, falling back...')
          const fallbackPayload = {
            user_id: user.id,
            name: agentName.trim(),
            description: instructions.trim() ? instructions.trim().slice(0, 150) : null,
            system_prompt: instructions.trim() || null,
            model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
          }
          const { data: retryData, error: retryError } = await supabase
            .from('agents')
            .insert(fallbackPayload)
            .select()
            .single()

          if (retryError) throw retryError
          createdAgentId = retryData?.id || null
        } else {
          throw error
        }
      } else {
        createdAgentId = data?.id || null
      }

      if (!createdAgentId) {
        const { data: latest } = await supabase
          .from('agents')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        createdAgentId = latest?.id || null
      }

      setSuccessMessage('Agent created successfully! Redirecting to workspace...')
      if (createdAgentId) {
        router.push(`/workspace/${createdAgentId}`)
        router.refresh()
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      console.error('Create agent error:', err)
      setErrorMessage(
        err.message || 'Failed to create agent. Please ensure the Supabase database schema is setup.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const currentColor = AVATAR_COLORS[colorIndex]

  return (
    <DashboardLayout
      headerTitle="Create New Agent"
      headerAction={
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold dev-btn-secondary rounded cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Dashboard</span>
        </Link>
      }
    >
      <div className="p-6 md:p-10 max-w-4xl mx-auto flex items-center justify-center">
        <div className="w-full max-w-xl mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] p-8 sm:p-10 space-y-7">
          {/* Avatar Section - Centered */}
          <div className="flex flex-col items-center justify-center space-y-4 pt-1">
            <div
              className={`relative w-20 h-20 flex items-center justify-center transition-all duration-300 ease-out select-none ${
                shuffling ? 'scale-90 rotate-6' : 'scale-100 rotate-0'
              }`}
            >
              {/* Outer Shape */}
              <div
                className={`w-16 h-16 transition-all duration-300 shadow-sm flex items-center justify-center ${
                  shapeIndex === 'diamond'
                    ? 'rotate-45 rounded-2xl'
                    : shapeIndex === 'squircle'
                    ? 'rounded-3xl'
                    : shapeIndex === 'circle'
                    ? 'rounded-full'
                    : 'rounded-[35%_65%_60%_40%/45%_55%_45%_55%]'
                }`}
                style={{
                  backgroundColor: currentColor.bg,
                }}
              >
                {/* Eyes Container */}
                <div
                  className={`flex items-center justify-center gap-3 ${
                    shapeIndex === 'diamond' ? '-rotate-45' : ''
                  }`}
                >
                  {eyeIndex === 'dots' && (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-900 relative shadow-2xs">
                        <div className="w-0.5 h-0.5 rounded-full bg-white absolute top-0.5 right-0.5" />
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-900 relative shadow-2xs">
                        <div className="w-0.5 h-0.5 rounded-full bg-white absolute top-0.5 right-0.5" />
                      </div>
                    </>
                  )}

                  {eyeIndex === 'happy' && (
                    <>
                      <span className="text-slate-900 font-bold text-base leading-none">^</span>
                      <span className="text-slate-900 font-bold text-base leading-none">^</span>
                    </>
                  )}

                  {eyeIndex === 'sparkle' && (
                    <>
                      <span className="text-slate-900 text-xs">✦</span>
                      <span className="text-slate-900 text-xs">✦</span>
                    </>
                  )}

                  {eyeIndex === 'wink' && (
                    <>
                      <span className="text-slate-900 font-bold text-xs leading-none">-</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-900 relative shadow-2xs">
                        <div className="w-0.5 h-0.5 rounded-full bg-white absolute top-0.5 right-0.5" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Shuffle Avatar Button */}
            <button
              type="button"
              onClick={handleShuffleAvatar}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-slate-600" />
              <span>Shuffle avatar</span>
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{successMessage}</div>
            </div>
          )}

          {/* Form matching user image */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input 1: Agent name */}
            <div className="space-y-2">
              <label
                htmlFor="agent-name"
                className="block text-sm font-bold text-slate-900"
              >
                Agent name
              </label>
              <input
                id="agent-name"
                type="text"
                required
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Enter agent name"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
              />
            </div>

            {/* Input 2: Instructions / Description */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="agent-instructions"
                  className="block text-sm font-bold text-slate-900"
                >
                  Instructions / Description
                </label>
                <span className="text-xs text-slate-400 font-normal">Optional</span>
              </div>
              <textarea
                id="agent-instructions"
                rows={4}
                maxLength={1000}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Describe what this agent should do, its personality, goals, or special instructions..."
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all resize-y min-h-[110px]"
              />
              <div className="flex justify-end">
                <span className="text-xs font-mono text-slate-400">
                  {instructions.length} / 1000
                </span>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || !agentName.trim()}
                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Agent</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
