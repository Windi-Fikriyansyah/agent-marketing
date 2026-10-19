'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout, { renderAgentAvatar, type Agent } from '@/components/DashboardLayout'
import {
  Save,
  Shuffle,
  Send,
  Sliders,
  Wrench,
  Calendar,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react'

// Avatar presets
const AVATAR_COLORS = [
  { name: 'orange', bg: '#fb923c', border: '#f97316' },
  { name: 'purple', bg: '#c084fc', border: '#a855f7' },
  { name: 'blue', bg: '#60a5fa', border: '#3b82f6' },
  { name: 'emerald', bg: '#34d399', border: '#10b981' },
  { name: 'amber', bg: '#fbbf24', border: '#f59e0b' },
  { name: 'rose', bg: '#fb7185', border: '#f43f5e' },
  { name: 'indigo', bg: '#818cf8', border: '#6366f1' },
  { name: 'cyan', bg: '#2dd4bf', border: '#06b6d4' },
  { name: 'fuchsia', bg: '#e879f9', border: '#d946ef' },
]

const AVATAR_SHAPES = ['circle', 'squircle', 'diamond', 'blob'] as const
const AVATAR_EYES = ['happy', 'sparkle', 'dots', 'wink'] as const

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
}

interface WorkspaceAgentClientProps {
  agentId: string
}

