async function main() {
  const { Stagehand } = await import('@browserbasehq/stagehand');
  console.log('Stagehand properties:', Object.getOwnPropertyNames(Stagehand));
}
main().catch(console.error);
