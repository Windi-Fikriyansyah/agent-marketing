import { AgentRuntime } from '../lib/agent-sdk/runtime'

async function testOpenRouterAgentLoop() {
  console.log('=== TEST OPENROUTER MULTI-TURN AGENT LOOP WITH FUNCTION CALLING ===')
  const runtime = new AgentRuntime({
    agentId: 'test-agent-openrouter',
    name: 'Grok OpenRouter Agent',
    instructions: 'Kamu adalah asisten AI cerdas. Gunakan tool calculator jika diminta menghitung.',
    model: 'thinkingmachines/inkling:free',
    userId: 'user_or_' + Date.now(),
  })

  const prompt = 'Hitung berapa 125 * 38, lalu dari hasilnya cari akar kuadratnya.'
  console.log('User prompt:', prompt)

  let fullResponse = ''
  let finalMeta: any = null

  for await (const event of runtime.execute(prompt)) {
    if (event.type === 'token') {
      process.stdout.write(event.data.token)
      fullResponse += event.data.token
    } else if (event.type === 'step_start') {
      console.log(`\n[STEP ${event.stepNumber}]: ${event.trace?.title} - ${event.trace?.description}`)
      if (event.trace?.details) {
        console.log('  Details:', JSON.stringify(event.trace.details))
      }
    } else if (event.type === 'final_response') {
      finalMeta = event.data
      console.log('\n[FINAL_RESPONSE EVENT RECEIVED]:', {
        servingModel: finalMeta?.servingModel,
        usage: finalMeta?.usage,
      })
    }
  }

  console.log('\n=== TEST COMPLETED! ===')
}

testOpenRouterAgentLoop().catch(console.error)
