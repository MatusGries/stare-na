// scripts/exchange-code.js
// Exchanges an Are.na authorization code for an access token locally.
// Usage:
//   1. Run: node scripts/get-token.js  (opens browser)
//   2. Approve. You'll land on the Vercel callback page (which may error).
//   3. Look at the URL bar — copy the value of `?code=XXX` from it.
//   4. Run: node scripts/exchange-code.js --code PASTED_CODE

const args = process.argv;
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const CLIENT_ID     = get("--client-id")     || "mknceyzd7FF7RDk8PVAtBezMGTY-ssVcnq2hLxLdMlI";
const CLIENT_SECRET = get("--client-secret") || "aAMxbfIRPd3mFVDZpanSrFRwk-XEmZyhKjprCIfiYfE";
const REDIRECT_URI  = "https://knowledge-nebula-matusgries-projects.vercel.app/api/callback";
const CODE          = get("--code");

if (!CODE) {
  console.error("Usage: node scripts/exchange-code.js --code <CODE_FROM_URL>");
  process.exit(1);
}

const qs = new URLSearchParams({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  code: CODE,
  redirect_uri: REDIRECT_URI,
  grant_type: "authorization_code",
}).toString();

const URL = `https://api.are.na/v3/oauth/token?${qs}`;

const resp = await fetch(URL, { method: "POST" });
const text = await resp.text();
console.log("HTTP", resp.status);
console.log(text);
