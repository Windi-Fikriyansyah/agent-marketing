import { Browserbase } from '@browserbasehq/sdk'

async function testSDK() {
  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY,
  })

  console.log('Testing Browserbase SDK connection...')
  const sessions = await bb.sessions.list({ status: 'RUNNING' })
  console.log('Running sessions count:', sessions?.length ?? 0)

  console.log('Importing Stagehand dynamically...')
  const { Stagehand, browserbase } = await import('@browserbasehq/stagehand')
  console.log('Stagehand loaded successfully! typeof Stagehand:', typeof Stagehand)
  console.log('browserbase factory typeof:', typeof browserbase)
}

testSDK().catch(console.error)