export default function WorkspaceAgentClient({ agentId }: WorkspaceAgentClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Status toggle
  const [isActive, setIsActive] = useState(true)

  // Configuration edit states
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [avatarString, setAvatarString] = useState('orange-circle-happy')
  const [activeTab, setActiveTab] = useState<'settings' | 'tools' | 'schedule' | 'tuning'>('settings')

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Chat states
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [agentTyping, setAgentTyping] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Fetch Agent Data
  useEffect(() => {
    async function loadAgent() {
      if (!agentId) return
      setLoading(true)
      setNotFound(false)

      try {
        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !currentUser) {
          router.push(`/login?redirectedFrom=/workspace/${agentId}`)
          return
        }

        setUser(currentUser)

        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .single()

        if (error || !data) {
          console.error('Agent not found or error:', error)
          setNotFound(true)
        } else {
          setAgent(data)
          setName(data.name || '')
          setInstructions(data.system_prompt || data.description || '')
          setAvatarString(data.avatar || 'orange-circle-happy')

          // Initialize chat messages from localStorage or realistic conversation matching user screenshot
          const storageKey = `grok_bot_chat_${agentId}`
          const savedChat = localStorage.getItem(storageKey)
          if (savedChat) {
            try {
              setChatMessages(JSON.parse(savedChat))
            } catch {
              setDefaultConversation(data)
            }
          } else {
            setDefaultConversation(data)
          }
        }
      } catch (err) {
        console.error('Error loading agent:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    loadAgent()
  }, [agentId, router, supabase])

  const setDefaultConversation = (currentAgent: Agent) => {
    const isNovaLike =
      currentAgent.name.toLowerCase().includes('nova') ||
      (currentAgent.description && currentAgent.description.toLowerCase().includes('research'))

    if (isNovaLike) {
      setChatMessages([
        {
          id: '1',
          role: 'user',
          content: 'Can you help me prepare a quick brief for tomorrow\'s product planning meeting?',
          timestamp: '10:32 AM',
        },
        {
          id: '2',
          role: 'agent',
          content:
            'Absolutely. I can turn your notes into a concise brief with goals, open questions, key decisions, and a suggested agenda. Share whatever you have—even rough notes are fine.',
          timestamp: '10:32 AM',
        },
        {
          id: '3',
          role: 'user',
          content: 'Focus on the onboarding improvements and the Q4 launch timeline. Keep it under one page.',
          timestamp: '10:33 AM',
        },
        {
          id: '4',
          role: 'agent',
          content:
            'Got it. I\'ll structure the brief around:\n\n• Current onboarding friction\n• Proposed improvements and expected impact\n• Q4 milestones, owners, and risks\n\nSend over the latest notes when you\'re ready.',
          timestamp: '10:34 AM',
        },
      ])
    } else {
      setChatMessages([
        {
          id: '1',
          role: 'agent',
          content: `Halo! Saya **${currentAgent.name}**. ${
            currentAgent.system_prompt
              ? `Saya telah dikonfigurasi dengan instruksi: "${currentAgent.system_prompt}".`
              : 'Siap membantu menyelesaikan tugas Anda.'
          }\n\nSilakan ajukan pertanyaan atau berikan instruksi pertama Anda!`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        },
      ])
    }
  }

  // Auto focus input when loaded
  useEffect(() => {
    if (!loading && agent) {
      setTimeout(() => {
        chatInputRef.current?.focus()
      }, 100)
    }
  }, [loading, agent])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, agentTyping])

  // Save chat to localStorage
  const saveChatToStorage = (messages: ChatMessage[]) => {
    if (agentId) {
      localStorage.setItem(`grok_bot_chat_${agentId}`, JSON.stringify(messages))
    }
  }

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!chatInput.trim() || agentTyping) return

    const userText = chatInput.trim()
    setChatInput('') // Empty input immediately

    const now = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: now,
    }

    const updatedWithUser = [...chatMessages, newUserMsg]
    setChatMessages(updatedWithUser)
    saveChatToStorage(updatedWithUser)
    setAgentTyping(true)

    // Simulate intelligent agent response based on system instructions
    setTimeout(() => {
      let replyContent = ''
      const lower = userText.toLowerCase()

      if (lower.includes('brief') || lower.includes('meeting') || lower.includes('plan')) {
        replyContent = `Got it. I'll structure the brief around:\n\n• Current onboarding friction\n• Proposed improvements and expected impact\n• Q4 milestones, owners, and risks\n\nSend over the latest notes when you're ready.`
      } else if (lower.includes('review') || lower.includes('code') || lower.includes('pr')) {
        replyContent = `Siap melakukan code review. Saya akan menganalisis PR Anda berdasarkan standar performa, clean code, dan keamanan. Silakan cantumkan link PR atau cuplikan kodenya.`
      } else {
        replyContent = `Menerima instruksi: "${userText}". Sebagai agent **${name}**, saya siap membantu menganalisis dan memproses permintaan ini secara terstruktur.`
      }

      const newAgentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      }

      const finalMessages = [...updatedWithUser, newAgentMsg]
      setChatMessages(finalMessages)
      saveChatToStorage(finalMessages)
      setAgentTyping(false)
    }, 800)
  }

  // Shuffle Avatar in Configuration Panel
  const handleShuffleAvatar = () => {
    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)].name
    const randomShape = AVATAR_SHAPES[Math.floor(Math.random() * AVATAR_SHAPES.length)]
    const randomEye = AVATAR_EYES[Math.floor(Math.random() * AVATAR_EYES.length)]
    const newAvatar = `${randomColor}-${randomShape}-${randomEye}`
    setAvatarString(newAvatar)
  }

  // Save Configuration to Supabase
  const handleSaveConfig = async () => {
    if (!agent || !user) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const updates: any = {
        name: name.trim(),
        description: instructions.trim() ? instructions.trim().slice(0, 150) : null,
        system_prompt: instructions.trim() || null,
        avatar: avatarString,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', agent.id)

      if (error) {
        if (
          error.message.toLowerCase().includes('avatar') ||
          error.message.toLowerCase().includes('schema cache')
        ) {
          const fallbackUpdates = {
            name: name.trim(),
            description: instructions.trim() ? instructions.trim().slice(0, 150) : null,
            system_prompt: instructions.trim() || null,
            updated_at: new Date().toISOString(),
          }
          const { error: retryError } = await supabase
            .from('agents')
            .update(fallbackUpdates)
            .eq('id', agent.id)
          if (retryError) throw retryError
        } else {
          throw error
        }
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      router.refresh()
    } catch (err: any) {
      console.error('Failed to save configuration:', err)
      setSaveError(err.message || 'Gagal menyimpan konfigurasi agent.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout hideTopHeader>
        <div className="h-full flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
          <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Memuat workspace agent...</span>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (notFound || !agent) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto my-16 p-8 bg-white border border-slate-200 rounded-xl text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Agent Tidak Ditemukan</h2>
            <p className="text-xs text-slate-500 mt-1">
              Agent dengan ID ini tidak ada atau telah dihapus.
            </p>
          </div>
          <Link
            href="/workspace/create-agent"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Agent Baru</span>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout selectedAgentId={agentId} hideTopHeader>
      {/* 2-Column Full Height Interface matching user screenshot */}
      <div className="flex-1 flex flex-col md:flex-row h-screen min-h-0 overflow-hidden bg-slate-50">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Main Chat & Agent Playground Area                            */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-slate-200">
          {/* Header of Chat matching screenshot */}
          <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar in header: Round purple with sparkle + active green dot */}
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-2xs">
                  <Sparkles className="w-4 h-4 fill-white text-white" />
                </div>
                {isActive && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-2xs" />
                )}
              </div>

              {/* Agent Title & Subtitle */}
              <div className="truncate">
                <h1 className="text-sm md:text-base font-bold text-slate-900 leading-tight truncate">
                  {name || agent.name}
                </h1>
                <p className="text-xs text-slate-500 truncate leading-tight">
                  {agent.description || 'Personal research agent'}
                </p>
              </div>
            </div>

            {/* Active Toggle Switch */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className="flex items-center gap-2 cursor-pointer select-none group"
                aria-label="Toggle agent active status"
              >
                <div
                  className={`w-10 h-5 rounded-full transition-colors flex items-center p-0.5 ${
                    isActive ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                      isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </button>
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 bg-white">
            {chatMessages.map((msg) => {
              const isUser = msg.role === 'user'

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-xl bg-blue-600 text-white font-normal text-sm px-5 py-3.5 rounded-2xl shadow-xs leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                )
              }

              // Agent message matching screenshot
              return (
                <div key={msg.id} className="flex items-start gap-3 max-w-2xl">
                  {/* Small round purple avatar on the left */}
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-2xs mt-1">
                    <Sparkles className="w-3.5 h-3.5 fill-white text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Agent Name + Timestamp */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-slate-900">
                        {name || agent.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Message Bubble Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm text-slate-800 leading-relaxed shadow-xs whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Agent Typing Indicator */}
            {agentTyping && (
              <div className="flex items-start gap-3 max-w-2xl animate-in fade-in">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-2xs mt-1">
                  <Sparkles className="w-3.5 h-3.5 fill-white text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Bottom Input matching screenshot */}
          <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0">
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask your agent anything..."
                autoFocus
                className="w-full bg-white border border-slate-200 rounded-2xl pl-5 pr-14 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
              />

              <button
                type="submit"
                disabled={!chatInput.trim() || agentTyping}
                className="absolute right-2.5 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="w-4 h-4 -rotate-45 -translate-y-0.5 translate-x-0.5 fill-current" />
              </button>
            </form>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: "Agent Configuration" Panel matching screenshot             */}
        {/* ========================================================================= */}
        <aside className="w-full md:w-80 lg:w-96 bg-white flex flex-col shrink-0 h-full border-t md:border-t-0 md:border-l border-slate-200 overflow-y-auto">
          {/* Header of Configuration Panel */}
          <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-900 leading-tight">
                Agent Configuration
              </h2>
              <p className="text-[11px] text-slate-500 leading-tight">
                Customize how your agent works
              </p>
            </div>

            {/* Blue Save Button with floppy disk icon */}
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>

          {/* Feedback alerts */}
          {saveSuccess && (
            <div className="m-4 mb-0 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Konfigurasi agent berhasil disimpan!</span>
            </div>
          )}

          {saveError && (
            <div className="m-4 mb-0 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Configuration Form Body */}
          <div className="p-5 space-y-6 flex-1">
            {/* 1. Agent avatar section matching screenshot */}
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900">Agent avatar</h3>
                <p className="text-[11px] text-slate-500">
                  Give your agent a distinct look.
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Large circular avatar preview */}
                <div className="shrink-0">
                  {renderAgentAvatar(avatarString, false, 'xl')}
                </div>

                {/* Shuffle Avatar Button */}
                <button
                  type="button"
                  onClick={handleShuffleAvatar}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  <Shuffle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Shuffle Avatar</span>
                </button>
              </div>
            </div>

            {/* 2. Agent Name section matching screenshot */}
            <div className="space-y-1.5">
              <label
                htmlFor="config-agent-name"
                className="block text-xs font-bold text-slate-900"
              >
                Agent Name
              </label>
              <input
                id="config-agent-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI Reviewer PRO"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
              />
            </div>

            {/* 3. 4 Icon Tab bar matching screenshot */}
            <div className="flex items-center gap-6 border-b border-slate-200 pt-2 pb-0">
              {/* Tab 1: Sliders (Active with black underline) */}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                  activeTab === 'settings'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Instructions & Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Tab 2: Wrench */}
              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className={`pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                  activeTab === 'tools'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Tools & Capabilities"
              >
                <Wrench className="w-4 h-4" />
              </button>

              {/* Tab 3: Calendar */}
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                  activeTab === 'schedule'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Automation & Schedule"
              >
                <Calendar className="w-4 h-4" />
              </button>

              {/* Tab 4: SlidersHorizontal */}
              <button
                type="button"
                onClick={() => setActiveTab('tuning')}
                className={`pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                  activeTab === 'tuning'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Model & Parameters"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* 4. Description & Instructions section matching screenshot */}
            {activeTab === 'settings' && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="config-instructions"
                    className="block text-xs font-bold text-slate-900"
                  >
                    Description &amp; Instructions
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {instructions.length} / 2,000
                  </span>
                </div>

                <textarea
                  id="config-instructions"
                  rows={8}
                  maxLength={2000}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Describe the agent's purpose, behavior, tone, and response preferences..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-normal leading-relaxed shadow-2xs transition-all"
                />

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Describe the agent&apos;s purpose, behavior, tone, and response preferences in one place.
                </p>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50 animate-in fade-in duration-150">
                <Wrench className="w-5 h-5 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">Tools &amp; Capabilities</div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Integrasikan web search, code runner, dan browser tools untuk agent ini.
                </p>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50 animate-in fade-in duration-150">
                <Calendar className="w-5 h-5 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">Automation &amp; Schedule</div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Jadwalkan trigger otomatis berkala untuk eksekusi workflow agent.
                </p>
              </div>
            )}

            {activeTab === 'tuning' && (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50 animate-in fade-in duration-150">
                <SlidersHorizontal className="w-5 h-5 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">Model: {agent.model}</div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Temperature: 0.7 • Max Tokens: 4096 • Top P: 0.95
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </DashboardLayout>
  )
}
