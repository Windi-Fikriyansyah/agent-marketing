import { streamOpenRouterTurn } from '../lib/agent-sdk/providers/openrouter'

async function testOpenRouter() {
  console.log('Testing OpenRouter stream with fallback...')
  const generator = streamOpenRouterTurn({
    model: 'thinkingmachines/inkling:free',
    fallbackModels: ['nvidia/nemotron-3-ultra-550b-a55b:free'],
    messages: [{ role: 'user', content: 'Sebutkan 3 warna pelangi singkat saja.' }]
  })

  let full = ''
  for await (const chunk of generator) {
    if (chunk.type === 'token' && chunk.token) {
      process.stdout.write(chunk.token)
      full += chunk.token
    }
    if (chunk.type === 'meta') {
      console.log('\n[Meta]:', chunk.meta)
    }
  }
  console.log('\nFinished successfully! Total length:', full.length)
}

testOpenRouter().catch(console.error)
