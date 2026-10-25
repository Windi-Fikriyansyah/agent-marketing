const { z } = require('zod');

function zodFieldToGemini(field) {
  let cur = field;
  let description = cur.description;
  if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) {
    cur = cur.unwrap();
    if (!description && cur.description) description = cur.description;
  }
  if (cur instanceof z.ZodString) {
    return { type: 'string', description };
  }
  if (cur instanceof z.ZodNumber) {
    return { type: 'number', description };
  }
  if (cur instanceof z.ZodBoolean) {
    return { type: 'boolean', description };
  }
  if (cur instanceof z.ZodEnum) {
    return { type: 'string', enum: cur._def.values, description };
  }
  if (cur instanceof z.ZodArray) {
    return { type: 'array', items: zodFieldToGemini(cur._def.type), description };
  }
  return { type: 'string', description };
}

function zodToGeminiParameters(schema) {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties = {};
    const required = [];
    for (const key of Object.keys(shape)) {
      const field = shape[key];
      properties[key] = zodFieldToGemini(field);
      if (!(field instanceof z.ZodOptional) && !(field instanceof z.ZodNullable)) {
        required.push(key);
      }
    }
    return { type: 'object', properties, required };
  }
  return { type: 'object', properties: {} };
}

async function* streamGeminiTurn({ apiKey, model, systemInstruction, contents, tools }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  if (tools && tools.length > 0) {
    payload.tools = [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: zodToGeminiParameters(t.parameters)
      }))
    }];
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let functionCall = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.replace('data: ', '').trim();
      if (!jsonStr) continue;

      try {
        const chunk = JSON.parse(jsonStr);
        const candidate = chunk.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (part?.functionCall) {
          functionCall = part.functionCall;
        }

        if (part?.text) {
          fullText += part.text;
          yield { type: 'token', token: part.text };
        }
      } catch (parseErr) {
        // ignore incomplete SSE chunk
      }
    }
  }

  return { text: fullText, functionCall };
}

async function run() {
  const tools = [
    {
      name: 'calculator',
      description: 'Calculate math expressions',
      parameters: z.object({ expression: z.string().describe('Formula e.g. 12 * 12') })
    }
  ];

  console.log('Testing streaming text...');
  const gen1 = streamGeminiTurn({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: 'Halo! Perkenalkan dirimu dengan 1 kalimat singkat.' }] }]
  });

  for await (const event of gen1) {
    process.stdout.write(`[Token: ${event.token}] `);
  }
  console.log('\nText stream completed!\n');

  console.log('Testing streaming tool call...');
  const gen2 = streamGeminiTurn({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: 'Berapa 99 kali 88?' }] }],
    tools
  });

  const res2 = await gen2.next();
  console.log('Tool call test returned:', res2);
}

run();
