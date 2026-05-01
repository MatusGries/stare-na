// scripts/get-token-local.js
// Local OAuth server — no Vercel needed.
// 1. Add http://localhost:8787/callback to your Are.na app at https://dev.are.na/oauth/applications
// 2. node scripts/get-token-local.js
// 3. Approve in browser → token printed here + saved to scripts/.arena-token

import { createServer } from "http";
import { exec } from "child_process";
import { writeFileSync } from "fs";

const CLIENT_ID     = "swASIt-5u36zdwVkimmm89Sv4dpC5c1Q6jlTg5tS1Zc";
const CLIENT_SECRET = "dNkFhPJ409SpbY4XQwtjlRPFjZirahlG53xVAiyulsE";
const PORT          = 8787;
const REDIRECT_URI  = `http://localhost:${PORT}/callback`;

const authURL =
  `https://dev.are.na/oauth/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=write`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") { res.end("ok"); return; }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.end(`<h2>Error: ${error || "no code"}</h2>`);
    server.close();
    return;
  }

  try {
    const resp = await fetch("https://dev.are.na/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }).toString(),
    });
    const data = await resp.json();

    if (data.access_token) {
      writeFileSync("scripts/.arena_token", data.access_token);
      console.log("\n✓ Token saved to scripts/.arena_token");
      console.log("\nToken:", data.access_token);
      console.log("\nNext: node scripts/fetch-arena.js --token", data.access_token);
      res.end(`<h2>Token saved!</h2><pre>${data.access_token}</pre><p>You can close this tab.</p>`);
    } else {
      console.error("Token exchange failed:", data);
      res.end(`<h2>Failed</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
    }
  } catch (e) {
    console.error(e);
    res.end(`<h2>Exception</h2><pre>${e.stack}</pre>`);
  }
  server.close();
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}/callback`);
  console.log("Opening browser for Are.na authorization…\n");
  const open = process.platform === "win32" ? `start "" "${authURL}"` : `open "${authURL}"`;
  exec(open);
  console.log("If browser didn't open, visit:");
  console.log(" ", authURL, "\n");
});
