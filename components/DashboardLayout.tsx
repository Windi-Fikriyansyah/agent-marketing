'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Bot,
  Plus,
  LogOut,
  Menu,
  X,
  AlertCircle
} from 'lucide-react'

export interface Agent {
  id: string
  user_id: string
  name: string
  description: string | null
  model: string
  system_prompt: string | null
  avatar?: string | null
  created_at: string
  updated_at: string
}

export function renderAgentAvatar(
  avatar?: string | null,
  isSelected = false,
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'sm',
  showActiveDot = false
) {
  const sizeClasses: Record<string, { container: string; box: string; icon: string }> = {
    xs: { container: 'w-6 h-6', box: 'w-5 h-5', icon: 'w-3 h-3' },
    sm: { container: 'w-7 h-7', box: 'w-6 h-6', icon: 'w-3.5 h-3.5' },
    md: { container: 'w-8 h-8', box: 'w-7 h-7', icon: 'w-4 h-4' },
    lg: { container: 'w-10 h-10', box: 'w-9 h-9', icon: 'w-5 h-5' },
    xl: { container: 'w-16 h-16', box: 'w-14 h-14', icon: 'w-7 h-7' },
  }

  const currentSize = sizeClasses[size] || sizeClasses.sm

  if (!avatar) {
    return (
      <div className={`relative ${currentSize.container} flex items-center justify-center shrink-0`}>
        <div
          className={`${currentSize.box} rounded-lg flex items-center justify-center border ${
            isSelected
              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <Bot className={currentSize.icon} />
        </div>
        {showActiveDot && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-2xs" />
        )}
      </div>
    )
  }

  const parts = avatar.split('-')
  const colorName = parts[0] || 'purple'
  const shape = parts[1] || 'circle'
  const eye = parts[2] || (shape === 'circle' ? 'happy' : 'dots')

  const colorMap: Record<string, { bg: string; border: string }> = {
    orange: { bg: '#fb923c', border: '#f97316' },
    purple: { bg: '#c084fc', border: '#a855f7' },
    blue: { bg: '#60a5fa', border: '#3b82f6' },
    emerald: { bg: '#34d399', border: '#10b981' },
    amber: { bg: '#fbbf24', border: '#f59e0b' },
    rose: { bg: '#fb7185', border: '#f43f5e' },
    indigo: { bg: '#818cf8', border: '#6366f1' },
    cyan: { bg: '#2dd4bf', border: '#06b6d4' },
    fuchsia: { bg: '#e879f9', border: '#d946ef' },
  }

  const color = colorMap[colorName] || colorMap.purple

  const shapeClass =
    shape === 'diamond'
      ? 'rotate-45 rounded-md'
      : shape === 'squircle'
      ? 'rounded-xl'
      : shape === 'circle'
      ? 'rounded-full'
      : 'rounded-lg'

  return (
    <div className={`relative ${currentSize.container} flex items-center justify-center shrink-0`}>
      <div
        className={`${currentSize.box} ${shapeClass} flex items-center justify-center shadow-xs transition-transform overflow-hidden`}
        style={{ backgroundColor: color.bg }}
      >
        <div className={`w-full h-full flex items-center justify-center ${shape === 'diamond' ? '-rotate-45' : ''}`}>
          {eye === 'happy' ? (
            <svg viewBox="0 0 32 32" className="w-full h-full p-1" fill="none">
              <path d="M 7 13 Q 11 8 15 13" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 17 13 Q 21 8 25 13" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 12 19 Q 16 23 20 19" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : eye === 'sparkle' ? (
            <svg viewBox="0 0 32 32" className="w-full h-full p-1.5" fill="none">
              <path d="M 16 5 Q 16 16 5 16 Q 16 16 16 27 Q 16 16 27 16 Q 16 16 16 5 Z" fill="#ffffff" />
            </svg>
          ) : eye === 'wink' ? (
            <svg viewBox="0 0 32 32" className="w-full h-full p-1.5" fill="none">
              <path d="M 7 14 L 14 14" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="21" cy="14" r="2.5" fill="#1e293b" />
              <path d="M 12 20 Q 16 23 20 20" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            </div>
          )}
        </div>
      </div>
      {showActiveDot && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-2xs" />
      )}
    </div>
  )
}

interface DashboardLayoutProps {
  children: React.ReactNode
  selectedAgentId?: string | null
  onSelectAgent?: (agent: Agent) => void
  headerTitle?: React.ReactNode
  headerAction?: React.ReactNode
  hideTopHeader?: boolean
}

export default function DashboardLayout({
  children,
  selectedAgentId,
  onSelectAgent,
  headerTitle,
  headerAction,
  hideTopHeader = false,
}: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [tableMissingNotice, setTableMissingNotice] = useState<string | null>(null)

  // Fetch user and agents from Supabase (Real data only, NO dummy data)
  const loadData = async () => {
    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !currentUser) {
        router.push(`/login?redirectedFrom=${encodeURIComponent(pathname)}`)
        return
      }

      setUser(currentUser)

      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })

      if (agentError) {
        if (
          agentError.code === '42P01' ||
          agentError.message.includes('relation "public.agents" does not exist')
        ) {
          setTableMissingNotice(
            'Tabel `agents` belum dibuat di Supabase. Jalankan skrip di `supabase/schema.sql` pada SQL Editor Supabase.'
          )
        }
        setAgents([])
      } else {
        setTableMissingNotice(null)
        setAgents(agentData || [])
      }
    } catch (err) {
      console.error('Error loading dashboard layout data:', err)
      setAgents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [pathname])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (err) {
      router.push('/login')
    }
  }

  const isCreateAgentPage = pathname === '/workspace/create-agent'
  const pathAgentId =
    pathname.startsWith('/workspace/') && !isCreateAgentPage
      ? pathname.replace('/workspace/', '').split('/')[0]
      : null
  const currentSelectedAgentId = selectedAgentId || pathAgentId

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500 font-mono text-xs">
        <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
          <span>Memuat workspace...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-slate-50 text-slate-900 flex flex-col md:flex-row antialiased selection:bg-blue-600 selection:text-white ${
        hideTopHeader ? 'h-screen h-[100dvh] max-h-screen overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center font-bold text-white text-xs">
            G
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-900">
            GrokBot
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Persistent Left Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Sidebar Brand Header */}
          <div className="p-4 border-b border-slate-200">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center font-bold text-white text-xs shadow-xs">
                G
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  GrokBot Agents
                </span>
              </div>
            </Link>

            {/* CREATE NEW AGENT BUTTON */}
            <div className="mt-4">
              <Link
                href="/workspace/create-agent"
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all ${
                  isCreateAgentPage
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                    : 'dev-btn-primary hover:shadow-sm'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create New Agent</span>
              </Link>
            </div>
          </div>

          {/* AGENTS LIST IN SIDEBAR */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between px-2 pt-1 pb-1">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                Daftar Agent
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {agents.length}
              </span>
            </div>

            {/* IF NO AGENTS EXIST (EMPTY STATE - NO DUMMY DATA) */}
            {agents.length === 0 ? (
              <div className="p-4 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 mt-2 space-y-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="text-xs font-medium text-slate-600">
                  Belum ada agent
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Klik tombol <strong>Create New Agent</strong> di atas untuk membuat
                  agent pertama Anda.
                </p>
              </div>
            ) : (
              /* REAL AGENTS LIST */
              <div className="space-y-1">
                {agents.map((agent) => {
                  const isSelected = currentSelectedAgentId === agent.id
                  return (
                    <button
                      key={agent.id}
                      onClick={() => {
                        if (onSelectAgent) {
                          onSelectAgent(agent)
                        }
                        router.push(`/workspace/${agent.id}`)
                        setMobileMenuOpen(false)
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start gap-2.5 border cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 text-blue-900 border-blue-200 shadow-2xs font-medium'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-transparent'
                      }`}
                    >
                      {renderAgentAvatar(agent.avatar, isSelected, 'sm')}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-xs leading-snug">
                          {agent.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400 truncate">
                            {agent.model}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[10px] text-slate-400">
                            {new Date(agent.created_at).toLocaleDateString(
                              'id-ID',
                              {
                                day: 'numeric',
                                month: 'short',
                              }
                            )}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar User Profile Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-slate-200/60 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded bg-slate-900 border border-slate-800 flex items-center justify-center font-mono text-xs font-semibold text-white shrink-0">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="truncate text-left">
                <div className="text-xs font-medium text-slate-900 truncate leading-snug">
                  {user?.user_metadata?.full_name || 'Pengguna'}
                </div>
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  {user?.email}
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Keluar / Sign Out"
              className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        className={`flex-1 min-w-0 flex flex-col bg-slate-50 ${
          hideTopHeader ? 'h-full max-h-screen overflow-hidden min-h-0' : ''
        }`}
      >
        {/* Top Header / Action Bar */}
        {!hideTopHeader && (
          <div className="h-14 border-b border-slate-200 bg-white/90 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-2 text-xs">
              {headerTitle ? (
                <span className="text-slate-900 font-semibold truncate max-w-[350px]">
                  {headerTitle}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2.5">
              {headerAction || (
                <Link
                  href="/workspace/create-agent"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold dev-btn-primary rounded cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Agent</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Database table warning if needed */}
        {tableMissingNotice && (
          <div className="m-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">
                Skema Database Supabase Perlu Dijalankan
              </span>
              <p className="text-slate-600 leading-relaxed mb-2">
                Tabel{' '}
                <code className="text-amber-800 font-mono font-medium">
                  public.agents
                </code>{' '}
                belum ditemukan di Supabase. Kami telah menyiapkan file skrip
                lengkap di{' '}
                <code className="text-amber-800 font-mono">
                  supabase/schema.sql
                </code>
                .
              </p>
            </div>
          </div>
        )}

        {/* Page Content Body */}
        <div
          className={`flex-1 min-w-0 flex flex-col ${
            hideTopHeader ? 'h-full max-h-screen overflow-hidden min-h-0' : ''
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
