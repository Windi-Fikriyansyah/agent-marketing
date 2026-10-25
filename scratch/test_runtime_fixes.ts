import { AgentRuntime } from '../lib/agent-sdk/runtime'

async function runTest() {
  const runtime = new AgentRuntime({
    agentId: 'test-agent',
    name: 'Marketing Bot',
    instructions: 'Agent marketing profesional yang ramah dalam Bahasa Indonesia.',
    connectedTools: ['gmail', 'slack'],
    userId: 'diwin6634@gmail.com',
  })

  const testPrompts = [
    'tolong cek apa ada email masuk baru dari Google',
    'tampilkan 2 email paling baru di inbox saya',
  ]

  for (const prompt of testPrompts) {
    console.log(`\n========================================`)
    console.log(`PROMPT: "${prompt}"`)
    console.log(`========================================`)

    for await (const event of runtime.execute(prompt, { conversationHistory: [] })) {
      if (event.type === 'step_complete' && event.step === 'run_tools') {
        console.log('Tool Result Status:', event.trace?.details?.output?.status)
        console.log('Query Used:', event.trace?.details?.output?.query)
        console.log('Count Fetched:', event.trace?.details?.output?.count)
        console.log('Summary:\n', event.trace?.details?.output?.summary)
      }
      if (event.type === 'final_response') {
        console.log('\nAI RESPONSE:\n', event.data?.answer)
      }
    }
  }
}

runTest().catch(console.error)
