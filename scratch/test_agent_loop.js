const { streamGeminiTurn } = require('../lib/agent-sdk/providers/gemini');
const { DEFAULT_AGENT_TOOLS } = require('../lib/agent-sdk/tools/builtins');

async function testAgentLoop() {
  const tools = DEFAULT_AGENT_TOOLS;
  const userPrompt = 'Berapa 125 * 38? Lalu hitung akarnya.';
  
  // Convert messages to Gemini format
  const contents = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  console.log('User:', userPrompt);

  let turns = 0;
  const maxTurns = 6;

  while (turns < maxTurns) {
    turns++;
    console.log(`\n=== TURN ${turns} ===`);
    const stream = streamGeminiTurn({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      systemInstruction: 'Anda adalah AI asisten Grok. Gunakan tool yang tepat.',
      contents,
      tools
    });

    let fullText = '';
    const functionCalls = [];

    for await (const chunk of stream) {
      if (chunk.type === 'token') {
        fullText += chunk.token;
        process.stdout.write(chunk.token);
      } else if (chunk.type === 'function_call') {
        functionCalls.push(chunk.functionCall);
      }
    }

    if (functionCalls.length > 0) {
      for (const fc of functionCalls) {
        console.log(`\n[LLM chose tool]: ${fc.name} with args:`, fc.args);
        // Find tool
        const tool = tools.find(t => t.name === fc.name);
        let result;
        if (tool) {
          result = await tool.execute(fc.args, { agentId: 'test', agentName: 'TestAgent', userId: 'test_user' });
        } else {
          result = { error: `Tool ${fc.name} not found` };
        }
        console.log(`[Tool Output]:`, result);

        // Append model tool call to contents
        contents.push({
          role: 'model',
          parts: [{ functionCall: fc }]
        });
        // Append tool result to contents
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: fc.name,
              response: result
            }
          }]
        });
      }
    } else {
      console.log('\n[Final text answer received. Loop finished.]');
      break;
    }
  }
}

testAgentLoop();
