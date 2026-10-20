'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
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
  Plus,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  X,
  UserCheck,
  Layers,
  Trash2,
  Copy,
  Database,
  Settings,
  Mail,
  MessageSquare,
  CalendarDays,
  BookOpen,
  GitBranch,
  Clock,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react'
import { AgentStepTrace, ApprovalRequest } from '@/lib/agent-sdk/types'

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
const CHAT_MIGRATION_SQL = `-- 1. Buat tabel riwayat chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL DEFAULT '',
  traces JSONB DEFAULT '[]'::jsonb,
  approval_request JSONB DEFAULT NULL,
  approval_status TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Index pencarian cepat
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id_created_at 
ON public.chat_messages(agent_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id 
ON public.chat_messages(user_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view their own chat messages" 
ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own chat messages" 
ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can update their own chat messages" 
ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete their own chat messages" 
ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';`

const TOOLS_MIGRATION_SQL = `-- 1. Buat tabel tools
CREATE TABLE IF NOT EXISTS public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tools_is_active ON public.tools(is_active);
CREATE INDEX IF NOT EXISTS idx_tools_slug ON public.tools(slug);

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS tools TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all users" ON public.tools;
CREATE POLICY "Allow read access to all users" 
ON public.tools FOR SELECT 
TO authenticated, anon 
USING (true);

INSERT INTO public.tools ("name", "slug", "description", "icon", "category", "is_active")
VALUES
(
  'Slack',
  'slack',
  'Send messages, read channels, and manage team notifications',
  'https://cdn.simpleicons.org/slack/4A154B',
  'Communication',
  true
),
(
  'Gmail',
  'gmail',
  'Read incoming emails, search threads, and draft or send replies',
  'https://cdn.simpleicons.org/gmail/EA4335',
  'Communication',
  true
),
(
  'Outlook',
  'outlook',
  'Send emails and read messages from Microsoft Outlook accounts',
  'https://cdn.simpleicons.org/microsoftoutlook/0078D4',
  'Communication',
  true
),
(
  'Notion',
  'notion',
  'Read, search, and update Notion workspace pages and databases',
  'https://cdn.simpleicons.org/notion/000000',
  'Productivity',
  true
),
(
  'Google Calendar',
  'googlecalendar',
  'Schedule meetings, check availability, and list calendar events',
  'https://cdn.simpleicons.org/googlecalendar/4285F4',
  'Productivity',
  true
),
(
  'Google Docs',
  'googledocs',
  'Create, read, and append content to Google Documents',
  'https://cdn.simpleicons.org/googledocs/4285F4',
  'Productivity',
  true
),
(
  'GitHub',
  'github',
  'Create issues, review pull requests, and query repository stats',
  'https://cdn.simpleicons.org/github/181717',
  'Development',
  true
),
(
  'Reddit',
  'reddit',
  'Read posts, search subreddits, and track community discussions',
  'https://cdn.simpleicons.org/reddit/FF4500',
  'Social',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

NOTIFY pgrst, 'reload schema';`

export interface ToolItem {
  id?: string
  name: string
  slug: string
  description: string
  icon: string
  category: string
  is_active?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  traces?: AgentStepTrace[]
  approvalRequest?: ApprovalRequest | null
  approvalStatus?: 'pending' | 'approved' | 'rejected'
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
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [avatarString, setAvatarString] = useState('orange-circle-happy')
  const [activeTab, setActiveTab] = useState<'settings' | 'tools' | 'schedule' | 'agent_settings'>('settings')

  // Tools Tab state (Strictly from Database, no dummy data)
  const [toolsList, setToolsList] = useState<ToolItem[]>([])
  const [loadingTools, setLoadingTools] = useState<boolean>(true)
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [toolsCategory, setToolsCategory] = useState<string>('All')
  const [connectedTools, setConnectedTools] = useState<string[]>([])

  // Dynamic categories from database tools
  const availableCategories = useMemo(() => {
    const categoriesFromDb = Array.from(
      new Set(toolsList.map((t) => t.category).filter(Boolean))
    )
    return ['All', ...categoriesFromDb]
  }, [toolsList])

