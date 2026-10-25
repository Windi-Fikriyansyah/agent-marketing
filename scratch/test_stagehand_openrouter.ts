import { Browserbase } from '@browserbasehq/sdk'

async function testOpenRouterWithStagehand() {
  const { browserbase, Stagehand } = await import('@browserbasehq/stagehand')
  const apiKey = process.env.BROWSERBASE_API_KEY!
  const projectId = process.env.BROWSERBASE_PROJECT_ID
  const openRouterKey = process.env.OPENROUTER_API_KEY!
  const openRouterModel = process.env.OPENROUTER_DEFAULT_MODEL || 'google/gemini-2.5-flash'
  const openRouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'

  console.log(`Connecting to Browserbase...`);
  console.log(`OpenRouter Model for Stagehand: ${openRouterModel}`);

  const bb = new Browserbase({ apiKey })
  const browser = await browserbase.launch({
    apiKey,
    projectId,
    keepAlive: true,
  })

  const sid = (browser as any).sessionId || (browser as any).session?.id
  console.log(`Browserbase Session ID: ${sid}`);

  // Create custom OpenRouter ClientLLM for Stagehand v4
  const clientLLM = {
    generate: async (input: any) => {
      console.log(`\n[Stagehand -> OpenRouter] Generating response for Stagehand step...`);
      console.log(`  Input messages count: ${input.messages?.length}`);
      console.log(`  Response format:`, input.responseFormat ? 'JSON/Schema' : 'Text');

      const messages: any[] = []
      if (input.systemPrompt) {
        messages.push({ role: 'system', content: input.systemPrompt })
      }

      for (const m of input.messages || []) {
        let textContent = ''
        if (typeof m.content === 'string') {
          textContent = m.content
        } else if (Array.isArray(m.content)) {
          textContent = m.content
            .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
            .join('\n')
        } else if (m.content?.text) {
          textContent = m.content.text
        } else {
          textContent = JSON.stringify(m.content)
        }
        messages.push({ role: m.role, content: textContent })
      }

      const isJsonExpected = !!input.responseFormat
      if (input.responseFormat) {
        messages.push({
          role: 'system',
          content: `You must strictly return a valid JSON object matching this schema: ${JSON.stringify(input.responseFormat)}. If the schema requires an "extraction" key, your JSON must have the exact key "extraction": string. No conversational filler.`,
        })
      }

      const openRouterPayload: any = {
        model: openRouterModel,
        messages,
      }

      if (isJsonExpected) {
        openRouterPayload.response_format = { type: 'json_object' }
      }

      const res = await fetch(`${openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'https://agent-marketing.local',
          'X-Title': process.env.OPENROUTER_APP_NAME || 'Agent Marketing',
        },
        body: JSON.stringify(openRouterPayload),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`)
      }

      const json = await res.json()
      const rawText = json.choices?.[0]?.message?.content || ''
      console.log(`[OpenRouter -> Stagehand] Received raw response: ${rawText.substring(0, 150)}...`);

      if (isJsonExpected) {
        let structured: any = {}
        try {
          const match = rawText.match(/\{[\s\S]*\}/)
          structured = JSON.parse(match ? match[0] : rawText)
        } catch {
          structured = { extraction: rawText }
        }

        // Normalize common key variants to Stagehand's expected "extraction" key
        if (!structured.extraction && structured.extracted_text) {
          structured.extraction = structured.extracted_text
          delete structured.extracted_text
        } else if (!structured.extraction && structured.result) {
          structured.extraction = structured.result
          delete structured.result
        }

        return {
          role: 'assistant',
          outputFormat: 'json_schema',
          structuredContent: structured,
          content: [{ type: 'text', text: JSON.stringify(structured) }],
        }
      }

      return {
        role: 'assistant',
        outputFormat: 'text',
        content: [{ type: 'text', text: rawText }],
      }
    },
  }

  const stagehand = await Stagehand.create({
    browser,
    model: clientLLM as any,
  })

  console.log(`Navigating to https://news.ycombinator.com...`);
  const page = (await stagehand.browser.context.activePage())!
  await page.goto('https://news.ycombinator.com', { waitUntil: 'domcontentloaded' })
  const title = await page.title()
  console.log(`Page title: ${title}`);

  console.log(`Extracting headline with OpenRouter model: ${openRouterModel}...`);
  const extracted = await stagehand.extract('ambil judul berita ranking 1');
  console.log(`\n🎉 EXTRACTION SUCCESS WITH OPENROUTER MODEL:`);
  console.log(extracted.data);

  await browser.close()
  await bb.sessions.update(sid, { status: 'REQUEST_RELEASE' })
  console.log(`Closed session and verified cleanly.`);
}

testOpenRouterWithStagehand().catch((err) => {
  console.error('ERROR in OpenRouter Stagehand test:', err);
  process.exit(1);
})
