import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'success'

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Otorisasi Composio Berhasil</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
    }
    .card {
      background: white;
      border: 1px solid #e2e8f0;
      padding: 32px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      max-width: 400px;
    }
    .icon {
      width: 48px;
      height: 48px;
      background: #ecfdf5;
      color: #059669;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 16px;
    }
    h2 { margin: 0 0 8px 0; font-size: 18px; }
    p { margin: 0 0 20px 0; color: #64748b; font-size: 13px; line-height: 1.5; }
    .btn {
      display: inline-block;
      padding: 8px 16px;
      background: #2563eb;
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h2>Koneksi Berhasil!</h2>
    <p>Akun Anda telah berhasil dihubungkan ke Composio. Jendela ini akan tertutup otomatis...</p>
    <a href="javascript:window.close()" class="btn">Tutup Jendela</a>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'COMPOSIO_OAUTH_SUCCESS', status: '${status}' }, '*');
        setTimeout(function() {
          window.close();
        }, 1200);
      }
    } catch (e) {
      console.warn(e);
    }
  </script>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