  // Schedule Tab state
  const [scheduleMode, setScheduleMode] = useState<'manual' | 'recurring' | 'specific_time'>('recurring')
  const [scheduleFrequency, setScheduleFrequency] = useState('daily')
  const [scheduleTime, setScheduleTime] = useState('08:00')
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])

  // Agent Settings state
  const [deleting, setDeleting] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Chat states
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [agentTyping, setAgentTyping] = useState(false)
  const [expandedTraceMsgId, setExpandedTraceMsgId] = useState<string | null>(null)
  const [chatTableMissingNotice, setChatTableMissingNotice] = useState(false)
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [sqlModalTab, setSqlModalTab] = useState<'tools' | 'chat'>('tools')
  const [copiedSql, setCopiedSql] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Save single message to Supabase chat_messages table
  const persistMessageToSupabase = async (msg: ChatMessage) => {
    if (!user || !agentId) return
    try {
      const { error } = await supabase.from('chat_messages').upsert({
        id: msg.id,
        agent_id: agentId,
        user_id: user.id,
        role: msg.role,
        content: msg.content,
        traces: msg.traces || [],
        approval_request: msg.approvalRequest || null,
        approval_status: msg.approvalStatus || null,
        created_at: new Date().toISOString(),
      })
      if (error) {
        if (
          error.code === '42P01' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('schema cache')
        ) {
          setChatTableMissingNotice(true)
        }
      } else {
        setChatTableMissingNotice(false)
      }
    } catch (err) {
      console.warn('Supabase chat persist warning:', err)
    }
  }

  // Fetch Agent Data & Chat History
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
          setDescription(data.description || '')
          setInstructions(data.system_prompt || '')
          setAvatarString(data.avatar || 'orange-circle-happy')

          // Load tools strictly from database
          try {
            setLoadingTools(true)
            setToolsError(null)
            const { data: dbTools, error: toolsError } = await supabase
              .from('tools')
              .select('*')
              .eq('is_active', true)
              .order('name', { ascending: true })

            if (toolsError) {
              console.error('Error fetching tools from database:', toolsError)
              setToolsError(toolsError.message)
              setToolsList([])
            } else if (dbTools) {
              setToolsList(dbTools)
            } else {
              setToolsList([])
            }
          } catch (tErr: any) {
            console.error('Could not load tools from database:', tErr)
            setToolsError(tErr?.message || 'Gagal terhubung ke tabel tools')
            setToolsList([])
          } finally {
            setLoadingTools(false)
          }

          // Load connected tools for agent if saved in database
          if (data.tools && Array.isArray(data.tools)) {
            setConnectedTools(data.tools)
          } else {
            setConnectedTools([])
          }

          // 1. Try to load chat history directly from Supabase
          let loadedFromSupabase = false
          try {
            const { data: dbMessages, error: msgError } = await supabase
              .from('chat_messages')
              .select('*')
              .eq('agent_id', agentId)
              .order('created_at', { ascending: true })

            if (!msgError && dbMessages) {
              const formatted: ChatMessage[] = dbMessages.map((row) => ({
                id: row.id,
                role: row.role as 'user' | 'agent',
                content: row.content || '',
                timestamp: new Date(row.created_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                traces: row.traces || [],
                approvalRequest: row.approval_request || undefined,
                approvalStatus: row.approval_status || undefined,
              }))
              setChatMessages(formatted)
              localStorage.setItem(`grok_bot_chat_${agentId}`, JSON.stringify(formatted))
              loadedFromSupabase = true
              setChatTableMissingNotice(false)
            } else if (msgError) {
              if (
                msgError.code === '42P01' ||
                msgError.message?.includes('does not exist') ||
                msgError.message?.includes('schema cache')
              ) {
                setChatTableMissingNotice(true)
              }
            }
          } catch (dbErr) {
            console.warn('Could not load chat messages from Supabase:', dbErr)
          }

          // 2. Fallback to localStorage if Supabase table not created yet or offline
          if (!loadedFromSupabase) {
            const storageKey = `grok_bot_chat_${agentId}`
            const savedChat = localStorage.getItem(storageKey)
            if (savedChat) {
              try {
                const parsed: ChatMessage[] = JSON.parse(savedChat)
                const isMockMessage = (m: ChatMessage) =>
                  m.content?.includes('Bisakah Anda membantu saya menyiapkan ringkasan') ||
                  m.content?.includes('onboarding pengguna saat ini') ||
                  m.content?.includes('beroperasi menggunakan OpenAI Agent SDK') ||
                  m.content?.includes('Agent runtime berhasil memproses')

                const filtered = parsed.filter((m) => !isMockMessage(m))
                setChatMessages(filtered)
                if (filtered.length !== parsed.length) {
                  localStorage.setItem(storageKey, JSON.stringify(filtered))
                }
              } catch {
                setChatMessages([])
              }
            } else {
              setChatMessages([])
            }
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

  // Clear chat history function (both localStorage and Supabase)
  const handleClearChat = async () => {
    if (confirm('Bersihkan seluruh percakapan agent ini?')) {
      setChatMessages([])
      if (agentId) {
        localStorage.removeItem(`grok_bot_chat_${agentId}`)
        if (user) {
          try {
            await supabase.from('chat_messages').delete().eq('agent_id', agentId).eq('user_id', user.id)
          } catch (e) {
            console.warn('Error clearing Supabase chat messages:', e)
          }
        }
      }
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

  // Stream execution from Agent SDK API
  const runAgentStream = async (userText: string, currentHistory: ChatMessage[], approvedAction?: any) => {
    const agentMsgId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `agent_${Date.now()}`
    const placeholderMsg: ChatMessage = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      traces: [],
      approvalStatus: 'pending',
    }

    const updatedWithAgent = [...currentHistory, placeholderMsg]
    setChatMessages(updatedWithAgent)
    setAgentTyping(true)
    setExpandedTraceMsgId(agentMsgId)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          userPrompt: userText,
          conversationHistory: currentHistory.map((m) => ({ role: m.role, content: m.content })),
          approvedAction: approvedAction || null,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Gagal menghubungkan ke Agent SDK runtime.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.replace('data: ', ''))

            setChatMessages((prev) =>
              prev.map((m) => {
                if (m.id !== agentMsgId) return m

                const traces = [...(m.traces || [])]

                if (event.trace) {
                  const existingIdx = traces.findIndex((t) => t.step === event.trace.step)
                  if (existingIdx >= 0) {
                    traces[existingIdx] = event.trace
                  } else {
                    traces.push(event.trace)
                  }
                }

                if (event.type === 'approval_required') {
                  const apprMsg: ChatMessage = {
                    ...m,
                    traces,
                    approvalRequest: event.data,
                    approvalStatus: 'pending',
                  }
                  persistMessageToSupabase(apprMsg)
                  return apprMsg
                }

                if (event.type === 'final_response' && event.data?.answer) {
                  return {
                    ...m,
                    traces,
                    content: event.data.answer,
                  }
                }

                return { ...m, traces }
              })
            )
          } catch (parseErr) {
            console.error('Error parsing event stream:', parseErr)
          }
        }
      }
    } catch (err: any) {
      console.error('Agent execution error:', err)
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                content:
                  m.content ||
                  `⚠️ **Terjadi Kesalahan**: ${err?.message || 'Gagal memproses pesan dengan model AI. Harap periksa koneksi atau API Key di .env.local.'}`,
              }
            : m
        )
      )
    } finally {
      setAgentTyping(false)
      setChatMessages((latest) => {
        saveChatToStorage(latest)
        const agentFinalMsg = latest.find((m) => m.id === agentMsgId)
        if (agentFinalMsg && agentFinalMsg.content) {
          persistMessageToSupabase(agentFinalMsg)
        }
        return latest
      })
    }
  }

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!chatInput.trim() || agentTyping) return

    const userText = chatInput.trim()
    setChatInput('') // Empty input immediately

    const now = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const msgId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg_${Date.now()}`
    const newUserMsg: ChatMessage = {
      id: msgId,
      role: 'user',
      content: userText,
      timestamp: now,
    }

    const updatedWithUser = [...chatMessages, newUserMsg]
    setChatMessages(updatedWithUser)
    saveChatToStorage(updatedWithUser)
    persistMessageToSupabase(newUserMsg)

    runAgentStream(userText, updatedWithUser)
  }

  // Handle Human-in-the-Loop Approval Action (Step 7)
  const handleApprovalResponse = async (msgId: string, approve: boolean) => {
    const targetMsg = chatMessages.find((m) => m.id === msgId)
    if (!targetMsg || !targetMsg.approvalRequest) return

    if (!approve) {
      // User rejected
      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId) {
            const updated: ChatMessage = {
              ...m,
              approvalStatus: 'rejected',
              content: 'Tindakan dibatalkan sesuai permintaan Anda.',
            }
            persistMessageToSupabase(updated)
            return updated
          }
          return m
        })
      )
      return
    }

    // User approved: resume execution
    setChatMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          const updated: ChatMessage = { ...m, approvalStatus: 'approved' }
          persistMessageToSupabase(updated)
          return updated
        }
        return m
      })
    )

    await runAgentStream('', chatMessages, {
      toolName: targetMsg.approvalRequest.toolName,
      parameters: targetMsg.approvalRequest.parameters,
    })
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
        description: description.trim() || null,
        system_prompt: instructions.trim() || null,
        avatar: avatarString,
        tools: connectedTools,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', agent.id)

      if (error) {
        if (
          error.message.toLowerCase().includes('avatar') ||
          error.message.toLowerCase().includes('tools') ||
          error.message.toLowerCase().includes('schema cache')
        ) {
          const fallbackUpdates = {
            name: name.trim(),
            description: description.trim() || null,
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

  // Duplicate Agent Handler
  const handleDuplicateAgent = async () => {
    if (!agent || !user) return
    try {
      const { data, error } = await supabase
        .from('agents')
        .insert({
          user_id: user.id,
          name: `${name || agent.name} (Copy)`,
          description: description || agent.description,
          system_prompt: instructions || agent.system_prompt,
          avatar: avatarString || agent.avatar,
          model: (agent as any).model || 'gpt-4o-mini',
          tools: (agent as any).tools || [],
        })
        .select()
        .single()
      if (error) throw error
      if (data) {
        router.push(`/workspace/${data.id}`)
      }
    } catch (err: any) {
      alert(`Gagal menduplikasi agent: ${err.message}`)
    }
  }

  // Delete Agent Handler
  const handleDeleteAgent = async () => {
    if (!agent) return
    if (!confirm(`Apakah Anda yakin ingin menghapus agent "${name || agent.name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return
    }
    setDeleting(true)
    try {
      const { error } = await supabase.from('agents').delete().eq('id', agent.id)
      if (error) throw error
      localStorage.removeItem(`grok_bot_chat_${agent.id}`)
      router.push('/workspace')
    } catch (err: any) {
      alert(`Gagal menghapus agent: ${err.message}`)
      setDeleting(false)
    }
  }

  // Reset Agent Handler
  const handleResetAgent = async () => {
    if (confirm('Reset agent akan membersihkan riwayat percakapan?')) {
      await handleClearChat()
    }
  }

  // Fetch Tools directly from Database
  const fetchDatabaseTools = async () => {
    setLoadingTools(true)
    setToolsError(null)
    try {
      const { data: dbTools, error: tErr } = await supabase
        .from('tools')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (tErr) {
        setToolsError(tErr.message)
        setToolsList([])
      } else {
        setToolsList(dbTools || [])
      }
    } catch (err: any) {
      setToolsError(err?.message || 'Gagal memuat tools')
      setToolsList([])
    } finally {
      setLoadingTools(false)
    }
  }

  // Tool Connection Toggle
  const toggleConnectTool = (toolId: string) => {
    setConnectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    )
  }

  // Schedule Day Toggle
  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  // Schedule Summary Formatter
  const formatScheduleSummary = () => {
    if (scheduleMode === 'manual') return 'Manual Trigger'
    if (scheduleMode === 'specific_time') return 'One-time execution'
    const daysText = selectedDays.length === 7 ? 'Every day' : selectedDays.length === 0 ? 'No days selected' : selectedDays.join(', ')
    const [h, m] = scheduleTime.split(':')
    const hour = parseInt(h || '8', 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const formattedHour = hour % 12 || 12
    return `${daysText} at ${formattedHour}:${m || '00'} ${ampm}`
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
      <div className="flex-1 flex flex-col md:flex-row h-full max-h-screen min-h-0 overflow-hidden bg-slate-50">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Main Chat & Agent Playground Area                            */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col min-w-0 h-full max-h-screen overflow-hidden bg-white border-r border-slate-200 relative">
          {/* Header of Chat matching screenshot (Fixed at top) */}
          <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar in header matching agent avatar */}
              <div className="shrink-0">
                {renderAgentAvatar(avatarString || agent?.avatar, false, 'md', isActive)}
              </div>

              {/* Agent Title & Subtitle */}
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm md:text-base font-bold text-slate-900 leading-tight truncate">
                    {name || agent.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                    OpenAI + Gemini Fallback
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate leading-tight">
                  {agent.description || 'Personal research agent'}
                </p>
              </div>
            </div>

            {/* Action buttons: Clear Chat & Active Toggle */}
            <div className="flex items-center gap-2 sm:gap-3">

              {chatMessages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                  title="Bersihkan riwayat percakapan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bersihkan Chat</span>
                </button>
              )}

              {/* Active Toggle Switch */}
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

          {/* Database Migration Notice Banner if Supabase table is not yet migrated */}
          {chatTableMissingNotice && (
            <div className="mx-4 md:mx-6 mt-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs shrink-0 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <Database className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold">Tabel public.chat_messages belum dibuat di Supabase.</span>{' '}
                  <span className="text-amber-800">
                    Pesan sementara disimpan di browser. Jalankan skrip migrasi SQL di Supabase agar tersimpan permanen di cloud.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shrink-0 text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>Lihat SQL</span>
              </button>
            </div>
          )}

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-white">
            {chatMessages.length === 0 ? (
              <div className="max-w-2xl mx-auto py-6 px-2 md:px-4 space-y-5 animate-in fade-in duration-300">
                {/* Agent Header Intro */}
                <div className="text-center space-y-2">
                  <div className="relative inline-block">
                    {renderAgentAvatar(avatarString || agent?.avatar, false, 'xl', true)}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {name || agent.name}
                  </h2>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    {description || agent.description || 'AI Agent siap membantu tugas Anda dengan integrasi tools dan failover multi-model.'}
                  </p>
                </div>

                {/* Dummy Conversation Preview matching User Diagram & Prompt */}
                <div className="p-4 md:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="font-semibold uppercase tracking-wider text-slate-500">Pratinjau Percakapan</span>
                    <span>Contoh Alur Chat</span>
                  </div>

                  {/* Dummy User Message */}
                  <div className="flex justify-end">
                    <div className="max-w-md bg-blue-600 text-white text-xs px-4 py-2.5 rounded-2xl shadow-xs leading-relaxed">
                      Help me plan a team offsite.
                    </div>
                  </div>

                  {/* Dummy Agent Message */}
                  <div className="flex items-start gap-3 max-w-md">
                    <div className="shrink-0 mt-0.5">
                      {renderAgentAvatar(avatarString || agent?.avatar, false, 'sm', true)}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 leading-relaxed shadow-xs">
                      I can help with that! Let me gather a few details and create a plan for you.
                    </div>
                  </div>

                  {/* Quick Action Suggestion Chips from Image */}
                  <div className="pt-2 border-t border-slate-200/70 flex flex-wrap gap-2">
                    {[
                      'Suggest locations',
                      'Estimate budget',
                      'Create itinerary',
                      'Siapa kamu dan bagaimana kamu bisa membantu tugas saya?',
                    ].map((promptText, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setChatInput(promptText)
                          chatInputRef.current?.focus()
                        }}
                        className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/60 text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        <span>{promptText}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => {
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

              const hasTraces = msg.traces && msg.traces.length > 0
              const isTraceExpanded = expandedTraceMsgId === msg.id

              // Agent message matching screenshot
              return (
                <div key={msg.id} className="flex items-start gap-3 max-w-2xl">
                  {/* Agent avatar matching agent configuration */}
                  <div className="shrink-0 mt-0.5">
                    {renderAgentAvatar(avatarString || agent?.avatar, false, 'sm', false)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Agent Name + Timestamp */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        {name || agent.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* 8-Step Agent SDK Trace Badge */}
                    {hasTraces && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-xs transition-all">
                        <button
                          type="button"
                          onClick={() => setExpandedTraceMsgId(isTraceExpanded ? null : msg.id)}
                          className="w-full flex items-center justify-between text-left font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-semibold text-[11px] text-slate-800">
                              Agent SDK Execution Flow ({msg.traces!.length}/8 Steps)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="text-[10px]">Detail</span>
                            {isTraceExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </button>

                        {/* Collapsible 8-step timeline */}
                        {isTraceExpanded && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1.5">
                            {msg.traces!.map((trace, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 text-[11px] py-1 px-1.5 rounded hover:bg-white/80 transition-colors"
                              >
                                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {trace.stepNumber}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-900">
                                      {trace.title}
                                    </span>
                                    <span
                                      className={`text-[9px] font-mono px-1 rounded uppercase ${
                                        trace.status === 'completed'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : trace.status === 'waiting_approval'
                                          ? 'bg-amber-50 text-amber-700 font-bold'
                                          : 'bg-blue-50 text-blue-700'
                                      }`}
                                    >
                                      {trace.status}
                                    </span>
                                  </div>
                                  <p className="text-slate-500 text-[10px] leading-tight">
                                    {trace.description}
                                  </p>
                                  {trace.details?.activeProvider && (
                                    <span className="inline-block mt-1 text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                      Provider: {trace.details.activeProvider}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 7: Human-in-the-Loop Approval Confirmation Card */}
                    {msg.approvalRequest && msg.approvalStatus === 'pending' && (
                      <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-950 space-y-2.5 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-amber-700" />
                          <span className="text-xs font-bold">
                            Persetujuan Diperlukan (Human-in-the-Loop)
                          </span>
                        </div>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          Agent meminta konfirmasi Anda untuk mengeksekusi aksi:
                          <strong className="block mt-0.5 font-mono text-amber-950">
                            {msg.approvalRequest.toolName} ({msg.approvalRequest.parameters.actionType || 'action'})
                          </strong>
                          <span className="text-[11px] text-amber-800 block mt-1">
                            {msg.approvalRequest.reason}
                          </span>
                        </p>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApprovalResponse(msg.id, true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer active:scale-95 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Setujui Tindakan (Approve)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprovalResponse(msg.id, false)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs cursor-pointer active:scale-95 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Message Bubble Card */}
                    {msg.content && (
                      <div className="space-y-1.5">
                        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm text-slate-800 leading-relaxed shadow-xs whitespace-pre-wrap">
                          {msg.content}
                        </div>

                        {/* Transparent AI Provider Badge */}
                        {msg.traces?.find((t) => t.step === 'final_response')?.details?.activeProvider && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-2 pt-0.5">
                            <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>
                              Model Aktif:{' '}
                              <strong className="text-slate-600 font-semibold font-mono">
                                {msg.traces.find((t) => t.step === 'final_response')?.details?.activeProvider}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            }))}

            {/* Agent Typing Indicator */}
            {agentTyping && (
              <div className="flex items-start gap-3 max-w-2xl animate-in fade-in">
                <div className="shrink-0 mt-0.5">
                  {renderAgentAvatar(avatarString || agent?.avatar, false, 'sm', false)}
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium mr-1">
                    Agent SDK sedang memproses...
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Bottom Input (Permanently Fixed at Bottom) */}
          <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0 sticky bottom-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
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
        {/* RIGHT COLUMN: "Agent Configuration" Panel (Fixed on right)                */}
        {/* ========================================================================= */}
        <aside className="w-full md:w-96 lg:w-[420px] xl:w-[440px] bg-white flex flex-col shrink-0 h-full max-h-screen border-t md:border-t-0 md:border-l border-slate-200 overflow-hidden sticky md:top-0 right-0 z-10">
          {/* Header of Configuration Panel (Fixed at top of panel) */}
          <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-900 leading-tight">
                Agent Configuration
              </h2>
              <p className="text-[11px] text-slate-500 leading-tight">
                Customize how your agent works
              </p>
            </div>

            {/* Blue Save Button aligned to top-right with floppy disk icon */}
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

          {/* Configuration Form Body (Scrollable inside fixed panel) */}
          <div className="p-5 space-y-6 flex-1 overflow-y-auto min-h-0">
            {/* 1. Agent Avatar & Shuffle Button */}
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900">Agent avatar</h3>
                <p className="text-[11px] text-slate-500">
                  Give your agent a distinct look.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="shrink-0">
                  {renderAgentAvatar(avatarString, false, 'xl')}
                </div>

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

            {/* 2. Agent Name Input */}
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

            {/* 3. Icon-Only Tab Bar with Tooltips */}
            <div className="flex items-center justify-around border-b border-slate-200 pt-1 pb-0">
              {/* Tab 1: Settings (Sliders) */}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex-1 pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] flex justify-center ${
                  activeTab === 'settings'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Settings - Agent description and instructions"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Tab 2: Tools (Wrench) */}
              <button
                type="button"
                onClick={() => setActiveTab('tools')}
                className={`flex-1 pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] flex justify-center ${
                  activeTab === 'tools'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Tools - Apps/tools the agent needs to connect to"
              >
                <Wrench className="w-4 h-4" />
              </button>

              {/* Tab 3: Schedule (Calendar) */}
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`flex-1 pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] flex justify-center ${
                  activeTab === 'schedule'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Schedule - Configure recurring execution time"
              >
                <Calendar className="w-4 h-4" />
              </button>

              {/* Tab 4: Agent Settings (Settings) */}
              <button
                type="button"
                onClick={() => setActiveTab('agent_settings')}
                className={`flex-1 pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] flex justify-center ${
                  activeTab === 'agent_settings'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Agent Settings - Additional options such as deleting or managing the agent"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* TAB 1: Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Agent Description Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="config-description"
                    className="block text-xs font-bold text-slate-900"
                  >
                    Agent Description
                  </label>
                  <input
                    id="config-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Helps with planning, research and task automation"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">
                    Ringkasan singkat fungsi dan tujuan agent ini.
                  </p>
                </div>

                {/* Agent Instructions Field (Larger textarea) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="config-instructions"
                      className="block text-xs font-bold text-slate-900"
                    >
                      Agent Instructions
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
                    placeholder="Describe the agent's purpose, behavior, tone, rules, and response preferences in detail..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-normal leading-relaxed shadow-2xs transition-all"
                  />

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Instruksi sistem yang akan dibentuk oleh Prompt Builder untuk memandu model AI.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: Tools Tab */}
            {activeTab === 'tools' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Connected Tools</h4>
                    <p className="text-[11px] text-slate-500">
                      Pilih dan hubungkan tools aplikasi dari database untuk agent ini.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchDatabaseTools}
                      disabled={loadingTools}
                      title="Muat ulang dari database"
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingTools ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                    <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      {connectedTools.length} Aktif
                    </span>
                  </div>
                </div>

                {/* Category Filter Pills (if tools available) */}
                {availableCategories.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {availableCategories.map((cat) => {
                      const count = cat === 'All' ? toolsList.length : toolsList.filter((t) => t.category === cat).length
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setToolsCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                            toolsCategory === cat
                              ? 'bg-slate-900 text-white font-semibold shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          {cat} <span className="opacity-70 text-[10px]">({count})</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Loading state */}
                {loadingTools ? (
                  <div className="py-12 text-center space-y-2.5">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
                    <p className="text-xs text-slate-600 font-medium">Memuat data tools dari database...</p>
                    <p className="text-[11px] text-slate-400">Mengambil dari tabel public.tools</p>
                  </div>
                ) : toolsError ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Gagal Mengambil Data Tools Dari Database</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      {toolsError}
                    </p>
                    <button
                      type="button"
                      onClick={fetchDatabaseTools}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Coba Muat Ulang</span>
                    </button>
                  </div>
                ) : toolsList.length === 0 ? (
                  <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 space-y-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Belum Ada Tools di Database</h5>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed mt-1">
                        Tabel <code className="font-mono text-blue-600 font-semibold">public.tools</code> belum memiliki data aktif. Masukkan data ke database dengan perintah SQL INSERT.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={fetchDatabaseTools}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh dari Database</span>
                    </button>
                  </div>
                ) : (
                  /* Tools List strictly from database */
                  <div className="space-y-2.5">
                    {toolsList
                      .filter((t) => toolsCategory === 'All' || t.category === toolsCategory)
                      .map((tool) => {
                        const isConnected = connectedTools.includes(tool.slug)
                        return (
                          <div
                            key={tool.slug}
                            className="flex items-start justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {/* App Icon (SimpleIcons CDN or Fallback) */}
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-200 shrink-0 p-1.5 shadow-2xs mt-0.5">
                                {tool.icon?.startsWith('http') ? (
                                  <img
                                    src={tool.icon}
                                    alt={tool.name}
                                    className="w-5 h-5 object-contain"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Wrench className="w-4 h-4 text-slate-600" />
                                )}
                              </div>

                              {/* Name, Category, & Description */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    {tool.name}
                                  </span>
                                  {tool.category && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                      {tool.category}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug line-clamp-2 mt-0.5">
                                  {tool.description}
                                </p>
                              </div>
                            </div>

                            {/* Connect / Connected Button */}
                            <button
                              type="button"
                              onClick={() => toggleConnectTool(tool.slug)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs mt-1 ${
                                isConnected
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {isConnected ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Connected</span>
                                </>
                              ) : (
                                <span>Connect</span>
                              )}
                            </button>
                          </div>
                        )
                      })}
                  </div>
                )}

                {/* Database Info Indicator */}
                {!loadingTools && !toolsError && toolsList.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-500 text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span>Data dari database: <code className="font-mono text-blue-600 font-semibold">public.tools</code></span>
                    </span>
                    <span className="text-[10px] text-slate-600 font-medium">
                      {toolsList.length} Tools Siap
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Schedule Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Execution Schedule</h4>
                  <p className="text-[11px] text-slate-500">
                    Konfigurasikan jadwal eksekusi otomatis untuk agent Anda.
                  </p>
                </div>

                {/* Mode Selector: Manual / Recurring / Specific Time */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {(['manual', 'recurring', 'specific_time'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setScheduleMode(mode)}
                      className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${
                        scheduleMode === mode
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode === 'manual' ? 'Manual' : mode === 'recurring' ? 'Recurring' : 'Specific Time'}
                    </button>
                  ))}
                </div>

                {scheduleMode === 'recurring' && (
                  <div className="space-y-3.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                    {/* Frequency */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-900">Frequency</label>
                      <select
                        value={scheduleFrequency}
                        onChange={(e) => setScheduleFrequency(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    {/* Time */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-900">Time</label>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    {/* Days */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-900">Days</label>
                      <div className="grid grid-cols-7 gap-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                          const isSelected = selectedDays.includes(day)
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(day)}
                              className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {day}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Schedule Summary Box */}
                    <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-blue-700 block">Jadwal Eksekusi</span>
                        <span className="font-semibold">{formatScheduleSummary()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {scheduleMode === 'manual' && (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                    <Sliders className="w-5 h-5 text-slate-400 mx-auto" />
                    <div className="text-xs font-semibold text-slate-700">Eksekusi Manual</div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Agent hanya akan berjalan saat menerima pesan interaktif dari pengguna di playground.
                    </p>
                  </div>
                )}

                {scheduleMode === 'specific_time' && (
                  <div className="space-y-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <label className="block text-xs font-bold text-slate-900">Pilih Waktu Spesifik</label>
                    <input
                      type="datetime-local"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="text-[11px] text-slate-500">
                      Agent akan dieksekusi satu kali tepat pada waktu yang ditentukan.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Agent Settings Tab */}
            {activeTab === 'agent_settings' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900">General Options</h4>
                  <div className="space-y-1.5">
                    {/* Duplicate Agent */}
                    <button
                      type="button"
                      onClick={handleDuplicateAgent}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 transition-all shadow-2xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Copy className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                        <span>Duplicate Agent</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Clone config</span>
                    </button>

                    {/* Pause Agent */}
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 transition-all shadow-2xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        {isActive ? (
                          <Pause className="w-4 h-4 text-slate-500 group-hover:text-amber-600 transition-colors" />
                        ) : (
                          <Play className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
                        )}
                        <span>{isActive ? 'Pause Agent' : 'Resume Agent'}</span>
                      </div>
                      <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                        {isActive ? 'Active' : 'Paused'}
                      </span>
                    </button>

                    {/* Reset Agent */}
                    <button
                      type="button"
                      onClick={handleResetAgent}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 transition-all shadow-2xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <RotateCcw className="w-4 h-4 text-slate-500 group-hover:text-slate-700 transition-colors" />
                        <span>Reset Agent</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Clear chat</span>
                    </button>
                  </div>
                </div>

                {/* AI Model Architecture Summary */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5 text-left">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    AI Failover Architecture
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Primary Model:</span>
                      <span className="font-mono text-blue-700 font-semibold bg-blue-50 px-1 rounded">OpenAI gpt-4o-mini</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Auto-Fallback:</span>
                      <span className="font-mono text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">Google Gemini 2.5</span>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-rose-600">Danger Zone</div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Tindakan ini permanen. Agen dan seluruh riwayat obrolannya akan dihapus dari database.
                  </p>

                  <button
                    type="button"
                    onClick={handleDeleteAgent}
                    disabled={deleting}
                    className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>{deleting ? 'Menghapus...' : 'Delete Agent'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* SQL Migration Modal for Supabase Database Persistence */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Skrip Migrasi SQL Supabase</h3>
                  <p className="text-xs text-slate-500">
                    Jalankan skrip ini di Supabase Dashboard &rarr; SQL Editor
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSqlModalTab('tools')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 -mb-[1px] transition-colors cursor-pointer ${
                  sqlModalTab === 'tools'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Tabel Tools (8 Aplikasi)
              </button>
              <button
                type="button"
                onClick={() => setSqlModalTab('chat')}
                className={`pb-2.5 px-3 text-xs font-semibold border-b-2 -mb-[1px] transition-colors cursor-pointer ${
                  sqlModalTab === 'chat'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Tabel Chat Messages
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600">
              {sqlModalTab === 'tools' ? (
                <>
                  <p className="leading-relaxed">
                    Skrip SQL berikut membuat tabel <code className="font-mono text-blue-600 font-semibold">public.tools</code>, menambahkan kolom <code className="font-mono text-blue-600 font-semibold">tools</code> pada tabel agents, dan langsung mengisikan data 8 tools (Slack, Gmail, Outlook, Notion, Calendar, Docs, GitHub, Reddit) lengkap dengan icon CDN.
                  </p>

                  <div className="relative group">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed selection:bg-blue-600 selection:text-white">
                      {TOOLS_MIGRATION_SQL}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(TOOLS_MIGRATION_SQL)
                        setCopiedSql(true)
                        setTimeout(() => setCopiedSql(false), 2000)
                      }}
                      className="absolute top-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin SQL Tools</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="leading-relaxed">
                    Skrip SQL berikut membuat tabel <code className="font-mono text-blue-600 font-semibold">public.chat_messages</code> untuk menyimpan riwayat percakapan dan multi-step execution traces secara aman dengan Row Level Security (RLS).
                  </p>

                  <div className="relative group">
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed selection:bg-blue-600 selection:text-white">
                      {CHAT_MIGRATION_SQL}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(CHAT_MIGRATION_SQL)
                        setCopiedSql(true)
                        setTimeout(() => setCopiedSql(false), 2000)
                      }}
                      className="absolute top-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin SQL Chat</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  Keamanan &amp; Performa Optimal
                </div>
                <p className="text-blue-700">
                  Semua tabel telah dilengkapi dengan index pencarian cepat serta Row Level Security (RLS) terisolasi.
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                File lokal: <code className="font-mono">{sqlModalTab === 'tools' ? 'supabase/migration_add_tools.sql' : 'supabase/migration_add_chat_messages.sql'}</code>
              </span>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
