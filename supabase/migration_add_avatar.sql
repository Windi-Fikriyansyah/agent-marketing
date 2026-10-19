-- ==============================================================================
-- FIX: Could not find the 'avatar' column of 'agents' in the schema cache
-- ==============================================================================
-- Jalankan skrip 2 baris ini di Supabase Dashboard -> SQL Editor
-- untuk menambahkan kolom `avatar` ke tabel `agents` dan memperbarui cache Supabase.
-- ==============================================================================

-- 1. Tambahkan kolom avatar jika belum ada
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS avatar TEXT;

-- 2. Muat ulang schema cache PostgREST agar Supabase langsung mengenali kolom baru
NOTIFY pgrst, 'reload schema';
