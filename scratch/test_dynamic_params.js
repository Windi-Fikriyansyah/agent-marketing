const apiKey = process.env.GEMINI_API_KEY;

async function test(tool, prompt, schemaDesc) {
  const p = `Extract precise JSON arguments for the tool based on the user's natural language request.
Tool: "${tool}"
Schema fields: ${schemaDesc}
User request: "${prompt}"

Return ONLY valid JSON matching the schema fields.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: p }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });
  const data = await res.json();
  console.log(`[${tool}] "${prompt}"\n  ->`, data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
}

async function main() {
  await test('gmail', 'sekarang baca 3 teratas inbox email saya', '{ action: "read_latest"|"search", query: string (Gmail search query or label:inbox), maxResults: number }');
  await test('gmail', 'cari email invoice dari tagihan@pln.co.id', '{ action: "read_latest"|"search", query: string, maxResults: number }');
  await test('slack', 'tolong ingatkan tim di #pengumuman besok pagi ada sarapan bareng', '{ channel: string (e.g. #channel), message: string }');
  await test('googledocs', 'bikinin dokumen judulnya SOP Gudang isinya langkah-langkah input barang masuk', '{ title: string, content: string }');
  await test('googlecalendar', 'jadwalkan interview kandidat developer hari jumat jam 10 pagi', '{ summary: string, time: string }');
}

main().catch(console.error);
