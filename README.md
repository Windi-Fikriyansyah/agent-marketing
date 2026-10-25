# Grok-Style Conversational AI Agent Platform

Aplikasi chatbot AI percakapan yang berfungsi secara riil (*bukan mock-up*), terinspirasi dari arsitektur Grok. Aplikasi ini menggunakan multi-turn Agent Loop sejati berbasis Function/Tool Calling LLM melalui **OpenRouter Gateway Terpusat**, terintegrasi dengan SDK resmi Composio untuk eksekusi aplikasi eksternal, web search real-time, perlindungan SSRF pada web scraping, memori jangka panjang, dan persetujuan Human-in-the-Loop untuk aksi sensitif.

---

## 🌟 Fitur Utama

1. **Centralized OpenRouter Gateway (Ratusan Model AI dari 1 API Key)**
   - Semua panggilan model LLM diarahkan melalui gateway OpenAI-compatible OpenRouter (`https://openrouter.ai/api/v1`).
   - Pengguna bebas memilih model dari katalog nyata OpenRouter (Claude 3.5, GPT-4o, Gemini 2.5, DeepSeek, Qwen, Nemotron, Llama, dll.).
   - Model Selector dinamis di UI dengan badge kapabilitas (Tools, Vision, Context size, dan estimasi biaya per 1M token).
   - Validasi kelayakan agent di server: Hanya model yang mendukung `tools` dan `context_length >= 64,000` yang dapat digunakan untuk mode agent. Model tanpa tools ditolak dengan pesan jelas.
   - Mekanisme Automatic Fallback antar model jika model utama menemui kendala kuota atau gating.
2. **Multi-Turn Agent Loop Sejati (Murni LLM Tool Calling)**
   - Tidak ada aturan berbasis kata kunci (`if "cuaca" in text`), regex intent, ataupun switch-case.
   - LLM secara mandiri menentukan kapan harus menjawab langsung, mencari web, mengeksekusi tool aplikasi, atau memanggil memori.
   - Penggabungan potongan tool call yang datang bertahap (delta) menjadi argumen JSON utuh sebelum dieksekusi, dengan self-healing/recovery error JSON.
3. **Streaming Token Real-Time (SSE)**
   - Respons teks dialirkan token-demi-token secara langsung ke UI melalui Server-Sent Events (SSE).
4. **Integrasi Ekosistem Composio Sessions (SDK Resmi `@composio/core` v0.27.0)**
   - Menggunakan model Sessions resmi Composio (`composio.create(userId)` / `composio.sessions.use(sessionId)`).
   - Menghubungkan akun eksternal secara nyata: Gmail, Google Calendar, Slack, GitHub, Google Docs, Notion.
   - **Connect Link Nyata**: Jika aksi memerlukan otentikasi akun yang belum terhubung, runtime secara otomatis menghasilkan URL Connect Link resmi dari Composio dan menampilkannya di UI.
5. **Tool Lokal Nyata**
   - `web_search`: Pencarian online real-time dengan sitasi URL sumber terverifikasi.
   - `fetch_url`: Ekstraksi konten publik dengan proteksi SSRF Guard (memblokir IP lokal, loopback, privat `10.*`, `192.168.*`, `172.16-31.*`, dan metadata cloud `169.254.*`). Konten diperlakukan murni sebagai data untuk mencegah prompt injection.
   - `calculator`: Evaluasi formula matematika presisi tanpa eksekusi kode berbahaya.
   - `remember` & `recall`: Memori jangka panjang pengguna dengan dual-storage (Supabase `user_memories` + fallback lokal).
6. **Human-in-the-Loop (Approval Requirement)**
   - Aksi sensitif yang mengubah, menulis, mengirim, atau menghapus data (misal: kirim email, buat issue, hapus event) wajib memicu event `approval_required` di UI sebelum eksekusi dilanjutkan.

---

## 🛠️ Arsitektur Sistem

```
[Frontend Chat UI / Workspace] ⇄ (SSE Event Stream) ⇄ [Next.js Route API: /api/agent/chat]
                                                                 │
                                                                 ├── Centralized OpenRouter Gateway:
                                                                 │     (Claude, GPT, Gemini, Nemotron, DeepSeek)
                                                                 ├── Composio Sessions SDK
                                                                 │     (Tool Discovery, Connect Link, Execution)
                                                                 ├── Built-in Tools:
                                                                 │     (web_search, fetch_url, calculator)
                                                                 └── Dual-Storage Memory:
                                                                       (Supabase `user_memories` + Local Fallback)
```

---

## 📋 Prasyarat & Konfigurasi Lingkungan (.env.local)

Salin konfigurasi berikut ke file `.env.local` di root proyek:

```env
# OPENROUTER GATEWAY CONFIGURATION
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=thinkingmachines/inkling:free
OPENROUTER_FALLBACK_MODELS=nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
OPENROUTER_APP_URL=https://agent-marketing.local
OPENROUTER_APP_NAME=Agent Marketing
MIN_CONTEXT_LENGTH=64000

# COMPOSIO API CONFIGURATION (Wajib untuk aplikasi eksternal)
COMPOSIO_API_KEY=your_composio_api_key_here

# SUPABASE (Database percakapan dan memori)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Setup Database (Supabase)
Jalankan skrip migrasi SQL di Supabase SQL Editor:
- Tabel Memori: [supabase/migration_add_memories.sql](file:///d:/agent-marketing/supabase/migration_add_memories.sql)
- Default Model Agents: [supabase/migration_fix_agent_models.sql](file:///d:/agent-marketing/supabase/migration_fix_agent_models.sql)

---

## 🚀 Cara Menjalankan

### 1. Instalasi Dependensi
```bash
npm install --legacy-peer-deps
```

### 2. Mode Pengembangan (Development)
```bash
npm run dev
```
Akses aplikasi melalui browser di `http://localhost:3000`.

### 3. Kompilasi & Build Produksi
```bash
npm run build
npm start
```
