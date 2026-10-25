import { Browserbase } from '@browserbasehq/sdk'

async function cleanup() {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! })
  const sessions = await bb.sessions.list({ status: 'RUNNING' })
  console.log('Running sessions count:', sessions.length)
  for (const s of sessions) {
    console.log('Releasing session:', s.id)
    try {
      await bb.sessions.update(s.id, {
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        status: 'REQUEST_RELEASE',
      })
      console.log('Session released:', s.id)
    } catch (e: any) {
      console.error('Failed to release:', s.id, e.message)
    }
  }
}

cleanup().catch(console.error)
