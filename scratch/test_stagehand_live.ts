import { Browserbase } from '@browserbasehq/sdk'

async function testLiveStagehand() {
  const apiKey = process.env.BROWSERBASE_API_KEY!
  const projectId = process.env.BROWSERBASE_PROJECT_ID!

  const bb = new Browserbase({ apiKey })

  console.log('1. Launching Browserbase session via browserbase.launch()...')
  const { Stagehand, browserbase } = await import('@browserbasehq/stagehand')

  const browser = await browserbase.launch({
    apiKey,
    projectId,
    keepAlive: true,
  })
  const sessionId = (browser as any).sessionId || (browser as any).session?.id
  console.log('Browser launched! Session ID:', sessionId)

  console.log('2. Fetching debug / Live View URLs...')
  let debugUrl = ''
  if (sessionId) {
    const debug = await bb.sessions.debug(sessionId)
    debugUrl = debug.debuggerUrl
    console.log('Debugger URL (Live View):', debug.debuggerUrl)
  }

  console.log('3. Creating Stagehand instance...')
  const stagehand = await Stagehand.create({
    browser,
    model: {
      modelName: 'google/gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY,
    },
  })

  console.log('4. Navigating to example.com...')
  const page = (await stagehand.browser.context.activePage()) || (await stagehand.browser.context.newPage())
  await page.goto('https://example.com')
  const title = await page.title()
  const currentUrl = await page.url()
  console.log('Page title:', title, '| URL:', currentUrl)

  console.log('5. Testing Stagehand observe...')
  const observeRes = await stagehand.observe('what links or actions are available on this page?')
  console.log('Observe result:', JSON.stringify(observeRes, null, 2))

  console.log('6. Testing Stagehand extract...')
  const extracted = await stagehand.extract('Extract the main header text and paragraph summary')
  console.log('Extracted result:', JSON.stringify(extracted, null, 2))

  console.log('7. Closing Stagehand...')
  await stagehand.close()
  console.log('Stagehand closed successfully!')
}

testLiveStagehand().catch(console.error)
