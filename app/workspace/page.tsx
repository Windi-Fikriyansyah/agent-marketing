import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WorkspaceRedirectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Find user's latest agent
  const { data: agents } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (agents && agents.length > 0) {
    redirect(`/workspace/${agents[0].id}`)
  }

  // If no agent yet, redirect to create-agent
  redirect('/workspace/create-agent')
}
