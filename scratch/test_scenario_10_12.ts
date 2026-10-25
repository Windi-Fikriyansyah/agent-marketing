import { AgentRuntime } from '../lib/agent-sdk/runtime'

async function test10and12() {
  const runtime = new AgentRuntime({
    agentId: 'agent-test-10-12',
    name: 'Grok Assistant',
    instructions: 'Asisten AI cerdas.',
    userId: 'user_scenario_test_' + Date.now(),
  })

  console.log('=== TEST SKENARIO 10: Unconnected Account -> Connect Link ===')
  const p10 = 'Periksa dan ringkas 3 email terbaru di inbox Gmail saya hari ini'
  console.log('User:', p10)
  for await (const event of runtime.execute(p10)) {
    if (event.type === 'step_start' && event.step === 'pick_tools') {
      console.log('Step 4 Pick Tools:', event.trace?.details)
    }
    if (event.type === 'step_complete' && event.step === 'run_tools') {
      console.log('Step 5 Run Tools Output:', event.trace?.details?.output)
    }
    if (event.type === 'token') {
      process.stdout.write(event.data.token)
    }
    if (event.type === 'final_response') {
      console.log('\nFinal response:', event.data?.answer)
    }
  }

  console.log('\n\n=== TEST SKENARIO 12: Sensitive Action -> Approval Required ===')
  const p12 = 'Kirim email ke direktur@perusahaan.com dengan subjek "Laporan Mingguan" dan isi "Laporan telah selesai"'
  console.log('User:', p12)
  for await (const event of runtime.execute(p12)) {
    if (event.type === 'approval_required') {
      console.log('APPROVAL REQUIRED CAPTURED!')
      console.log('Approval Request Details:', event.data)
    }
  }
}

test10and12().catch(console.error)
