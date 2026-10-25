async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY!;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    console.log('Available Gemini Models:');
    for (const m of data.models) {
      if (m.supportedGenerationMethods?.includes('generateContent')) {
        console.log(`- ${m.name}`);
      }
    }
  } else {
    console.log('Error/Response:', JSON.stringify(data));
  }
}
listModels().catch(console.error);
