import { streamGeminiTurn } from '../lib/agent-sdk/providers/gemini'
import { DEFAULT_AGENT_TOOLS } from '../lib/agent-sdk/tools/builtins'

async function testWebSearchLoop() {
  const tools = DEFAULT_AGENT_TOOLS
  const userPrompt = 'Siapa pemenang piala oscar film terbaik 2024?'
  
  const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ]

  console.log('User:', userPrompt)

  let turns = 0
  const maxTurns = 5

  while (turns < maxTurns) {
    turns++
    console.log(`\n=== TURN ${turns} ===`)
    const stream = streamGeminiTurn({
      apiKey: process.env.GEMINI_API_KEY!,
      model: 'gemini-2.5-flash',
      systemInstruction: 'Anda asisten Grok. Gunakan web_search untuk fakta. Wajib sertakan sumber URL.',
      contents,
      tools
    })

    let fullText = ''
    const functionCalls: any[] = []

    for await (const chunk of stream) {
      if (chunk.type === 'token' && chunk.token) {
        fullText += chunk.token
        process.stdout.write(chunk.token)
      } else if (chunk.type === 'function_call') {
        functionCalls.push(chunk.functionCall)
      }
    }

    if (functionCalls.length > 0) {
      for (const fc of functionCalls) {
        console.log(`\n[LLM chose tool]: ${fc.name} with args:`, fc.args)
        const tool = tools.find(t => t.name === fc.name)
        let result
        if (tool) {
          result = await tool.execute(fc.args, { agentId: 'test', agentName: 'TestAgent', userId: 'test_user' })
        } else {
          result = { error: `Tool ${fc.name} not found` }
        }
        console.log(`[Tool Output]:`, result)

        contents.push({ role: 'model', parts: [{ functionCall: fc }] })
        contents.push({ role: 'user', parts: [{ functionResponse: { name: fc.name, response: result } }] })
      }
    } else {
      console.log('\n[Finished]')
      break
    }
  }
}

testWebSearchLoop()
