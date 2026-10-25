-- Migration: Add Routines Table for Agent Task-Setup and Scheduling (Matching Image 3)
CREATE TABLE IF NOT EXISTS public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  goal TEXT NOT NULL,
  instructions TEXT NOT NULL,
  schedule JSONB NOT NULL,
  tools JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routines_agent_id ON public.routines(agent_id);
CREATE INDEX IF NOT EXISTS idx_routines_is_active ON public.routines(is_active);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view routines" ON public.routines;
CREATE POLICY "Users can view routines" 
ON public.routines FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Users can insert routines" ON public.routines;
CREATE POLICY "Users can insert routines" 
ON public.routines FOR INSERT 
TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update routines" ON public.routines;
CREATE POLICY "Users can update routines" 
ON public.routines FOR UPDATE 
TO authenticated 
USING (true);

NOTIFY pgrst, 'reload schema';
