-- ==============================================================================
-- MIGRATION: BUAT TABEL CHAT_MESSAGES UNTUK RIWAYAT OBROLAN AGENT SDK
-- ==============================================================================
-- Jalankan skrip SQL ini di Supabase Dashboard -> SQL Editor
-- untuk membuat tabel riwayat chat `chat_messages` dan mengaktifkan RLS.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL DEFAULT '',
  traces JSONB DEFAULT '[]'::jsonb,
  approval_request JSONB DEFAULT NULL,
  approval_status TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index untuk performa query cepat berdasarkan agent dan waktu
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id_created_at 
ON public.chat_messages(agent_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id 
ON public.chat_messages(user_id);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 1. Policy untuk melihat chat milik user sendiri
DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view their own chat messages" 
ON public.chat_messages FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 2. Policy untuk menambahkan chat baru
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own chat messages" 
ON public.chat_messages FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Policy untuk memperbarui chat (misal status approval atau trace)
DROP POLICY IF EXISTS "Users can update their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can update their own chat messages" 
ON public.chat_messages FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Policy untuk menghapus riwayat chat
DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete their own chat messages" 
ON public.chat_messages FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Muat ulang schema cache PostgREST agar Supabase langsung mengenali tabel baru
NOTIFY pgrst, 'reload schema';
