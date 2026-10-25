import { AgentRuntime } from '../lib/agent-sdk/runtime'

async function testScenario12Alone() {

  const runtime = new AgentRuntime({
    agentId: 'agent-approval-test',
    name: 'Grok Assistant',
    instructions: 'Asisten AI cerdas.',
    userId: 'user_appr_' + Date.now(),
  })

  console.log('=== TEST SKENARIO 12: Sensitive Action -> Approval Required ===')
  const p12 = 'Kirim email ke direktur@perusahaan.com dengan subjek "Laporan Mingguan" dan isi "Laporan telah selesai"'
  console.log('User:', p12)
  let approvalEventCaptured: any = null
  for await (const event of runtime.execute(p12)) {
    if (event.type === 'approval_required') {
      approvalEventCaptured = event.data
      console.log('✅ APPROVAL REQUIRED EVENT RECEIVED!')
      console.log('Details:', approvalEventCaptured)
    }
  }
}

testScenario12Alone().catch(console.error)
