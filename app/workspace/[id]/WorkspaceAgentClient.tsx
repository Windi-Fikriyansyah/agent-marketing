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
  Globe,
  ExternalLink,
} from 'lucide-react'
import { AgentStepTrace, ApprovalRequest, RecurringTaskSchema } from '@/lib/agent-sdk/types'
import { buildAgentInstructions } from '@/lib/agent-sdk/instructions'
import { AgentResponseView } from '@/components/routine/AgentResponseView'
import { AgentResponse, RoutineDraft } from '@/lib/agent-sdk/schema/routine'

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
  auth_status?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  traces?: AgentStepTrace[]
  approvalRequest?: ApprovalRequest | null
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  taskSchema?: RecurringTaskSchema
  response?: AgentResponse | null
  toolCards?: any[]
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
  const [activeTab, setActiveTab] = useState<'settings' | 'tools' | 'schedule' | 'agent_settings' | 'browser'>('settings')

  // Cloud Browser Live View state (Browserbase + Stagehand v4)
  const [activeBrowser, setActiveBrowser] = useState<{
    sessionId: string
    debuggerUrl: string
    currentUrl?: string
    title?: string
    isActive: boolean
  } | null>(null)
  const [closingBrowser, setClosingBrowser] = useState(false)

  const handleCloseBrowser = async () => {
    setClosingBrowser(true)
    try {
      const res = await fetch('/api/browser/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id || user?.email }),
      })
      const data = await res.json()
      if (data.success) {
        setActiveBrowser(null)
      }
    } catch (err) {
      console.warn('Gagal menutup sesi browser:', err)
    } finally {
      setClosingBrowser(false)
    }
  }

  // Tools Tab state (Strictly from Database, no dummy data)
  const [toolsList, setToolsList] = useState<ToolItem[]>([])
  const [loadingTools, setLoadingTools] = useState<boolean>(true)
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [toolsCategory, setToolsCategory] = useState<string>('All')
  const [connectedTools, setConnectedTools] = useState<string[]>([])

  // Composio & Recurring Task state (Phase 1 & Phase 2 from flow diagram)
  const [composioSessionId, setComposioSessionId] = useState<string>('')
  const [copiedSessionId, setCopiedSessionId] = useState(false)
  const [generatingSession, setGeneratingSession] = useState(false)
  const [recurringTask, setRecurringTask] = useState<RecurringTaskSchema | null>(null)
  const [modelName, setModelName] = useState<string>('thinkingmachines/inkling:free')
  const [modelCatalog, setModelCatalog] = useState<any[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [savingModel, setSavingModel] = useState(false)

  // Load OpenRouter dynamic model catalog (KEBUTUHAN B & C)
  useEffect(() => {
    async function loadModels() {
      try {
        setLoadingModels(true)
        const res = await fetch('/api/models')
        const data = await res.json()
        if (data.models && Array.isArray(data.models)) {
          setModelCatalog(data.models)
        }
      } catch (e) {
        console.warn('Gagal memuat katalog model OpenRouter:', e)
      } finally {
        setLoadingModels(false)
      }
    }
    loadModels()
  }, [])

  // Poll / check active cloud browser session on mount or user change
  useEffect(() => {
    if (!user) return
    fetch(`/api/browser/live?userId=${encodeURIComponent(user.id || user.email || '')}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.active && data.debuggerUrl) {
          setActiveBrowser({
            sessionId: data.sessionId,
            debuggerUrl: data.debuggerUrl,
            isActive: true,
          })
        }
      })
      .catch(() => {})
  }, [user])

  const handleModelChange = async (newModelId: string) => {
    setModelName(newModelId)
    try {
      setSavingModel(true)
      await fetch('/api/models', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, modelId: newModelId }),
      })
    } catch (e) {
      console.warn('Gagal menyimpan model ke database:', e)
    } finally {
      setSavingModel(false)
    }
  }

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
          setAvatarString(data.avatar || 'orange-circle-happy')

          // Load composio_session_id: reuse existing if available, or generate and persist to DB
          if (data.composio_session_id && data.composio_session_id.trim().length > 0) {
            setComposioSessionId(data.composio_session_id)
          } else {
            // Agent does not have session ID yet: initialize and persist to database
            fetch('/api/composio/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agentId,
                toolkits: data.tools || [],
                userId: currentUser?.id || currentUser?.email,
              }),
            })
              .then((r) => r.json())
              .then((resData) => {
                if (resData.sessionId) {
                  setComposioSessionId(resData.sessionId)
                }
              })
              .catch(console.warn)
          }

          // Load Phase 2 Recurring Task Schema if saved in database
          if (data.recurring_task_schema) {
            setRecurringTask(data.recurring_task_schema)
            if (data.recurring_task_schema.frequency) {
              setScheduleMode('recurring')
              setScheduleFrequency(data.recurring_task_schema.frequency)
              if (data.recurring_task_schema.time) setScheduleTime(data.recurring_task_schema.time)
            }
          }

          if (data.model) {
            setModelName(data.model)
          }

          // If instructions is empty, initialize using buildAgentInstructions from Image 2
          if (!data.system_prompt) {
            const defaultPrompt = buildAgentInstructions(
              data.name || 'AI Agent',
              'You assist users in executing tasks, managing tools, and handling automated workflows.'
            )
            setInstructions(defaultPrompt)
          } else {
            setInstructions(data.system_prompt)
          }

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

          // Load connected tools for agent and synchronize strictly with Composio active status
          const rawDbTools = data.tools && Array.isArray(data.tools) ? data.tools : []
          setConnectedTools(rawDbTools)

          // Strict verification with Composio API: only tools with ACTIVE status in Composio are considered connected
          fetch(`/api/composio/status?userId=${encodeURIComponent(data.user_id || user?.email || '')}&agentId=${agentId}`)
            .then((r) => r.json())
            .then((statusRes) => {
              if (statusRes.activeToolkits && Array.isArray(statusRes.activeToolkits)) {
                const realActive = statusRes.activeToolkits.map((t: string) => t.toLowerCase())
                setConnectedTools(realActive)
                // If database had tools that are no longer active, sync the database
                if (JSON.stringify([...rawDbTools].sort()) !== JSON.stringify([...realActive].sort())) {
                  supabase.from('agents').update({ tools: realActive }).eq('id', agentId).then(undefined, console.warn)
                }
              }
            })
            .catch(console.warn)

          // 1. Try to load chat history directly from Supabase
          let loadedFromSupabase = false
          try {
            const { data: dbMessages, error: msgError } = await supabase
              .from('chat_messages')
              .select('*')
              .eq('agent_id', agentId)
              .order('created_at', { ascending: true })

            if (!msgError && dbMessages) {
              const formatted: ChatMessage[] = dbMessages.map((row) => {
                const step8 = row.traces?.find((t: any) => t.step === 'final_response')
                const response: AgentResponse | null = step8?.details?.agentResponse || (row as any).response || null
                return {
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
                  response,
                }
              })
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
  const runAgentStream = async (
    userText: string,
    currentHistory: ChatMessage[],
    approvedAction?: any,
    overrideConnectedTools?: string[]
  ) => {
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
      const toolsToUse = overrideConnectedTools || connectedTools
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          userPrompt: userText,
          conversationHistory: currentHistory.map((m) => ({ role: m.role, content: m.content })),
          approvedAction: approvedAction || null,
          composioSessionId,
          connectedTools: toolsToUse,
          model: modelName,
          userId: user?.id || user?.email,
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

                if (event.type === 'token') {
                  const token = event.data?.token || ''
                  return {
                    ...m,
                    traces,
                    content: (m.content || '') + token,
                  }
                }

                if (event.type === 'connect_required') {
                  const connectData = event.data || {}
                  const slug = (connectData.toolkit || '').toLowerCase()
                  const existingCards = m.toolCards || []
                  const alreadyExists = existingCards.some((tc) => tc.slug === slug)
                  const newCards = alreadyExists
                    ? existingCards
                    : [
                        ...existingCards,
                        {
                          slug,
                          name: slug.toUpperCase(),
                          icon: '',
                          isConnected: false,
                          connectLink: connectData.connectLink,
                          reason: connectData.message || `Diperlukan otorisasi OAuth untuk ${slug.toUpperCase()}`,
                        },
                      ]
                  return {
                    ...m,
                    traces,
                    toolCards: newCards,
                  }
                }

                if (event.type === 'browser_live_view') {
                  const bData = event.data || {}
                  setActiveBrowser({
                    sessionId: bData.sessionId,
                    debuggerUrl: bData.debuggerUrl,
                    currentUrl: bData.currentUrl,
                    title: bData.title,
                    isActive: true,
                  })
                  setActiveTab('browser')
                }

                if (event.type === 'error') {
                  setAgentTyping(false)
                  const errMsg = event.data?.error || event.error || 'Terjadi kesalahan sistem'
                  return {
                    ...m,
                    traces,
                    content: (m.content ? m.content + '\n\n' : '') + `⚠️ **Error**: ${errMsg}`,
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

                if (event.type === 'final_response') {
                  setAgentTyping(false)
                  const finalAnswer = event.data?.answer || m.content || event.agentResponse?.message || ''
                  let taskSchema: RecurringTaskSchema | undefined = event.taskSchema
                  if (!taskSchema && finalAnswer.includes('{') && finalAnswer.includes('"instruction"')) {
                    try {
                      const match = finalAnswer.match(/\{[\s\S]*?"instruction"[\s\S]*?\}/)
                      if (match) taskSchema = JSON.parse(match[0])
                    } catch {}
                  }

                  if (taskSchema) {
                    setRecurringTask(taskSchema)
                    // Persist recurring task schema to database (Phase 2 Step 9)
                    fetch('/api/composio/recurring-task', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ agentId, taskSchema }),
                    }).catch(console.warn)
                  }

                  const agentResp: AgentResponse | undefined = event.agentResponse
                  const requiredSlugs = (agentResp?.routine?.tools || agentResp?.suggestedTools || []).map((t) => t.slug.toLowerCase())
                  const toolCards = requiredSlugs.map((slug) => {
                    const dbTool = toolsList.find((t) => t.slug.toLowerCase() === slug)
                    return {
                      slug,
                      name: dbTool?.name || slug.toUpperCase(),
                      icon: dbTool?.icon || '',
                      isConnected: toolsToUse.map((c) => c.toLowerCase()).includes(slug),
                      reason:
                        agentResp?.routine?.tools?.find((t) => t.slug.toLowerCase() === slug)?.reason ||
                        agentResp?.suggestedTools?.find((t) => t.slug.toLowerCase() === slug)?.reason ||
                        'Integrasi aplikasi untuk eksekusi otomatis',
                    }
                  })

                  return {
                    ...m,
                    traces,
                    content: finalAnswer,
                    taskSchema,
                    response: agentResp || null,
                    toolCards: toolCards.length > 0 ? toolCards : m.toolCards,
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

  // Send text message (used by form submit and Generative UI option buttons)
  const sendMessageText = (text: string) => {
    if (!text.trim() || agentTyping) return

    const userText = text.trim()
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

  // Send message from chat form
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    sendMessageText(chatInput)
  }

  // Handle Create Routine action from Generative UI RoutineCard (Image 5 & Image 1 Step 6)
  const handleCreateRoutineFromDraft = async (routine: RoutineDraft, msgId?: string) => {
    try {
      // 1. Update schedule settings in workspace state
      setScheduleMode('recurring')
      setScheduleFrequency(routine.schedule.frequency || 'weekly')
      if (routine.schedule.time) {
        setScheduleTime(routine.schedule.time)
      }
      if (routine.schedule.weekdays && routine.schedule.weekdays.length > 0) {
        const dayMap: Record<string, string> = {
          MO: 'Mon',
          TU: 'Tue',
          WE: 'Wed',
          TH: 'Thu',
          FR: 'Fri',
          SA: 'Sat',
          SU: 'Sun',
        }
        setSelectedDays(routine.schedule.weekdays.map((d) => dayMap[d] || d))
      }

      const newSchema: RecurringTaskSchema = {
        instruction: routine.instructions || routine.name,
        route: routine.tools?.[0]?.slug || 'slack',
        time: routine.schedule?.time || '08:00 AM',
        frequency: (routine.schedule?.frequency as any) || 'weekly',
      }
      setRecurringTask(newSchema)

      // 2. Persist to routines database table and agent configuration
      if (user && agentId) {
        try {
          const { error: routineErr } = await supabase.from('routines').upsert({
            agent_id: agentId,
            user_email: user.email || 'user@orbit.local',
            name: routine.name,
            goal: routine.goal,
            instructions: routine.instructions,
            schedule: routine.schedule,
            tools: routine.tools,
            is_active: true,
          })
          if (routineErr) {
            console.warn('Could not insert to routines table:', routineErr)
          }
        } catch (dbErr) {
          console.warn('Could not insert to routines table:', dbErr)
        }

        // Also update agent recurring task schema in Supabase
        try {
          const { error: agentErr } = await supabase
            .from('agents')
            .update({
              recurring_task_schema: newSchema,
              updated_at: new Date().toISOString(),
            })
            .eq('id', agentId)
          if (agentErr) {
            console.warn('Could not update agent recurring_task_schema:', agentErr)
          }
        } catch (agentErr) {
          console.warn('Could not update agent in Supabase:', agentErr)
        }
      }

      // 3. Mark message state as 'completed'
      if (msgId) {
        setChatMessages((prev) =>
          prev.map((m) => {
            if (m.id === msgId && m.response) {
              const updatedResp: AgentResponse = {
                ...m.response,
                type: 'completed',
                message: `Routine "${routine.name}" telah aktif dan tersimpan di database.`,
              }
              const updatedMsg = { ...m, response: updatedResp }
              persistMessageToSupabase(updatedMsg)
              return updatedMsg
            }
            return m
          })
        )
      }
    } catch (err) {
      console.error('Failed to create routine:', err)
    }
  }

  // Handle direct tool connection with Real Composio OAuth Request
  const handleConnectTool = async (slug: string, autoAdvanceChat: boolean = true) => {
    const normalizedSlug = slug.toLowerCase()

    // 1. Request real Composio OAuth connection link
    try {
      const res = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolkit: normalizedSlug,
          userId: user?.email || agentId || 'default_user',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.redirectUrl) {
          // Open Composio OAuth authorization window
          const width = 600
          const height = 750
          const left = window.screen.width / 2 - width / 2
          const top = window.screen.height / 2 - height / 2
          const popup = window.open(
            data.redirectUrl,
            `composio_connect_${normalizedSlug}`,
            `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
          )

          // Wait for authorization to complete via popup postMessage or popup close
          await new Promise<void>((resolve) => {
            const handleMessage = (e: MessageEvent) => {
              if (e.data?.type === 'COMPOSIO_OAUTH_SUCCESS') {
                window.removeEventListener('message', handleMessage)
                clearInterval(checkTimer)
                resolve()
              }
            }
            window.addEventListener('message', handleMessage)

            const checkTimer = setInterval(() => {
              if (!popup || popup.closed) {
                clearInterval(checkTimer)
                window.removeEventListener('message', handleMessage)
                resolve()
              }
            }, 1000)
          })
        }
      }
    } catch (oauthErr) {
      console.warn('Composio OAuth flow warning:', oauthErr)
    }

    // 2. Wait a moment for Composio webhooks / callback to finalize
    await new Promise((r) => setTimeout(r, 1500))

    // 3. Strictly verify with Composio API if this toolkit is ACTUALLY connected and ACTIVE
    let isReallyConnected = false
    try {
      const verifyRes = await fetch(
        `/api/composio/status?toolkit=${encodeURIComponent(normalizedSlug)}&userId=${encodeURIComponent(user?.id || user?.email || agentId || '')}&agentId=${agentId}`
      )
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json()
        isReallyConnected = Boolean(verifyData.connected)
      }
    } catch (vErr) {
      console.warn('Could not verify status with Composio:', vErr)
    }

    if (!isReallyConnected) {
      console.warn(`[Composio OAuth] ${normalizedSlug} was NOT connected. Modal closed without active authorization.`)
      alert(
        `Otorisasi ${normalizedSlug.toUpperCase()} belum selesai atau jendela ditutup sebelum login selesai. Status belum terhubung di Composio.`
      )
      return
    }

    // 4. Real connection confirmed: Update connected tools state and database
    const updatedTools = Array.from(new Set([...connectedTools.map((t) => t.toLowerCase()), normalizedSlug]))
    setConnectedTools(updatedTools)

    // Save to agents table in Supabase
    if (agentId) {
      try {
        await supabase.from('agents').update({ tools: updatedTools }).eq('id', agentId)
      } catch (err) {
        console.warn('Could not update agent tools in Supabase:', err)
      }
    }

    // Update existing message cards to show this tool as connected immediately
    const updatedHistory = chatMessages.map((m) => {
      const toolCards = m.toolCards?.map((tc) =>
        tc.slug.toLowerCase() === normalizedSlug ? { ...tc, isConnected: true } : tc
      )
      return { ...m, toolCards }
    })
    setChatMessages(updatedHistory)
    saveChatToStorage(updatedHistory)

    // Automatically advance conversation if requested
    if (autoAdvanceChat) {
      await runAgentStream(`Aplikasi ${normalizedSlug.toUpperCase()} telah terhubung. Lanjutkan setup routine.`, updatedHistory, null, updatedTools)
    }
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
        composio_session_id: composioSessionId,
        recurring_task_schema: recurringTask,
        model: modelName,
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
          error.message.toLowerCase().includes('composio') ||
          error.message.toLowerCase().includes('recurring') ||
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

  // Generate / Refresh Composio Session (Phase 1 Step 5)
  const handleCreateComposioSession = async (force: boolean = false) => {
    setGeneratingSession(true)
    try {
      const res = await fetch('/api/composio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, toolkits: connectedTools, forceNew: force }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.sessionId) {
          setComposioSessionId(data.sessionId)
        }
      }
    } catch (e) {
      console.warn('Failed to get/generate Composio session:', e)
    } finally {
      setGeneratingSession(false)
    }
  }

  // Tool Connection Toggle with Real Composio OAuth
  const toggleConnectTool = async (toolId: string) => {
    const isCurrentlyConnected = connectedTools.includes(toolId)
    if (isCurrentlyConnected) {
      const updated = connectedTools.filter((t) => t !== toolId)
      setConnectedTools(updated)
      if (agentId) {
        try {
          await supabase.from('agents').update({ tools: updated }).eq('id', agentId)
        } catch (err) {
          console.warn('Failed to update tools in Supabase:', err)
        }
      }
      return
    }

    // Connect via real OAuth
    await handleConnectTool(toolId, false)
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
                            {msg.approvalRequest.toolName} ({msg.approvalRequest.parameters?.action || msg.approvalRequest.parameters?.actionType || 'action'})
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

                    {/* Message Bubble Card with Generative UI */}
                    {(msg.content || msg.response) && (
                      <div className="space-y-3">
                        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-800 leading-relaxed shadow-xs">
                          <AgentResponseView
                            message={msg}
                            connectedTools={connectedTools}
                            onOptionSelect={(selectedText) => {
                              sendMessageText(selectedText)
                            }}
                            onCreateRoutine={async (draft) => {
                              await handleCreateRoutineFromDraft(draft, msg.id)
                            }}
                            onConnectTool={handleConnectTool}
                          />
                        </div>

                        {/* Phase 2: AI Generates Structured Output (Task Schema Card) if not already routine card */}
                        {msg.taskSchema && !msg.response?.routine && (
                          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 text-xs space-y-3 shadow-md animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-blue-400" />
                                <span className="font-bold text-slate-100">Task Schema (Composio Scheduling)</span>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Saved to database
                              </span>
                            </div>

                            {/* JSON Schema Code Block matching Image 1 Step 8 */}
                            <pre className="bg-slate-950 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800/80 shadow-inner">
{JSON.stringify(msg.taskSchema, null, 2)}
                            </pre>

                            {/* Phase 2 Step 10: Recurring Execution Ready */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="text-[11px] text-slate-300 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Route: <strong className="font-mono text-white uppercase">{msg.taskSchema.route}</strong> • {msg.taskSchema.frequency} at {msg.taskSchema.time}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveTab('schedule')}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
                              >
                                <Clock className="w-3 h-3" />
                                <span>Recurring Tasks Active</span>
                              </button>
                            </div>
                          </div>
                        )}

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
          <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0 sticky bottom-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] space-y-2">
            {/* Quick Suggestion Chips matching user diagram */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => {
                  setChatInput('Schedule a weekly team report and send it to #general on Slack.')
                  chatInputRef.current?.focus()
                }}
                className="text-[11px] font-medium text-slate-600 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span>Schedule a weekly team report and send it to #general on Slack</span>
              </button>
            </div>

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

              {/* Tab 5: Cloud Browser (Globe) with Live Indicator */}
              <button
                type="button"
                onClick={() => setActiveTab('browser')}
                className={`flex-1 pb-2.5 transition-colors cursor-pointer border-b-2 -mb-[1px] flex justify-center relative ${
                  activeTab === 'browser'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
                title="Cloud Browser - Stagehand & Browserbase Live View"
              >
                <Globe className="w-4 h-4" />
                {activeBrowser?.isActive && (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                )}
              </button>
            </div>

            {/* TAB 1: Settings Tab (Agent Configuration Panel from Image 1) */}
            {activeTab === 'settings' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* 1. Connected Tools Overview matching Image 1 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Connected Tools</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('tools')}
                      className="text-[10px] font-mono text-blue-700 bg-blue-100/70 hover:bg-blue-200/70 border border-blue-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                    >
                      {connectedTools.length} connected
                    </button>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {connectedTools.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">Belum ada tool terhubung</span>
                    ) : (
                      connectedTools.map((slug) => {
                        const toolItem = toolsList.find((t) => t.slug === slug)
                        return (
                          <div
                            key={slug}
                            title={toolItem?.name || slug}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-2xs"
                          >
                            {toolItem?.icon?.startsWith('http') ? (
                              <img src={toolItem.icon} alt={slug} className="w-4 h-4 object-contain" />
                            ) : (
                              <Wrench className="w-4 h-4 text-slate-600" />
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* 2. composioSessionId matching Image 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-900">
                      composioSessionId
                    </label>
                    <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Expires in 24h
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      readOnly
                      value={composioSessionId}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-16 py-2 text-xs font-mono text-slate-700 select-all"
                    />
                    <div className="absolute right-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(composioSessionId)
                          setCopiedSessionId(true)
                          setTimeout(() => setCopiedSessionId(false), 2000)
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                        title="Salin composioSessionId"
                      >
                        {copiedSessionId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateComposioSession(true)}
                        disabled={generatingSession}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        title="Buat Baru / Segarkan Session Composio"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generatingSession ? 'animate-spin text-blue-600' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Session token aktif untuk menghubungkan tools dan otorisasi multi-platform.
                  </p>
                </div>

                {/* 3. OpenRouter Model Selector Dinamis (KEBUTUHAN C) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-900">
                      Model AI (OpenRouter Gateway)
                    </label>
                    {savingModel && (
                      <span className="text-[10px] text-blue-600 animate-pulse font-medium">Menyimpan...</span>
                    )}
                  </div>

                  {/* Search box for models */}
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Cari model (e.g. claude, gpt, nemotron, deepseek)..."
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  <select
                    value={modelName}
                    onChange={(e) => handleModelChange(e.target.value)}
                    disabled={loadingModels}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-2xs"
                  >
                    {/* Default free models group */}
                    <optgroup label="Model Rekomendasi Gratis (Agent-Ready)">
                      <option value="nvidia/nemotron-3-ultra-550b-a55b:free">
                        NVIDIA Nemotron 3 Ultra 550B (Free - 1M Context - Tools)
                      </option>
                      <option value="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free">
                        NVIDIA Nemotron 3 Nano Omni (Free - 256k Context - Tools)
                      </option>
                      <option value="thinkingmachines/inkling:free">
                        ThinkingMachines: Inkling (Free - 1M Context)
                      </option>
                    </optgroup>

                    {/* Dynamic models from OpenRouter catalog */}
                    {modelCatalog.length > 0 && (
                      <optgroup label={`Katalog OpenRouter (${modelCatalog.filter((m) => m.isAgentReady).length} Model Layak Agent)`}>
                        {modelCatalog
                          .filter((m) => {
                            if (!modelSearch) return m.isAgentReady
                            return (
                              m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
                              m.name.toLowerCase().includes(modelSearch.toLowerCase())
                            )
                          })
                          .slice(0, 100)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} {!m.isAgentReady ? '⚠️ (No Tools)' : `($${m.pricing.prompt.toFixed(2)}/1M)`}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Active Model Capabilities Badge */}
                  {(() => {
                    const activeMeta = modelCatalog.find((m) => m.id === modelName)
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold">
                          ✓ Tool Calling
                        </span>
                        {activeMeta?.supportsVision && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold">
                            👁 Vision
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {activeMeta?.contextLength ? `${Math.round(activeMeta.contextLength / 1024)}k Context` : '1000k Context'}
                        </span>
                        {activeMeta && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            ${activeMeta.pricing.prompt.toFixed(2)} / 1M prompt
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* 4. Task Schedule Badge matching Image 1 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">Task Schedule</span>
                      <span className="text-[10px] text-slate-500">
                        {recurringTask ? `${recurringTask.instruction} (${recurringTask.frequency})` : 'Belum ada recurring task'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    recurringTask
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {recurringTask ? 'Active' : 'Standby'}
                  </span>
                </div>

                {/* 5. Agent Description Field */}
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
                </div>

                {/* 6. System Prompt Field (Larger textarea) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="config-instructions"
                      className="block text-xs font-bold text-slate-900"
                    >
                      System Prompt
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      {instructions.length} / 2,000
                    </span>
                  </div>

                  <textarea
                    id="config-instructions"
                    rows={7}
                    maxLength={2000}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Describe the agent's purpose, behavior, tone, rules, and response preferences in detail..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none leading-relaxed shadow-2xs transition-all"
                  />
                  <p className="text-[10px] text-slate-400">
                    Instruksi sistem yang dibentuk oleh Composio + Prompt Builder untuk memandu model AI.
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

                              {/* Name, Category, Description & Auth Status matching Image 1 Step 3 */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    {tool.name}
                                  </span>
                                  {/* Auth Status Badge matching Image 1 Step 3 */}
                                  <span
                                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                      tool.auth_status === 'Connected' || isConnected
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        tool.auth_status === 'Connected' || isConnected
                                          ? 'bg-emerald-500'
                                          : 'bg-amber-500'
                                      }`}
                                    />
                                    {tool.auth_status || (isConnected ? 'Connected' : 'Pending')}
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

                {/* Phase 2: Active Recurring Task Schema Card */}
                {recurringTask && (
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span>Recurring Task Schema Active</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Phase 2: Ready
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 font-mono text-[11px] space-y-1 text-slate-800 shadow-2xs">
                      <div><strong className="text-slate-500">Instruction:</strong> {recurringTask.instruction}</div>
                      <div><strong className="text-slate-500">Route:</strong> <span className="uppercase text-blue-600 font-bold">{recurringTask.route}</span></div>
                      <div><strong className="text-slate-500">Schedule:</strong> {recurringTask.frequency} at {recurringTask.time}</div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-blue-800">
                      <span>✓ Runs automatically with connected tools</span>
                      <button
                        type="button"
                        onClick={() => setRecurringTask(null)}
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer text-[10px]"
                      >
                        Reset Schema
                      </button>
                    </div>
                  </div>
                )}

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

            {/* TAB 5: Cloud Browser Live View (Browserbase + Stagehand v4) */}
            {activeTab === 'browser' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Browser Status & Actions Bar */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className={`w-1.5 h-1.5 rounded-full ${activeBrowser?.isActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-300'}`} />
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {activeBrowser?.isActive ? 'Cloud Browser Active' : 'Browser Cloud Standby'}
                      </span>
                    </div>

                    {activeBrowser?.isActive && (
                      <button
                        type="button"
                        onClick={handleCloseBrowser}
                        disabled={closingBrowser}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                        title="Tutup sesi browser cloud dan lepaskan sumber daya Browserbase"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
                        <span>{closingBrowser ? 'Menutup...' : 'Tutup Browser'}</span>
                      </button>
                    )}
                  </div>

                  {/* Active URL & Inspector Info */}
                  {activeBrowser?.isActive ? (
                    <div className="space-y-2 pt-1">
                      {activeBrowser.currentUrl && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 min-w-0">
                          <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate flex-1" title={activeBrowser.currentUrl}>
                            {activeBrowser.currentUrl}
                          </span>
                          <a
                            href={activeBrowser.currentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-600 shrink-0"
                            title="Buka URL asli di tab baru"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span className="truncate font-mono">
                          ID: {activeBrowser.sessionId.substring(0, 12)}...
                        </span>
                        <a
                          href={`https://www.browserbase.com/sessions/${activeBrowser.sessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <span>Session Inspector</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Sesi browser cloud akan otomatis diluncurkan saat Anda meminta agen untuk membuka web, memeriksa halaman, atau mengekstrak data.
                    </p>
                  )}
                </div>

                {/* Embedded Live View Iframe */}
                {activeBrowser?.debuggerUrl ? (
                  <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
                    <div className="px-3 py-1.5 bg-slate-800 text-slate-200 text-[10px] font-mono flex items-center justify-between border-b border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                        </div>
                        <span>Browserbase Live View (Interactive)</span>
                      </div>
                      <span className="text-emerald-400 font-semibold">● Connected</span>
                    </div>
                    <iframe
                      src={activeBrowser.debuggerUrl}
                      title="Browserbase Cloud Live View"
                      className="w-full h-[450px] border-0 bg-white"
                      allow="clipboard-read; clipboard-write"
                    />
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Browser Cloud (Stagehand v4 + Browserbase)
                      </h4>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                        Agent memiliki tool browser nyata untuk navigasi, observasi elemen via AI vision, aksi interaktif, dan ekstraksi data.
                      </p>
                    </div>

                    <div className="pt-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                        Contoh Perintah Web:
                      </span>
                      <div className="space-y-1.5 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setChatInput('Buka https://news.ycombinator.com dan ambil 3 berita teratas')
                            if (chatInputRef.current) chatInputRef.current.focus()
                          }}
                          className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 text-[11px] text-slate-700 transition-all cursor-pointer shadow-2xs"
                        >
                          🌐 &quot;Buka news.ycombinator.com dan ambil 3 berita teratas&quot;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setChatInput('Kunjungi https://news.ycombinator.com lalu amati elemen interaktif yang tersedia')
                            if (chatInputRef.current) chatInputRef.current.focus()
                          }}
                          className="w-full text-left p-2 rounded-lg bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 text-[11px] text-slate-700 transition-all cursor-pointer shadow-2xs"
                        >
                          🔍 &quot;Kunjungi situs dan amati elemen interaktif yang ada&quot;
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
