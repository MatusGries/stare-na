// api/callback.js — Vercel serverless function for Are.na OAuth callback
export default async function handler(req, res) {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.status(200).send(`<h2>Authorization denied: ${error}</h2>`);
    }
    if (!code) {
      return res.status(200).send(`<h2>No code received. Query: ${JSON.stringify(req.query)}</h2>`);
    }

    const CLIENT_ID     = process.env.ARENA_CLIENT_ID;
    const CLIENT_SECRET = process.env.ARENA_CLIENT_SECRET;
    const REDIRECT_URI  = "https://knowledge-nebula-matusgries-projects.vercel.app/api/callback";

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).send("<h2>Missing ARENA_CLIENT_ID or ARENA_CLIENT_SECRET env vars</h2>");
    }

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const resp = await fetch("https://dev.are.na/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (data.access_token) {
      return res.status(200).send(`
        <h2>Got your Are.na access token</h2>
        <pre style="background:#111;color:#0f0;padding:16px;font-size:16px;word-break:break-all">${data.access_token}</pre>
        <p>Run: <code>node scripts/fetch-arena.js --token ABOVE_TOKEN</code></p>
      `);
    } else {
      return res.status(200).send(`<h2>Token exchange failed</h2><pre>${JSON.stringify(data, null, 2)}</pre><p>Status: ${resp.status}</p>`);
    }
  } catch (err) {
    return res.status(200).send(`<h2>Exception</h2><pre>${err.stack}</pre>`);
  }
}
