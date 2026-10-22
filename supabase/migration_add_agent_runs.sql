-- ==============================================================================
-- MIGRATION: TABEL AGENT_RUNS (RUN HISTORY, APPROVAL GATES & ROUTINES)
-- ==============================================================================
-- Menambahkan tabel riwayat eksekusi agent yang persisten untuk memantau run health,
-- status persetujuan, tool routing, dan scheduler routines.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'waiting_approval', 'failed')),
  tasks_count INT DEFAULT 1 NOT NULL,
  completed_tasks INT DEFAULT 0 NOT NULL,
  health_percent INT DEFAULT 100 NOT NULL,
  tool_routes TEXT[] DEFAULT ARRAY[]::TEXT[],
  traces JSONB DEFAULT '[]'::jsonb,
  approval_gate JSONB DEFAULT NULL,
  output_summary TEXT,
  trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled', 'webhook')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id_created_at
ON public.agent_runs(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id
ON public.agent_runs(user_id);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own agent runs" ON public.agent_runs;
CREATE POLICY "Users can view their own agent runs"
ON public.agent_runs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own agent runs" ON public.agent_runs;
CREATE POLICY "Users can insert their own agent runs"
ON public.agent_runs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own agent runs" ON public.agent_runs;
CREATE POLICY "Users can update their own agent runs"
ON public.agent_runs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own agent runs" ON public.agent_runs;
CREATE POLICY "Users can delete their own agent runs"
ON public.agent_runs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Kolom tambahan pada tabel agents untuk schedule aktif
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS recurring_task_schema JSONB DEFAULT NULL;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS composio_session_id TEXT DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
