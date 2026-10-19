import Link from 'next/link'
import {
  Terminal,
  Database,
  Shield,
  ArrowRight,
  Code2,
  Lock,
  Layers,
  KeyRound,
  CheckCircle2,
  Table
} from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 bg-dev-grid text-slate-900 flex flex-col justify-between antialiased selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center font-bold text-white text-xs">
              G
            </div>
            <span className="font-semibold text-sm tracking-tight text-slate-900">GrokBot</span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500">
              Supabase v2.0
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded dev-btn-secondary text-xs font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 rounded dev-btn-primary text-xs font-medium flex items-center gap-1.5"
            >
              <span>Masuk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white border border-slate-200 text-xs font-mono text-slate-600 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Production-Grade Supabase Auth & PostgreSQL</span>
        </div>

        <div className="space-y-4 max-w-3xl">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Autentikasi Terintegrasi & Database PostgreSQL Supabase
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Arsitektur autentikasi berbasis cookie SSR modern dengan manajemen sesi Next.js 16, proteksi Proxy, serta sinkronisasi tabel data <code className="text-blue-700 font-mono font-medium">public.profiles</code> dengan Row Level Security (RLS).
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center max-w-sm pt-2">
          <Link
            href="/login"
            className="w-full sm:w-auto px-5 py-2.5 rounded dev-btn-primary text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span>Buka Halaman Login</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 rounded dev-btn-secondary text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>Akses Console Dashboard</span>
          </Link>
        </div>

        {/* System Architecture Spec Terminal Card */}
        <div className="w-full max-w-3xl dev-card rounded-lg overflow-hidden text-left mt-8 bg-white shadow-sm border border-slate-200">
          <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span className="text-[11px] font-mono text-slate-600 ml-2">architecture-spec.json</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Next.js 16 + @supabase/ssr</span>
          </div>

          <div className="p-4 sm:p-5 font-mono text-xs space-y-3 bg-slate-50/60 overflow-x-auto">
            <div className="text-slate-400">// Stack components & database configuration</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-blue-700 font-semibold block">Authentication Engine:</span>
                <div className="text-slate-600 pl-3 border-l border-slate-200 space-y-1 text-[11px]">
                  <div>• Provider: Email + Password, PKCE OAuth</div>
                  <div>• Session: Secure HTTP-Only Cookie via SSR</div>
                  <div>• Proxy: Next.js 16 Route Protection</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-emerald-700 font-semibold block">Database Storage:</span>
                <div className="text-slate-600 pl-3 border-l border-slate-200 space-y-1 text-[11px]">
                  <div>• Engine: PostgreSQL 15+ (Supabase)</div>
                  <div>• Security: Row Level Security (RLS) Active</div>
                  <div>• Table: public.profiles linked to auth.users</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left pt-6">
          <div className="dev-card p-4 rounded-lg space-y-2 bg-white shadow-xs">
            <div className="w-7 h-7 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">Autentikasi Bersih</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Dukungan login & registrasi email, toggle visibilitas kata sandi, reset kata sandi, dan penanganan status error ramah pengguna.
            </p>
          </div>

          <div className="dev-card p-4 rounded-lg space-y-2 bg-white shadow-xs">
            <div className="w-7 h-7 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <Table className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">PostgreSQL Profiling</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Manajemen data profil pengguna dengan trigger otomatis saat pendaftaran dan editor profil langsung dari dashboard.
            </p>
          </div>

          <div className="dev-card p-4 rounded-lg space-y-2 bg-white shadow-xs">
            <div className="w-7 h-7 rounded bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900">Sidebar Navigation</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Console dashboard dengan navigasi menu sidebar terorganisir untuk ringkasan, profil, database, autentikasi, dan pengaturan API.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 text-xs font-mono text-slate-500 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>GrokBot Console • Clean Light Developer Experience</span>
          <div className="flex items-center gap-4 text-slate-500">
            <Link href="/login" className="hover:text-slate-900 transition-colors">
              Login
            </Link>
            <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
