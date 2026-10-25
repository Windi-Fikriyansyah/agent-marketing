async function testDuckDuckGo() {
  const q = 'artificial intelligence news';
  try {
    const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      }
    });
    console.log('DuckDuckGo status:', res.status);
    const html = await res.text();
    // Look for results in html
    const results = [];
    const linkRegex = /<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = linkRegex.exec(html)) !== null && results.length < 5) {
      const rawUrl = m[1].trim();
      const actualUrl = rawUrl.startsWith('//duckduckgo.com/l/?uddg=') 
        ? decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0])
        : rawUrl;
      results.push({ url: actualUrl, text: m[2].replace(/<[^>]+>/g, '').trim() });
    }
    console.log('Results found:', results.length, results.slice(0, 2));
  } catch (e) {
    console.error('DDG Error:', e);
  }
}
testDuckDuckGo();
