import { AgentRuntime } from '../lib/agent-sdk/runtime'

async function test() {
  const runtime = new AgentRuntime({
    agentId: '7e1d76de-c115-4a52-8a1a-01ce34b27cab',
    name: 'Grok Assistant',
    instructions: 'Asisten AI cerdas.',
    userId: 'c6642b50-98a2-426e-8ab1-dc708f80e446',
    connectedTools: ['gmail'],
  })

  const prompt = 'Kirim email penawaran untuk aplikasi Wamaps ke diwin321@gmail.com dengan subjek "Penawaran Eksklusif: Wamaps - Solusi Cerdas Pengambilan Data Google Maps".'
  console.log('Sending prompt:', prompt)

  for await (const ev of runtime.execute(prompt)) {
    console.log('EVENT TYPE:', ev.type, ev.trace?.title || '')
    if (ev.type === 'token') {
      process.stdout.write(ev.data.token)
    }
    if (ev.type === 'approval_required') {
      console.log('\n[APPROVAL REQUIRED]:', JSON.stringify(ev.data, null, 2))
    }
    if (ev.type === 'final_response') {
      console.log('\n[FINAL RESPONSE]:', ev.data?.answer)
    }
  }
}

test().catch(console.error)
