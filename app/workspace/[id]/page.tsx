import { Suspense } from 'react'
import WorkspaceAgentClient from './WorkspaceAgentClient'
import { RefreshCw } from 'lucide-react'

async function AgentResolver({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorkspaceAgentClient agentId={id} />
}

export default function WorkspaceAgentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
          <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Memuat workspace agent...</span>
          </div>
        </div>
      }
    >
      <AgentResolver params={params} />
    </Suspense>
  )
}
