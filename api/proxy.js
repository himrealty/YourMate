export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) {
    return res.status(500).json({
      status: 'error',
      message: 'GAS_URL environment variable not set. Add it in Vercel dashboard → Settings → Environment Variables.'
    });
  }

  try {
    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      redirect: 'follow', // GAS sometimes redirects
    });

    if (!gasRes.ok) {
      throw new Error(`Google Apps Script returned HTTP ${gasRes.status}`);
    }

    const data = await gasRes.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(502).json({
      status: 'error',
      message: `Proxy failed: ${err.message}`
    });
  }
}
