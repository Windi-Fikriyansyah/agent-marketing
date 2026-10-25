import { AgentRuntime } from '../lib/agent-sdk/runtime'

async function testApprovedFlow() {
  const runtime = new AgentRuntime({
    agentId: '7e1d76de-c115-4a52-8a1a-01ce34b27cab',
    name: 'Grok Assistant',
    instructions: 'Asisten AI cerdas.',
    userId: 'c6642b50-98a2-426e-8ab1-dc708f80e446',
    connectedTools: ['gmail'],
  })

  const approvedAction = {
    toolName: 'gmail',
    parameters: {
      action: 'send_email',
      recipient_email: 'diwin321@gmail.com',
      subject: 'Penawaran Eksklusif: Wamaps - Solusi Cerdas Pengambilan Data Google Maps',
      body: 'Halo dari Wamaps! Ini penawaran eksklusif kami.',
    },
  }

  console.log('--- Testing Approved Action Execution ---')
  for await (const ev of runtime.execute('', {
    approvedAction,
    conversationHistory: [
      {
        role: 'user',
        content: 'Kirim email penawaran untuk aplikasi Wamaps ke diwin321@gmail.com dengan subjek "Penawaran Eksklusif: Wamaps - Solusi Cerdas Pengambilan Data Google Maps".',
      },
    ],
  })) {
    console.log('EV:', ev.type, ev.trace?.title || '')
    if (ev.type === 'token') process.stdout.write(ev.data.token)
    if (ev.type === 'final_response') console.log('\n[FINAL ANSWER]:', ev.data?.answer)
    if (ev.type === 'error') console.log('\n[ERROR]:', ev.data)
  }
}

testApprovedFlow().catch(console.error)
