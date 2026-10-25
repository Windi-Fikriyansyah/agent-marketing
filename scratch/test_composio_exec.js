async function test() {
  const { Composio } = await import('@composio/core');
  const comp = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  const session = await comp.create('test_user_verify');
  
  let toolRes;
  try {
    toolRes = await session.execute('GMAIL_FETCH_EMAILS', { query: 'label:inbox', max_results: 3 });
  } catch (err) {
    const isNoConnection = 
      err.error?.error?.code === 4302 ||
      err.message?.includes('No active connection found');

    if (isNoConnection) {
      console.log('Caught NoActiveConnection! Requesting real Connect Link...');
      const auth = await session.authorize('gmail');
      console.log('Generated Connect Link:', auth.redirectUrl);
      toolRes = {
        status: 'connection_required',
        toolkit: 'gmail',
        message: 'Akun Gmail belum terhubung. Silakan hubungkan akun Gmail Anda.',
        connectLink: auth.redirectUrl,
        connectionId: auth.id
      };
    } else {
      throw err;
    }
  }

  console.log('Final tool result:', toolRes);
}
test();
