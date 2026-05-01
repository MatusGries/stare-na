// scripts/get-token.js
// Opens browser to Are.na OAuth authorize page.
// Vercel handles the callback and displays the token.
// Usage: node scripts/get-token.js --client-id YOUR_CLIENT_ID

import { exec } from "child_process";

const args = process.argv;
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const CLIENT_ID    = get("--client-id") || "mknceyzd7FF7RDk8PVAtBezMGTY-ssVcnq2hLxLdMlI";
const REDIRECT_URI = "https://knowledge-nebula-matusgries-projects.vercel.app/api/callback";

const authURL =
  `https://dev.are.na/oauth/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code`;

console.log("Opening browser for authorization…");
console.log("If it doesn't open, visit:\n ", authURL, "\n");
console.log("After approving, copy the token shown on the page and run:");
console.log("  node scripts/fetch-arena.js --token YOUR_TOKEN");

const open = process.platform === "win32" ? `start "" "${authURL}"` : `open "${authURL}"`;
exec(open);
