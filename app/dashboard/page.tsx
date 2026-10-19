'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout, { renderAgentAvatar, type Agent } from '@/components/DashboardLayout'
import {
  Bot,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Sliders
} from 'lucide-react'

function DashboardView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentIdFromUrl = searchParams.get('agentId')
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agentIdFromUrl)

  // Edit Agent form states
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editModel, setEditModel] = useState('grok-2')
  const [editPrompt, setEditPrompt] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Playground / test chat
  const [testMessage, setTestMessage] = useState('')
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'agent'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  const loadAgents = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        setAgents([])
      } else {
        const fetched = data || []
        setAgents(fetched)
        if (fetched.length > 0) {
          const targetId =
            agentIdFromUrl && fetched.some((a) => a.id === agentIdFromUrl)
              ? agentIdFromUrl
              : fetched[0].id
          router.replace(`/workspace/${targetId}`)
        } else {
          router.replace('/workspace/create-agent')
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err)
      setAgents([])
    }
  }

  useEffect(() => {
    async function initDashboard() {
      setLoading(true)
      try {
        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !currentUser) {
          router.push('/login?redirectedFrom=/dashboard')
          return
        }

        setUser(currentUser)
        await loadAgents(currentUser.id)
      } catch (err) {
        console.error('Init error:', err)
      } finally {
        setLoading(false)
      }
    }

    initDashboard()
  }, [router, supabase, agentIdFromUrl])

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null

  useEffect(() => {
    if (selectedAgent) {
      setEditName(selectedAgent.name || '')
      setEditDescription(selectedAgent.description || '')
      setEditModel(selectedAgent.model || 'grok-2')
      setEditPrompt(selectedAgent.system_prompt || '')
      setChatLog([])
      setSaveSuccess(false)
      setSaveError(null)
    }
  }, [selectedAgentId, selectedAgent])

  // Update Existing Agent
  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAgent || !user) return

    setSavingEdit(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const updates = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        model: editModel,
        system_prompt: editPrompt.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', selectedAgent.id)

      if (error) throw error

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      await loadAgents(user.id)
    } catch (err: any) {
      console.error('Update agent error:', err)
      setSaveError(err.message || 'Gagal menyimpan perubahan agent ke database Supabase.')
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete Agent
  const handleDeleteAgent = async () => {
    if (!selectedAgent || !user) return
    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus agent "${selectedAgent.name}"?`)
    if (!confirmed) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', selectedAgent.id)

      if (error) throw error

      const remaining = agents.filter((a) => a.id !== selectedAgent.id)
      setAgents(remaining)
      setSelectedAgentId(remaining.length > 0 ? remaining[0].id : null)
      router.refresh()
    } catch (err: any) {
      alert(`Gagal menghapus agent: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  // Handle mock test chat inside the agent playground
  const handleSendTestMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!testMessage.trim()) return

    const userText = testMessage.trim()
    setTestMessage('')
    setChatLog((prev) => [...prev, { role: 'user', content: userText }])
    setChatLoading(true)

    setTimeout(() => {
      setChatLog((prev) => [
        ...prev,
        {
          role: 'agent',
          content: `[Respon Simulasi ${editModel}]: Halo! Saya "${editName}", siap membantu Anda sesuai instruksi: "${editPrompt || 'Tidak ada instruksi khusus'}"`,
        },
      ])
      setChatLoading(false)
    }, 600)
  }

  return (
    <DashboardLayout
      selectedAgentId={selectedAgentId}
      onSelectAgent={(agent) => setSelectedAgentId(agent.id)}
      headerTitle={selectedAgent ? selectedAgent.name : undefined}
    >
      <div className="p-6 md:p-8 max-w-5xl w-full mx-auto flex-1">
        {/* CASE 1: Belum ada agent yang dibuat sama sekali (NO DUMMY DATA) */}
        {agents.length === 0 ? (
          <div className="dev-card p-12 rounded-xl text-center space-y-4 max-w-lg mx-auto my-12 bg-white border border-slate-200 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center mx-auto shadow-2xs">
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">Belum Ada Agent</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda belum memiliki agent yang dibuat. Mulai dengan membuat agent baru untuk mendefinisikan persona, model AI, dan instruksi sistem kustom Anda.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/workspace/create-agent"
                className="px-4 py-2.5 dev-btn-primary rounded-lg text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create New Agent Sekarang</span>
              </Link>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] font-mono text-slate-400">
              Data disimpan aman di tabel PostgreSQL: public.agents (RLS Active)
            </div>
          </div>
        ) : selectedAgent ? (
          /* CASE 2: Ada agent yang dipilih */
          <div className="space-y-6">
            {/* Header card of selected agent */}
            <div className="dev-card p-6 rounded-lg bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                {renderAgentAvatar(selectedAgent.avatar, true, 'lg')}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-900">{selectedAgent.name}</h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedAgent.description || 'Tidak ada deskripsi'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAgent}
                  disabled={deleting}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Agent</span>
                </button>
              </div>
            </div>

            {/* Feedback Alert for editing */}
            {saveSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Perubahan agent berhasil disimpan ke database Supabase!</span>
              </div>
            )}

            {saveError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Grid: Editor & Playground */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration Editor Form */}
              <div className="dev-card p-6 rounded-lg bg-white border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">Konfigurasi Agent</span>
                </div>

                <form onSubmit={handleUpdateAgent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nama Agent
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="dev-input w-full px-3 py-2 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Model AI
                    </label>
                    <select
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      className="dev-input w-full px-3 py-2 rounded text-xs bg-white"
                    >
                      <option value="grok-2">Grok 2 (State of the art)</option>
                      <option value="grok-beta">Grok Beta (Fast reasoning)</option>
                      <option value="grok-vision-beta">Grok Vision (Multimodal)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Deskripsi
                    </label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Contoh: Menjawab tiket bantuan pelanggan"
                      className="dev-input w-full px-3 py-2 rounded text-xs placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      System Prompt / Instruksi Perilaku
                    </label>
                    <textarea
                      rows={5}
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="Tuliskan instruksi cara agent ini merespons dan bertindak..."
                      className="dev-input w-full px-3 py-2 rounded text-xs placeholder-slate-400 resize-none font-mono text-[11px]"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {selectedAgent.id.slice(0, 8)}...
                    </span>

                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-4 py-2 dev-btn-primary rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {savingEdit ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Simpan Perubahan</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Agent Playground / Simulator */}
              <div className="dev-card p-6 rounded-lg bg-white border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-sm text-slate-900">Uji Coba Prompt (Playground)</span>
                  </div>

                  <div className="h-64 overflow-y-auto p-3 rounded-lg bg-slate-50 border border-slate-200 my-4 space-y-3">
                    {chatLog.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 p-4">
                        <Bot className="w-6 h-6 mb-1 text-slate-300" />
                        <span>Kirim pesan di bawah untuk menguji respons {editName}.</span>
                      </div>
                    ) : (
                      chatLog.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex flex-col text-xs ${
                            msg.role === 'user' ? 'items-end' : 'items-start'
                          }`}
                        >
                          <span className="text-[10px] font-mono text-slate-400 mb-0.5">
                            {msg.role === 'user' ? 'Anda' : editName}
                          </span>
                          <div
                            className={`p-2.5 rounded-lg max-w-[85%] ${
                              msg.role === 'user'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white border border-slate-200 text-slate-800 shadow-2xs'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}

                    {chatLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                        <div className="w-3 h-3 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                        <span>{editName} sedang berpikir...</span>
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSendTestMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder={`Kirim pesan ke ${editName}...`}
                    className="dev-input flex-1 px-3 py-2 rounded text-xs placeholder-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!testMessage.trim() || chatLoading}
                    className="px-3 py-2 dev-btn-primary rounded text-xs font-semibold flex items-center justify-center cursor-pointer disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          /* CASE 3: Ada agent tapi belum dipilih */
          <div className="text-center py-20 text-slate-400 text-xs">
            Pilih salah satu agent di sidebar untuk melihat detailnya.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500 font-mono text-xs">
          <span>Memuat dashboard...</span>
        </div>
      }
    >
      <DashboardView />
    </Suspense>
  )
}
