import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'

export interface UserMemory {
  id: string
  userId: string
  fact: string
  category?: string
  createdAt: string
}

const DATA_DIR = path.join(process.cwd(), '.data')
const MEMORY_FILE = path.join(DATA_DIR, 'memories.json')

function ensureStorage(): UserMemory[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(MEMORY_FILE)) {
      fs.writeFileSync(MEMORY_FILE, JSON.stringify([]), 'utf8')
      return []
    }
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8')
    return JSON.parse(raw || '[]')
  } catch (err) {
    console.warn('Memory storage init error:', err)
    return []
  }
}

export async function rememberFact(
  userId: string,
  fact: string,
  category: string = 'general'
): Promise<{ success: boolean; memory: UserMemory }> {
  const memories = ensureStorage()
  const newMemory: UserMemory = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    fact: fact.trim(),
    category,
    createdAt: new Date().toISOString(),
  }

  memories.push(newMemory)
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2), 'utf8')
  } catch (e) {
    console.warn('Could not write to local memory file:', e)
  }

  // Also attempt to persist to Supabase if user_memories table is available
  try {
    const supabase = await createClient()
    await supabase.from('user_memories').insert({
      id: newMemory.id,
      user_id: userId,
      fact: newMemory.fact,
      category: newMemory.category,
      created_at: newMemory.createdAt,
    })
  } catch {}

  return { success: true, memory: newMemory }
}

export async function recallMemories(
  userId: string,
  query?: string
): Promise<{ memories: UserMemory[] }> {
  let list = ensureStorage().filter((m) => m.userId === userId)

  // Try Supabase first if available
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      list = data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        fact: d.fact,
        category: d.category,
        createdAt: d.created_at,
      }))
    }
  } catch {}

  if (!query || query.trim().length === 0) {
    return { memories: list }
  }

  const q = query.toLowerCase()
  const matched = list.filter(
    (m) => m.fact.toLowerCase().includes(q) || (m.category && m.category.toLowerCase().includes(q))
  )

  // If query filtering yields matches return them, else return recent memories so LLM can reason
  return { memories: matched.length > 0 ? matched : list.slice(-5) }
}
