const keys = Object.keys(process.env).filter(k => 
  k.includes('KEY') || k.includes('MODEL') || k.includes('OPEN') || k.includes('GEMINI') || k.includes('STAGEHAND') || k.includes('BROWSER')
);
console.log('Available Config Keys:');
for (const k of keys) {
  console.log(`  ${k}: ${process.env[k] ? (process.env[k]?.slice(0, 4) + '...') : 'EMPTY'}`);
}
