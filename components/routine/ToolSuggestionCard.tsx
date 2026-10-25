'use client'

import React from 'react'
import { Check, Wrench, ExternalLink } from 'lucide-react'

export interface ToolSuggestionProps {
  tool: {
    slug: string
    name?: string
    reason?: string
    icon?: string
    isConnected?: boolean
  }
  onConnect?: (slug: string) => void
}

const TOOL_ICONS: Record<string, string> = {
  slack: 'https://cdn.simpleicons.org/slack/4A154B',
  gmail: 'https://cdn.simpleicons.org/gmail/EA4335',
  outlook: 'https://cdn.simpleicons.org/microsoftoutlook/0078D4',
  notion: 'https://cdn.simpleicons.org/notion/000000',
  googlecalendar: 'https://cdn.simpleicons.org/googlecalendar/4285F4',
  calendar: 'https://cdn.simpleicons.org/googlecalendar/4285F4',
  googledocs: 'https://cdn.simpleicons.org/googledocs/4285F4',
  docs: 'https://cdn.simpleicons.org/googledocs/4285F4',
  github: 'https://cdn.simpleicons.org/github/181717',
  reddit: 'https://cdn.simpleicons.org/reddit/FF4500',
}

const TOOL_NAMES: Record<string, string> = {
  slack: 'Slack',
  gmail: 'Gmail',
  outlook: 'Outlook',
  notion: 'Notion',
  googlecalendar: 'Google Calendar',
  calendar: 'Google Calendar',
  googledocs: 'Google Docs',
  docs: 'Google Docs',
  github: 'GitHub',
  reddit: 'Reddit',
}

export default function ToolSuggestionCard({ tool, onConnect }: ToolSuggestionProps) {
  const [connecting, setConnecting] = React.useState(false)
  const slug = tool.slug.toLowerCase()
  const iconUrl = tool.icon || TOOL_ICONS[slug]
  const displayName = tool.name || TOOL_NAMES[slug] || tool.slug.toUpperCase()
  const isConnected = Boolean(tool.isConnected)

  const handleConnectClick = async () => {
    if (connecting || isConnected) return
    setConnecting(true)
    try {
      await onConnect?.(slug)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 p-1">
          {iconUrl ? (
            <img src={iconUrl} alt={displayName} className="w-4 h-4 object-contain" />
          ) : (
            <Wrench className="w-4 h-4 text-slate-500" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
          <p className="text-[11px] text-slate-500 truncate">
            {tool.reason || `Diperlukan untuk eksekusi ${displayName}`}
          </p>
        </div>
      </div>

      <div>
        {isConnected ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <Check className="w-3 h-3 text-emerald-600" />
            Connected
          </span>
        ) : (
          <button
            type="button"
            disabled={connecting}
            onClick={handleConnectClick}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            {connecting ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <ExternalLink className="w-3 h-3" />
                <span>Connect</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
