-- ==============================================================================
-- MIGRATION: BUAT TABEL USER_MEMORIES UNTUK MEMORI JANGKA PANJANG AGENT
-- ==============================================================================
-- Sesuai AGENTS.md Bagian 3.2: Fakta penting tentang pengguna disimpan dan
-- dipanggil kembali lewat tool remember / recall (bukan pencocokan kata kunci).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_memories (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON public.user_memories(user_id);

ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own memories" ON public.user_memories;
CREATE POLICY "Users can view their own memories"
ON public.user_memories FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own memories" ON public.user_memories;
CREATE POLICY "Users can insert their own memories"
ON public.user_memories FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own memories" ON public.user_memories;
CREATE POLICY "Users can delete their own memories"
ON public.user_memories FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
