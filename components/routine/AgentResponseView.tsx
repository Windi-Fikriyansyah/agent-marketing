'use client'

import React, { useState } from 'react'
import { AgentResponse, RoutineDraft } from '@/lib/agent-sdk/schema/routine'
import RoutineCard from './RoutineCard'
import ToolSuggestionCard from './ToolSuggestionCard'
import { Clock, Hash, CheckCircle2, AlertCircle, ArrowRight, Sparkles, Sliders } from 'lucide-react'

export interface AgentResponseViewProps {
  message: {
    id: string
    content: string
    response?: AgentResponse | null
    toolCards?: any[]
  }
  connectedTools?: string[]
  onOptionSelect?: (text: string) => void
  onCreateRoutine?: (routine: RoutineDraft) => Promise<void> | void
  onConnectTool?: (slug: string) => void
}

export function AgentResponseView({
  message,
  connectedTools = [],
  onOptionSelect,
  onCreateRoutine,
  onConnectTool,
}: AgentResponseViewProps) {
  const [customInput, setCustomInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const response = message.response

  // Fallback to simple text if response object is not present
  if (!response) {
    return <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
  }

  // Check if all suggested tools are connected
  const requiredTools = response.suggestedTools || response.routine?.tools || []
  const connectedSlugs = (connectedTools || []).map((c) => c.toLowerCase())
  const allConnected =
    requiredTools.length === 0 ||
    requiredTools.every((t) => connectedSlugs.includes(t.slug.toLowerCase()))

  const handleSelect = (option: string) => {
    if (option.toLowerCase().includes('custom') || option.toLowerCase().includes('lainnya')) {
      setShowCustomInput(true)
      return
    }
    setSelectedOption(option)
    onOptionSelect?.(option)
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customInput.trim()) return
    setSelectedOption(customInput.trim())
    onOptionSelect?.(customInput.trim())
    setCustomInput('')
    setShowCustomInput(false)
  }

  return (
    <div className="space-y-3.5">
      {/* 1. Main message */}
      {response.message && (
        <p className="leading-relaxed whitespace-pre-wrap text-slate-800 text-sm">{response.message}</p>
      )}

      {/* 2. Connection Required UI (connection_required / tool_connection) */}
      {(response.type === 'tool_connection' || response.type === 'connection_required') && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 space-y-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Integrasi Aplikasi Diperlukan</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Untuk menjalankan tugas ini, AI Agent membutuhkan otorisasi akses ke aplikasi berikut:
          </p>
          <div className="space-y-2">
            {(response.suggestedTools || []).map((t) => (
              <ToolSuggestionCard
                key={t.slug}
                tool={{
                  slug: t.slug,
                  name: (t as any).name,
                  reason: t.reason,
                  isConnected: connectedTools.map((c) => c.toLowerCase()).includes(t.slug.toLowerCase()),
                }}
                onConnect={onConnectTool}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Generative UI for Clarification / Selection Required (Max 1 Question per turn) */}
      {(response.type === 'clarification' ||
        response.type === 'selection_required' ||
        response.type === 'clarification_required') &&
        response.questions &&
        response.questions.length > 0 && (
          <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/60 space-y-2.5 animate-in fade-in">
            {/* Show only the single most required question */}
            {response.questions.slice(0, 1).map((item) => (
              <div key={item.id} className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{item.question}</span>
                </p>

                {/* Generative UI option buttons (2-5 options) */}
                {item.options && item.options.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {item.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelect(opt)}
                        disabled={Boolean(selectedOption)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                          selectedOption === opt
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {opt.includes(':') || opt.toLowerCase().includes('am') || opt.toLowerCase().includes('pm') ? (
                          <Clock className="w-3 h-3 text-slate-400" />
                        ) : opt.startsWith('#') ? (
                          <Hash className="w-3 h-3 text-slate-400" />
                        ) : null}
                        <span>{opt}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom Option Input if user toggles custom */}
                {showCustomInput && (
                  <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 pt-1 animate-in fade-in">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Masukkan pilihan khusus Anda..."
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!customInput.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-40"
                    >
                      Pilih
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

      {/* 4. Assumptions & Safe Defaults Callout (if any assumptions were made) */}
      {response.assumptions && response.assumptions.length > 0 && (
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-slate-400" />
            Asumsi &amp; Nilai Standar:
          </span>
          <ul className="list-disc list-inside space-y-0.5 text-slate-500">
            {response.assumptions.map((ass, i) => (
              <li key={i}>{ass}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Routine Confirmation Card (routine / confirmation_required) */}
      {(response.type === 'routine' || response.type === 'confirmation_required') && response.routine && (
        <div className="pt-1">
          <RoutineCard
            routine={response.routine}
            toolCards={
              (message.toolCards && message.toolCards.length > 0)
                ? message.toolCards.map((tc) => ({
                    ...tc,
                    isConnected: connectedSlugs.includes(tc.slug.toLowerCase()),
                  }))
                : (response.routine.tools || []).map((t) => ({
                    ...t,
                    isConnected: connectedSlugs.includes(t.slug.toLowerCase()),
                  }))
            }
            allConnected={allConnected}
            onConnectTool={onConnectTool}
            createRoutine={
              onCreateRoutine && response.routine
                ? () => onCreateRoutine(response.routine!)
                : undefined
            }
          />
        </div>
      )}

      {/* 6. Completed State */}
      {response.type === 'completed' && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 text-xs flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">Tugas berhasil diselesaikan dan dijadwalkan secara otomatis.</span>
        </div>
      )}
    </div>
  )
}
