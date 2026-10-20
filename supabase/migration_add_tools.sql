-- ==============================================================================
-- MIGRATION: BUAT TABEL TOOLS & SEED DATA TOOLS
-- ==============================================================================
-- Jalankan skrip SQL ini di Supabase Dashboard -> SQL Editor
-- untuk membuat tabel `tools`, mengaktifkan RLS, menambahkan kolom `tools` ke tabel `agents`,
-- dan memasukkan data 8 tools awal (Slack, Gmail, Outlook, Notion, Google Calendar, Google Docs, GitHub, Reddit).
-- ==============================================================================

-- 1. Buat tabel tools
CREATE TABLE IF NOT EXISTS public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_tools_is_active ON public.tools(is_active);
CREATE INDEX IF NOT EXISTS idx_tools_slug ON public.tools(slug);

-- 3. Pastikan kolom tools ada di tabel agents untuk menyimpan tools yang dihubungkan ke agent
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS tools TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 4. Aktifkan Row Level Security (RLS) untuk tabel tools
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- 5. Kebijakan Keamanan (RLS Policy): Izinkan semua pengguna untuk membaca daftar tools
DROP POLICY IF EXISTS "Allow read access to all users" ON public.tools;
CREATE POLICY "Allow read access to all users" 
ON public.tools FOR SELECT 
TO authenticated, anon 
USING (true);

-- 6. Masukkan / perbarui data 8 Tools ke dalam tabel tools
INSERT INTO public.tools ("name", "slug", "description", "icon", "category", "is_active")
VALUES
(
  'Slack',
  'slack',
  'Send messages, read channels, and manage team notifications',
  'https://cdn.simpleicons.org/slack/4A154B',
  'Communication',
  true
),
(
  'Gmail',
  'gmail',
  'Read incoming emails, search threads, and draft or send replies',
  'https://cdn.simpleicons.org/gmail/EA4335',
  'Communication',
  true
),
(
  'Outlook',
  'outlook',
  'Send emails and read messages from Microsoft Outlook accounts',
  'https://cdn.simpleicons.org/microsoftoutlook/0078D4',
  'Communication',
  true
),
(
  'Notion',
  'notion',
  'Read, search, and update Notion workspace pages and databases',
  'https://cdn.simpleicons.org/notion/000000',
  'Productivity',
  true
),
(
  'Google Calendar',
  'googlecalendar',
  'Schedule meetings, check availability, and list calendar events',
  'https://cdn.simpleicons.org/googlecalendar/4285F4',
  'Productivity',
  true
),
(
  'Google Docs',
  'googledocs',
  'Create, read, and append content to Google Documents',
  'https://cdn.simpleicons.org/googledocs/4285F4',
  'Productivity',
  true
),
(
  'GitHub',
  'github',
  'Create issues, review pull requests, and query repository stats',
  'https://cdn.simpleicons.org/github/181717',
  'Development',
  true
),
(
  'Reddit',
  'reddit',
  'Read posts, search subreddits, and track community discussions',
  'https://cdn.simpleicons.org/reddit/FF4500',
  'Social',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- 7. Muat ulang cache skema PostgREST Supabase
NOTIFY pgrst, 'reload schema';
