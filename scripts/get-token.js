// scripts/get-token.js
// Step 1 of the 2-step Are.na OAuth flow.
// Opens the browser to Are.na's authorize page. After you approve, Are.na
// redirects to the Vercel callback URL with a `?code=XXX` query string.
// That callback may fail (env-var drift) — that's fine.
// Just copy the `code` value from the browser's URL bar and run:
//   node scripts/exchange-code.js --code <PASTED_CODE>
//
// Usage: node scripts/get-token.js

import { exec } from "child_process";

const args = process.argv;
const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const CLIENT_ID    = get("--client-id") || "mknceyzd7FF7RDk8PVAtBezMGTY-ssVcnq2hLxLdMlI";
const REDIRECT_URI = "https://knowledge-nebula-matusgries-projects.vercel.app/api/callback";

const authURL =
  `https://www.are.na/oauth/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=write`;

console.log("Opening browser for authorization…");
console.log("If it doesn't open, visit:\n  " + authURL + "\n");
console.log("After approving, look at the URL bar in your browser.");
console.log("It will be: https://…/api/callback?code=AAAAA…");
console.log("Copy the value of `code=` and run:");
console.log("  node scripts/exchange-code.js --code <PASTED_CODE>\n");

const open = process.platform === "win32" ? `start "" "${authURL}"`
            : process.platform === "darwin" ? `open "${authURL}"`
            : `xdg-open "${authURL}"`;
exec(open);
