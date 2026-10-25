async function testConnect() {
  const apiKey = process.env.BROWSERBASE_API_KEY!;
  const projectId = process.env.BROWSERBASE_PROJECT_ID!;
  const { Stagehand, browserbase } = await import('@browserbasehq/stagehand');

  console.log('1. Launching session...');
  const browser = await browserbase.launch({
    apiKey,
    projectId,
    keepAlive: true,
  });
  const sessionId = (browser as any).sessionId || (browser as any).session?.id;
  console.log('Launched session ID:', sessionId);

  console.log('2. Creating first Stagehand instance...');
  const s1 = await Stagehand.create({
    browser,
    model: {
      modelName: 'google/gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY,
    },
  });
  const page1 = (await s1.browser.context.activePage()) || (await s1.browser.context.newPage());
  await page1.goto('https://example.com');
  console.log('Page 1 title:', await page1.title());

  console.log('3. Now connecting to the same session via browserbase.connect...');
  const connectedBrowser = await browserbase.connect({
    apiKey,
    sessionId,
  });
  console.log('Connected to existing session!');

  const s2 = await Stagehand.create({
    browser: connectedBrowser,
    model: {
      modelName: 'google/gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY,
    },
  });
  const page2 = (await s2.browser.context.activePage()) || (await s2.browser.context.newPage());
  console.log('Page 2 current URL:', await page2.url());

  console.log('Closing session...');
  await s2.close();
  console.log('Session closed successfully!');
}

testConnect().catch(console.error);
