-- ==============================================================================
-- MIGRATION: BROWSERBASE & STAGEHAND CLOUD BROWSER SESSIONS
-- ==============================================================================
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor
-- untuk mendukung manajemen sesi browser cloud Browserbase & Stagehand.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  conversation_id TEXT,
  browserbase_session_id TEXT NOT NULL,
  debugger_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_user ON public.browser_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_agent ON public.browser_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_status ON public.browser_sessions(status);

ALTER TABLE public.browser_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user all browser_sessions" ON public.browser_sessions;
CREATE POLICY "Allow user all browser_sessions"
ON public.browser_sessions FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- Reload schema cache PostgREST
NOTIFY pgrst, 'reload schema';
