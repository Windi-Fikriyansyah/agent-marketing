-- ==============================================================================
-- MIGRATION: PERBARUI MODEL AGENTS MENJADI OPENROUTER GATEWAY MODEL
-- ==============================================================================
-- Mengganti semua model lama ('grok-2', 'gemini-*', dll.) menjadi model OpenRouter
-- yang terbukti aktif mendukung function/tool calling dan context >= 64k.
-- ==============================================================================

UPDATE public.agents
SET model = 'nvidia/nemotron-3-ultra-550b-a55b:free'
WHERE model ILIKE '%grok%' OR model IS NULL OR model = '' OR model LIKE 'gemini%';

-- Ubah nilai default kolom model di tabel agents
ALTER TABLE public.agents
ALTER COLUMN model SET DEFAULT 'nvidia/nemotron-3-ultra-550b-a55b:free';
