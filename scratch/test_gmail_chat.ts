import { AgentRuntime } from '../lib/agent-sdk/runtime'

async function testGmailChat() {
  console.log('=== TEST REAL GMAIL EXTRACTION IN AGENT LOOP ===')
  const runtime = new AgentRuntime({
    agentId: '7e1d76de-c115-4a52-8a1a-01ce34b27cab',
    name: 'Grok Assistant',
    instructions: 'Kamu adalah asisten AI yang dapat membaca Gmail pengguna jika diminta.',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    userId: 'c6642b50-98a2-426e-8ab1-dc708f80e446',
  })

  const prompt = 'Tolong periksa dan tampilkan subjek dari email terbaru di inbox Gmail saya.'
  console.log('User prompt:', prompt)

  let fullResponse = ''
  for await (const event of runtime.execute(prompt)) {
    if (event.type === 'token' && event.data?.token) {
      process.stdout.write(event.data.token)
      fullResponse += event.data.token
    } else if (event.type === 'step_start' && event.step === 'pick_tools') {
      console.log('\n[Tool Picked]:', event.trace?.details?.toolName, event.trace?.details?.arguments)
    } else if (event.type === 'step_complete' && event.step === 'run_tools') {
      console.log('\n[Tool Result Output]:', JSON.stringify(event.trace?.details?.output).slice(0, 300))
    }
  }

  console.log('\n\n=== RESPONSE FINISHED ===')
  console.log('Total characters:', fullResponse.length)
}

testGmailChat().catch(console.error)
