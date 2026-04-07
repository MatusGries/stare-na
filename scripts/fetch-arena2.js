// scripts/fetch-arena2.js — uses are.na npm package
import Arena from "are.na";
import { writeFileSync } from "fs";

const tokenFlag = process.argv.indexOf("--token");
const token = tokenFlag !== -1 ? process.argv[tokenFlag + 1] : null;
if (!token) { console.error("Usage: node scripts/fetch-arena2.js --token TOKEN"); process.exit(1); }

const arena = new Arena({ accessToken: token });
const USER = "tereza-slancikova";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("Fetching channels…");
  const data = await arena.user(USER).channels({ per: 100, page: 1 });
  console.log("Total:", data.length, "channels");
  writeFileSync("scripts/arena_raw.json", JSON.stringify(data, null, 2));
  console.log("Wrote scripts/arena_raw.json");
}

main().catch(e => { console.error(e); process.exit(1); });
