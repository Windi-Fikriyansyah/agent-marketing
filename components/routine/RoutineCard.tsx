'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Target, ListChecks, CheckCircle2, Sparkles } from 'lucide-react'
import ToolSuggestionCard from './ToolSuggestionCard'

export type RoutineProps = {
  routine: {
    name: string
    goal: string
    instructions: string
    schedule: {
      startDate: string
      time: string
      timezone: string
      frequency?: string
      weekdays?: string[]
    }
    tools?: Array<{ slug: string; reason?: string }>
  }
  toolCards?: any[]
  allConnected?: boolean
  createRoutine?: () => void
  isCreated?: boolean
  onConnectTool?: (slug: string) => void
}

export default function RoutineCard({
  routine,
  toolCards = [],
  allConnected = true,
  createRoutine,
  isCreated = false,
  onConnectTool,
}: RoutineProps) {
  const [created, setCreated] = useState(isCreated)
  const [loading, setLoading] = useState(false)

  // Combined tools from routine.tools and toolCards
  const resolvedTools = toolCards.length > 0 ? toolCards : routine.tools || []

  const handleCreate = async () => {
    setLoading(true)
    try {
      if (createRoutine) {
        await createRoutine()
      }
      setCreated(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-xl border-slate-200/90 shadow-sm bg-white overflow-hidden animate-in fade-in duration-200">
      <CardHeader className="bg-slate-50/60 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{routine.name}</span>
          </CardTitle>
          {created && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Routine Active
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Goal */}
        <div className="flex gap-3">
          <Target className="h-5 w-5 mt-0.5 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">Goal</p>
            <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{routine.goal}</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="flex gap-3">
          <ListChecks className="h-5 w-5 mt-0.5 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800">Instructions</p>
            <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{routine.instructions}</p>
          </div>
        </div>

        {/* Schedule */}
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="font-medium">Start: {routine.schedule.startDate}</span>
            {routine.schedule.frequency && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 ml-auto">
                {routine.schedule.frequency}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900">
              {routine.schedule.time}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              ({routine.schedule.timezone})
            </span>
            {routine.schedule.weekdays && routine.schedule.weekdays.length > 0 && (
              <span className="text-[11px] text-slate-500 ml-auto">
                {routine.schedule.weekdays.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Required Tools */}
        {resolvedTools.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold text-slate-800">Required tools</p>
            <div className="space-y-2">
              {resolvedTools.map((tool: any) => (
                <ToolSuggestionCard key={tool.slug} tool={tool} onConnect={onConnectTool} />
              ))}
            </div>
          </div>
        )}

        {/* Create Routine Button / Success Confirmation */}
        <div className="pt-2">
          {created ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Jadwal routine telah aktif dan tersimpan di database.
              </span>
            </div>
          ) : (
            <>
              <Button
                className="w-full py-2.5 text-xs font-bold shadow-xs transition-all"
                disabled={!allConnected || loading}
                onClick={handleCreate}
              >
                {loading ? 'Menyimpan Routine...' : 'Create Routine'}
              </Button>
              {!allConnected && (
                <p className="text-[11px] text-center text-slate-500 mt-2">
                  Connect all required tools to create this routine.
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
