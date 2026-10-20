-- ==============================================================================
-- SUPABASE DATABASE SETUP FOR GROK-BOT
-- ==============================================================================
-- Jalankan skrip SQL ini di Supabase Dashboard -> SQL Editor
-- untuk membuat tabel database `profiles` dan `agents`, mengaktifkan Row Level Security (RLS),
-- dan menambahkan trigger otomatis.
-- ==============================================================================

-- 1. Buat tabel profiles di schema public
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Aktifkan Row Level Security (RLS) untuk profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan Keamanan (RLS Policies) untuk profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 4. Fungsi otomatis untuk menangani user baru saat mendaftar lewat Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Helper trigger updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profiles_updated_at ON public.profiles;
CREATE TRIGGER on_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 6. TABEL AGENTS (GROK-BOT AGENTS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  model TEXT DEFAULT 'grok-2' NOT NULL,
  system_prompt TEXT,
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Pastikan kolom avatar ada (jika tabel sudah pernah dibuat sebelumnya)
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Muat ulang schema cache PostgREST Supabase
NOTIFY pgrst, 'reload schema';

-- 8. Aktifkan Row Level Security (RLS) untuk tabel agents
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- 8. Kebijakan Keamanan (RLS Policies) untuk agents
CREATE POLICY "Users can view their own agents" 
ON public.agents FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agents" 
ON public.agents FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents" 
ON public.agents FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents" 
ON public.agents FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_agents_updated_at ON public.agents;
CREATE TRIGGER on_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 9. TABEL CHAT_MESSAGES (RIWAYAT PERCAKAPAN AGENT SDK)
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

CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id_created_at 
ON public.chat_messages(agent_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id 
ON public.chat_messages(user_id);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view their own chat messages" 
ON public.chat_messages FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own chat messages" 
ON public.chat_messages FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can update their own chat messages" 
ON public.chat_messages FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can delete their own chat messages" 
ON public.chat_messages FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Muat ulang schema cache PostgREST PostgREST Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- SELESAI: Skema tabel profiles, agents, & chat_messages siap digunakan!
-- ==============================================================================
