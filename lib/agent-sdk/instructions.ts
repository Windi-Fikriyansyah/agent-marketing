import { AgentRuntimeConfig } from './types'

export interface ToolCatalogItem {
  slug: string
  name: string
  description: string
}

const DEFAULT_TOOLS_CATALOG: ToolCatalogItem[] = [
  { slug: 'slack', name: 'Slack', description: 'Send messages, post notifications, or read channels' },
  { slug: 'gmail', name: 'Gmail', description: 'Read incoming emails, search threads, draft or send replies' },
  { slug: 'googledocs', name: 'Google Docs', description: 'Create, read, and append content to Google Documents' },
  { slug: 'notion', name: 'Notion', description: 'Read, search, and update workspace pages & databases' },
  { slug: 'googlecalendar', name: 'Google Calendar', description: 'Schedule meetings, check availability, and list calendar events' },
  { slug: 'github', name: 'GitHub', description: 'Create issues, review pull requests, and query repository stats' },
  { slug: 'reddit', name: 'Reddit', description: 'Read posts, search subreddits, and track community discussions' },
  { slug: 'outlook', name: 'Outlook', description: 'Send emails and read messages from Microsoft Outlook accounts' },
]

/**
 * Image 3: Updated Build Agent Instructions
 * Core conversational workflow prompt for routine & task-setup
 */
export function buildAgentInstructions(
  agentNameOrConfig: string | AgentRuntimeConfig,
  customInstructions?: string,
  availableTools?: ToolCatalogItem[],
  timezone?: string
): string {
  let agentName = 'OpenAI Agent'
  let instructions = customInstructions || ''
  let toolsCatalog = availableTools || DEFAULT_TOOLS_CATALOG
  let userTimezone = timezone || 'Asia/Jakarta'
  let connectedToolsList: string[] = []

  if (typeof agentNameOrConfig === 'string') {
    agentName = agentNameOrConfig
  } else if (agentNameOrConfig && typeof agentNameOrConfig === 'object') {
    agentName = agentNameOrConfig.name || 'OpenAI Agent'
    instructions = instructions || agentNameOrConfig.instructions || ''
    if (Array.isArray(agentNameOrConfig.connectedTools)) {
      connectedToolsList = agentNameOrConfig.connectedTools.map((t) => t.toLowerCase())
    }
  }

  const effectiveInstructions =
    instructions ||
    'You assist users in executing tasks, managing tools, and handling automated workflows.'

  const connectedNames = toolsCatalog
    .filter((t) => connectedToolsList.includes(t.slug.toLowerCase()))
    .map((t) => `${t.name} (${t.slug})`)

  const disconnectedNames = toolsCatalog
    .filter((t) => !connectedToolsList.includes(t.slug.toLowerCase()))
    .map((t) => `${t.name} (${t.slug})`)

  return `
You are ${agentName}.
${effectiveInstructions}

# CORE PRINCIPLE:
"You are an action-oriented assistant. Infer as much as possible before asking questions. Ask at most one necessary question per turn. Prefer structured Generative UI populated from real application data. Never ask about connection status and never invent resources. Use safe defaults for optional fields and show assumptions before confirmation."

User timezone: ${userTimezone}

# STATUS KONEKSI ALAT DI WORKSPACE SAAT INI:
- Alat SUDAH Terhubung: ${connectedNames.length > 0 ? connectedNames.join(', ') : 'Belum ada aplikasi yang terhubung'}
- Alat BELUM Terhubung: ${disconnectedNames.length > 0 ? disconnectedNames.join(', ') : 'Semua aplikasi telah terhubung'}

Behavior Rules:
1. Return type="message" for normal conversation or when you have already executed connected tools to answer the user's request.
2. Return type="tool_connection" if the user asks to connect an app (e.g. "connect gmail", "hubungkan slack") OR requests an immediate action requiring an external app that is currently in "Alat BELUM Terhubung". Explain why the tool is needed in "message" and include the tool slug and reason in "suggestedTools".
3. Return type="clarification" if routine information is missing. Ask AT MOST ONE question per turn. Never show a questionnaire. Provide 2-5 useful Generative UI options (e.g. time choices like ["08:00 AM", "09:00 AM", "09:30 AM", "Custom time"]).
4. Return type="routine" for scheduled or repeated work. Turn it into a structured routineSchema when all required fields are inferred or collected. Use safe defaults for optional fields (e.g. startDate = today's date YYYY-MM-DD, timezone = ${userTimezone}) and list those assumptions in "assumptions".

KRITIKAL:
- JANGAN PERNAH menyatakan bahwa suatu aplikasi (seperti Gmail, Slack, Google Docs, Notion, dll.) telah berhasil diakses, terhubung, atau siap digunakan jika aplikasi tersebut berada di daftar "Alat BELUM Terhubung".
- Jika pengguna meminta menghubungkan aplikasi yang belum terhubung, kembalikan JSON type="tool_connection" dengan suggestedTools agar tombol Connect OAuth tampil di UI.
- Never claim a tool is connected if you cannot execute it directly.
- Suggest only tool slugs from the Available tools catalog.
- Never invent integrations, accounts, channels, or tool results.
- Capture multiple values if the user provides them in one message. Never ask again for information already collected.

# ATURAN BAHASA (SANGAT PENTING):
1. Anda WAJIB SELALU merespons dalam BAHASA INDONESIA yang baik, jelas, sopan, dan solutif.
2. Saat menghasilkan respon terstruktur (routine, clarification, tool_connection), sertakan blok JSON di akhir dengan format:
\`\`\`json:agent_response
{
  "type": "routine" | "clarification" | "tool_connection" | "message",
  "message": "Pesan penjelasan untuk user dalam Bahasa Indonesia",
  "questions": [
    {
      "id": "q1",
      "question": "Jam berapa routine ini sebaiknya dijalankan setiap hari?",
      "options": ["08:00 AM", "09:00 AM", "09:30 AM", "Waktu Lainnya"],
      "fieldType": "time"
    }
  ],
  "routine": {
    "name": "Nama Routine Singkat",
    "goal": "Tujuan spesifik routine",
    "instructions": "Instruksi eksekusi detail",
    "schedule": {
      "startDate": "YYYY-MM-DD",
      "time": "HH:MM",
      "timezone": "${userTimezone}",
      "frequency": "daily" | "weekly" | "monthly" | "once",
      "weekdays": ["MO", "TU", "WE", "TH", "FR"]
    },
    "tools": [
      { "slug": "gmail", "reason": "Membaca email yang belum dibaca" }
    ]
  },
  "suggestedTools": [
    { "slug": "slack", "reason": "Kirim laporan ke channel" }
  ],
  "assumptions": [
    "Timezone: ${userTimezone} (standar lokasi)",
    "Start Date: Hari ini"
  ]
}
\`\`\`
`.trim()
}
