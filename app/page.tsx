import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Play,
  Bot,
  Radar,
  Gauge,
  ShieldCheck,
  Zap,
  Cpu,
  Route,
  Layers,
  CalendarClock,
  PlugZap,
  LockKeyhole,
  Workflow,
  MessageSquareText,
  BrainCircuit,
  FileCheck2,
  Check,
  DatabaseZap,
  Globe,
  GitBranch,
  Search,
  ChevronRight,
  Terminal,
} from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f8ff] text-neutral-950 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-blue-950/10 bg-[#f5f8ff]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2.5" aria-label="Orbit home" href="/">
            <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-blue-600 text-white shadow-sm ring-1 ring-blue-950/10 font-bold text-lg">
              O
            </span>
            <span className="text-xl font-bold tracking-tight text-blue-950">Orbit</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
            <a href="#platform" className="text-sm font-medium text-slate-600 transition hover:text-blue-950">
              Platform
            </a>
            <a href="#agents" className="text-sm font-medium text-slate-600 transition hover:text-blue-950">
              Agents
            </a>
            <a href="#automations" className="text-sm font-medium text-slate-600 transition hover:text-blue-950">
              Automations
            </a>
            <a href="#security" className="text-sm font-medium text-slate-600 transition hover:text-blue-950">
              Security
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-600/10 hover:text-blue-950 sm:inline-flex"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition gap-1.5"
              href="/workspace"
            >
              <span>Launch</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-blue-950/10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-600/70 to-transparent"></div>
        <div className="absolute left-1/2 top-0 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"></div>

        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-24">
          {/* Left Column: Hero Copy */}
          <div className="flex flex-col justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-950/10 bg-white px-3 py-1 text-xs font-semibold text-blue-950 shadow-xs mb-6 w-fit">
              <Sparkles className="size-3.5 text-blue-600" />
              <span>Recurring AI agent bots</span>
            </span>

            <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-blue-950 sm:text-6xl">
              Automate the tasks users repeat every day.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Orbit lets users create AI agent bots that remember instructions, run on a schedule, use connected tools, and report back when recurring work is done.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition gap-2"
                href="/workspace"
              >
                <span>Create recurring agent</span>
                <ArrowRight className="size-4" />
              </Link>

              <a
                href="#platform"
                className="inline-flex items-center justify-center rounded-xl border border-blue-950/15 bg-white px-6 py-3.5 text-base font-semibold text-blue-950 hover:bg-blue-50 transition gap-2 shadow-xs"
              >
                <Play className="size-4 text-blue-600 fill-blue-600" />
                <span>See how it runs</span>
              </a>
            </div>

            <div className="mt-12 grid max-w-xl grid-cols-3 border-y border-blue-950/10 py-5">
              <div className="pr-4">
                <div className="text-3xl font-extrabold text-blue-950">24/7</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">recurring runs</div>
              </div>
              <div className="pr-4 border-l border-blue-950/10 pl-4">
                <div className="text-3xl font-extrabold text-blue-950">80+</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">task actions</div>
              </div>
              <div className="pr-4 border-l border-blue-950/10 pl-4">
                <div className="text-3xl font-extrabold text-blue-950">0</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">manual repeats</div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Command Card */}
          <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-blue-950/10 bg-[#071225] p-3 shadow-2xl shadow-blue-950/20">
            <div className="flex h-full flex-col rounded-xl border border-white/10 bg-[#08111f]">
              {/* Terminal Title Bar */}
              <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-rose-500"></span>
                  <span className="size-3 rounded-full bg-amber-400"></span>
                  <span className="size-3 rounded-full bg-emerald-400"></span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono text-neutral-300">
                  <Terminal className="size-3.5 text-blue-400" />
                  <span>orbit.agent/run</span>
                </div>
              </div>

              {/* Console Body */}
              <div className="grid flex-1 gap-3 p-4 lg:grid-cols-[0.85fr_1.15fr]">
                {/* Left Mini Panel */}
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Bot className="size-4 text-blue-400" />
                        <span>Recurring Task Bot</span>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        live
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3 rounded-lg bg-black/30 p-2.5">
                        <span className="grid size-6 place-items-center rounded-md bg-white/10 text-xs font-bold text-white">
                          1
                        </span>
                        <span className="text-xs text-neutral-300">Check new user requests</span>
                      </div>
                      <div className="flex items-center gap-3 rounded-lg bg-black/30 p-2.5">
                        <span className="grid size-6 place-items-center rounded-md bg-white/10 text-xs font-bold text-white">
                          2
                        </span>
                        <span className="text-xs text-neutral-300">Update the daily tracker</span>
                      </div>
                      <div className="flex items-center gap-3 rounded-lg bg-black/30 p-2.5">
                        <span className="grid size-6 place-items-center rounded-md bg-white/10 text-xs font-bold text-white">
                          3
                        </span>
                        <span className="text-xs text-neutral-300">Send completion summary</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <Radar className="size-4 text-amber-400" />
                      <span>Tool routing</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-neutral-300">
                        Browser
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-neutral-300">
                        Calendar
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-neutral-300">
                        Email
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-neutral-300">
                        Database
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-neutral-300">
                        Desktop VM
                      </div>
                      <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-neutral-300">
                        Workflows
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Mini Panel */}
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-white/10 bg-[#edf4ff] p-4 text-blue-950">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                          Current mission
                        </div>
                        <h2 className="mt-1 text-lg font-bold tracking-tight">
                          Run my weekday customer follow-up routine
                        </h2>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white p-3 shadow-xs">
                        <div className="text-lg font-bold">18</div>
                        <div className="text-[11px] text-neutral-500">Tasks</div>
                      </div>
                      <div className="rounded-lg bg-white p-3 shadow-xs">
                        <div className="text-lg font-bold text-emerald-600">72%</div>
                        <div className="text-[11px] text-neutral-500">Done</div>
                      </div>
                      <div className="rounded-lg bg-white p-3 shadow-xs">
                        <div className="text-lg font-bold text-blue-600">3</div>
                        <div className="text-[11px] text-neutral-500">Review</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Gauge className="size-4 text-blue-400" />
                        <span>Run health</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-2 w-[82%] rounded-full bg-blue-400 transition-all"></div>
                      </div>
                      <div className="mt-2 text-xs text-neutral-400">82% complete</div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <ShieldCheck className="size-4 text-emerald-400" />
                        <span>Approval gate</span>
                      </div>
                      <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                        Waiting on final publish
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid size-8 place-items-center rounded-lg bg-blue-500 text-white shrink-0">
                        <Zap className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Next recurring action</div>
                        <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
                          Check inbox at 9:00 AM, summarize new leads, and update the user dashboard.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Platform: Command Surface */}
      <section id="platform" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mb-12 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-950/10 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow-xs mb-4">
              <Cpu className="size-3.5 text-blue-600" />
              <span>Platform</span>
            </span>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-blue-950 sm:text-5xl">
              A minimal command surface for capable agents.
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-neutral-600">
            Every panel is designed for scanning: what the agent knows, what it is doing, and what it needs from you.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <article className="group rounded-2xl border border-black/10 bg-white p-7 shadow-xs transition hover:-translate-y-1 hover:shadow-xl lg:col-span-2">
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
                  <Route className="size-6" />
                </span>
                <ChevronRight className="size-5 text-neutral-300 transition group-hover:translate-x-1 group-hover:text-blue-950" />
              </div>
              <h3 className="text-2xl font-bold text-blue-950">Plan, browse, and act</h3>
              <p className="mt-3 max-w-xl leading-relaxed text-neutral-600">
                Orbit breaks goals into visible steps, opens tools, gathers context, and keeps the next action clear.
              </p>
            </div>
          </article>

          <article className="group rounded-2xl border border-black/10 bg-white p-7 shadow-xs transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Layers className="size-6" />
                </span>
                <ChevronRight className="size-5 text-neutral-300 transition group-hover:translate-x-1 group-hover:text-blue-950" />
              </div>
              <h3 className="text-2xl font-bold text-blue-950">Native agent workspace</h3>
              <p className="mt-3 leading-relaxed text-neutral-600">
                Chat, task state, files, schedules, and live execution stay in one quiet command center.
              </p>
            </div>
          </article>

          <article className="group rounded-2xl border border-black/10 bg-white p-7 shadow-xs transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-amber-500 text-white shadow-xs">
                  <CalendarClock className="size-6" />
                </span>
                <ChevronRight className="size-5 text-neutral-300 transition group-hover:translate-x-1 group-hover:text-blue-950" />
              </div>
              <h3 className="text-2xl font-bold text-blue-950">Routine automation</h3>
              <p className="mt-3 leading-relaxed text-neutral-600">
                Turn repeat work into scheduled runs with execution history and human checkpoints.
              </p>
            </div>
          </article>

          <article className="group rounded-2xl border border-black/10 bg-white p-7 shadow-xs transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-rose-500 text-white shadow-xs">
                  <PlugZap className="size-6" />
                </span>
                <ChevronRight className="size-5 text-neutral-300 transition group-hover:translate-x-1 group-hover:text-blue-950" />
              </div>
              <h3 className="text-2xl font-bold text-blue-950">Tool intelligence</h3>
              <p className="mt-3 leading-relaxed text-neutral-600">
                Suggests the right connected tools as the task evolves, then uses them with auditable context.
              </p>
            </div>
          </article>

          <article className="group rounded-2xl border border-black/10 bg-white p-7 shadow-xs transition hover:-translate-y-1 hover:shadow-xl">
            <div className="flex h-full flex-col">
              <div className="mb-6 flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-violet-600 text-white shadow-xs">
                  <LockKeyhole className="size-6" />
                </span>
                <ChevronRight className="size-5 text-neutral-300 transition group-hover:translate-x-1 group-hover:text-blue-950" />
              </div>
              <h3 className="text-2xl font-bold text-blue-950">Secure memory layer</h3>
              <p className="mt-3 leading-relaxed text-neutral-600">
                Keep preferences, agent configuration, and run history available without burying teams in setup.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* Section Agents: 4 Steps */}
      <section id="agents" className="border-y border-black/10 bg-white py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-950/10 bg-[#f5f8ff] px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs mb-4">
              <Workflow className="size-3.5 text-blue-600" />
              <span>Agents</span>
            </span>
            <h2 className="text-3xl font-bold tracking-tight text-blue-950 sm:text-5xl leading-tight">
              From prompt to repeatable operation.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-neutral-600">
              Orbit makes agent behavior legible. You get clear planning, tool execution, human review points, and durable records for each run.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-blue-950/10 bg-[#f5f8ff] p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-neutral-950 text-white">
                  <MessageSquareText className="size-5" />
                </span>
                <span className="text-sm font-bold text-neutral-400">01</span>
              </div>
              <h3 className="text-lg font-bold text-blue-950">Describe the outcome</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Give Orbit a goal, attach context, or start from an existing routine.
              </p>
            </div>

            <div className="rounded-xl border border-blue-950/10 bg-[#f5f8ff] p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-neutral-950 text-white">
                  <BrainCircuit className="size-5" />
                </span>
                <span className="text-sm font-bold text-neutral-400">02</span>
              </div>
              <h3 className="text-lg font-bold text-blue-950">Watch the plan form</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                The agent maps tools, dependencies, and checks before it starts acting.
              </p>
            </div>

            <div className="rounded-xl border border-blue-950/10 bg-[#f5f8ff] p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-neutral-950 text-white">
                  <FileCheck2 className="size-5" />
                </span>
                <span className="text-sm font-bold text-neutral-400">03</span>
              </div>
              <h3 className="text-lg font-bold text-blue-950">Approve key moves</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Review sensitive actions, scheduled work, and external tool changes.
              </p>
            </div>

            <div className="rounded-xl border border-blue-950/10 bg-[#f5f8ff] p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-neutral-950 text-white">
                  <Check className="size-5" />
                </span>
                <span className="text-sm font-bold text-neutral-400">04</span>
              </div>
              <h3 className="text-lg font-bold text-blue-950">Ship the result</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Every run leaves a clean trail of outputs, decisions, and next steps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Automations & Security */}
      <section id="automations" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Automations Card */}
          <div className="rounded-2xl border border-black/10 bg-neutral-950 p-8 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  <DatabaseZap className="size-3.5 text-amber-300" />
                  <span>Automations</span>
                </span>
                <h2 className="mt-5 max-w-xl text-3xl font-bold tracking-tight sm:text-5xl leading-tight">
                  Schedule routines without losing the thread.
                </h2>
              </div>
              <Globe className="hidden size-12 text-blue-300 sm:block" />
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Daily lead research</span>
                  <span className="size-2 rounded-full bg-emerald-400"></span>
                </div>
                <div className="text-3xl font-bold">06:30</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-neutral-400">scheduled</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Weekly report draft</span>
                  <span className="size-2 rounded-full bg-emerald-400"></span>
                </div>
                <div className="text-3xl font-bold">Mon</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-neutral-400">scheduled</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Incident summary</span>
                  <span className="size-2 rounded-full bg-emerald-400"></span>
                </div>
                <div className="text-3xl font-bold text-amber-400">Live</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-neutral-400">triggered</div>
              </div>
            </div>
          </div>

          {/* Security Card */}
          <div id="security" className="rounded-2xl border border-black/10 bg-white p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-950/10 bg-[#f5f8ff] px-3 py-1 text-xs font-semibold text-slate-700">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              <span>Security</span>
            </span>
            <h2 className="mt-5 text-3xl font-bold text-blue-950">Human control stays close.</h2>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-blue-950/10 bg-[#f5f8ff] p-3.5">
                <span className="grid size-7 place-items-center rounded-lg bg-emerald-600 text-white shrink-0">
                  <Check className="size-4" />
                </span>
                <span className="text-sm font-semibold text-neutral-700">Approval gates for external changes</span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-blue-950/10 bg-[#f5f8ff] p-3.5">
                <span className="grid size-7 place-items-center rounded-lg bg-emerald-600 text-white shrink-0">
                  <Check className="size-4" />
                </span>
                <span className="text-sm font-semibold text-neutral-700">Run history for every agent task</span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-blue-950/10 bg-[#f5f8ff] p-3.5">
                <span className="grid size-7 place-items-center rounded-lg bg-emerald-600 text-white shrink-0">
                  <Check className="size-4" />
                </span>
                <span className="text-sm font-semibold text-neutral-700">Workspace-first authentication</span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-blue-950/10 bg-[#f5f8ff] p-3.5">
                <span className="grid size-7 place-items-center rounded-lg bg-emerald-600 text-white shrink-0">
                  <Check className="size-4" />
                </span>
                <span className="text-sm font-semibold text-neutral-700">Tool status and disconnect controls</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Connected Work Section */}
      <section className="border-y border-black/10 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-950/10 bg-[#f5f8ff] px-3 py-1 text-xs font-semibold text-slate-700 mb-4">
                <GitBranch className="size-3.5 text-rose-600" />
                <span>Connected work</span>
              </span>
              <h2 className="text-3xl font-bold text-blue-950 sm:text-4xl">
                Built for the tools agents already need.
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['Browser', 'Calendar', 'Email', 'Database', 'Desktop VM', 'Workflows', 'Files', 'APIs'].map((tool) => (
                <div
                  key={tool}
                  className="rounded-xl border border-blue-950/10 bg-[#f5f8ff] px-4 py-5 text-center text-sm font-bold text-slate-800 hover:border-blue-500 hover:bg-white transition shadow-2xs"
                >
                  {tool}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="border-t border-black/10 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white font-bold text-sm">
              O
            </span>
            <span className="text-base font-bold text-blue-950">Orbit AI Agent Platform</span>
          </div>

          <p className="text-xs text-neutral-500">
            Powered by Google Gemini 2.5, Composio Connectors, & Supabase Database.
          </p>

          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            <span>Open Workspace</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
