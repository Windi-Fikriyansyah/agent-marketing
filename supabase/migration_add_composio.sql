-- ==============================================================================
-- MIGRATION: INTEGRASI COMPOSIO & RECURRING TASK SCHEMA
-- ==============================================================================
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor
-- untuk mendukung Composio Session ID, auth_status tools, dan recurring task schema.
-- ==============================================================================

-- 1. Tambahkan kolom auth_status pada tabel tools
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS auth_status TEXT DEFAULT 'Connected';

-- 2. Tambahkan kolom composio_session_id pada tabel agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS composio_session_id TEXT;

-- 3. Tambahkan kolom recurring_task_schema pada tabel agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS recurring_task_schema JSONB;

-- 4. Tabel khusus untuk menyimpan riwayat eksekusi recurring tasks
CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID,
  instruction TEXT NOT NULL,
  route TEXT NOT NULL DEFAULT 'slack',
  frequency TEXT NOT NULL DEFAULT 'weekly',
  time TEXT NOT NULL DEFAULT '09:00',
  date DATE,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Index & RLS untuk recurring_tasks
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_agent ON public.recurring_tasks(agent_id);
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user all recurring_tasks" ON public.recurring_tasks;
CREATE POLICY "Allow user all recurring_tasks"
ON public.recurring_tasks FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);

-- 6. Reload schema cache PostgREST
NOTIFY pgrst, 'reload schema';
