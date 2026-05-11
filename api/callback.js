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

    // Are.na's documented format: POST with params as URL query string.
    // We try that first, then fall back to form-body if it fails.
    const params = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    };
    const qs = new URLSearchParams(params).toString();

    const attempts = [];

    const TOKEN_URL = "https://dev.are.na/oauth/token";

    // Attempt 1: POST with query string
    let resp = await fetch(`${TOKEN_URL}?${qs}`, { method: "POST" });
    let text = await resp.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    attempts.push({ method: "POST query-string", status: resp.status, body: data });

    // Attempt 2: POST with form body
    if (!data.access_token) {
      resp = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: qs,
      });
      text = await resp.text();
      try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
      attempts.push({ method: "POST form-body", status: resp.status, body: data });
    }

    // Attempt 3: GET with query string
    if (!data.access_token) {
      resp = await fetch(`${TOKEN_URL}?${qs}`, { method: "GET" });
      text = await resp.text();
      try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
      attempts.push({ method: "GET query-string", status: resp.status, body: data });
    }

    if (data.access_token) {
      return res.status(200).send(`
        <h2>Got your Are.na access token</h2>
        <pre style="background:#111;color:#0f0;padding:16px;font-size:16px;word-break:break-all">${data.access_token}</pre>
        <p>Run: <code>node scripts/fetch-arena.js --token ABOVE_TOKEN</code></p>
      `);
    }

    const debug = {
      env: {
        client_id_len: CLIENT_ID.length,
        client_secret_len: CLIENT_SECRET.length,
        client_id_preview: CLIENT_ID.slice(0, 6) + "…",
      },
      redirect_uri: REDIRECT_URI,
      code_preview: String(code).slice(0, 8) + "…",
      attempts,
    };
    return res.status(200).send(`<h2>Token exchange failed</h2><pre style="background:#111;color:#fff;padding:16px;font-size:13px;white-space:pre-wrap">${JSON.stringify(debug, null, 2)}</pre>`);
  } catch (err) {
    return res.status(200).send(`<h2>Exception</h2><pre>${err.stack}</pre>`);
  }
}
