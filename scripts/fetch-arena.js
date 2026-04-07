// scripts/fetch-arena.js
// Fetches Tereza's Are.na channels + first 50 blocks per channel.
// Output: scripts/arena_raw.json
// Usage: node scripts/fetch-arena.js

import { writeFileSync } from "fs";

const BASE = "https://api.are.na/v2";
const USER = "tereza-slancikova";
const DELAY_MS = 350; // be polite to the API

// Accept --token <value> flag
const tokenFlag = process.argv.indexOf("--token");
const ACCESS_TOKEN = tokenFlag !== -1 ? process.argv[tokenFlag + 1] : null;
if (!ACCESS_TOKEN) {
  console.error("Usage: node scripts/fetch-arena.js --token <your_access_token>");
  console.error("Get a token at: https://dev.are.na/oauth/applications");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "knowledge-nebula/1.0 (personal gift project)",
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchChannels() {
  console.log(`Fetching channels for ${USER}…`);
  const data = await get(`${BASE}/users/${USER}/channels?per=100&page=1`);
  const channels = data.channels || [];
  console.log(`  Got ${channels.length} channels (total: ${data.total})`);

  // Fetch extra pages if needed
  const totalPages = Math.ceil(data.total / 100);
  for (let p = 2; p <= totalPages; p++) {
    await sleep(DELAY_MS);
    const page = await get(`${BASE}/users/${USER}/channels?per=100&page=${p}`);
    channels.push(...(page.channels || []));
  }

  return channels;
}

async function fetchBlocks(channelSlug) {
  const data = await get(`${BASE}/channels/${channelSlug}?per=50&page=1`);
  const contents = data.contents || [];
  return contents.slice(0, 50).map((b) => ({
    id: b.id,
    title: b.title || b.generated_title || "",
    kind: b.class,
    imageUrl: b.image?.display?.url || b.image?.original?.url || null,
  }));
}

async function main() {
  const rawChannels = await fetchChannels();

  const results = [];
  for (let i = 0; i < rawChannels.length; i++) {
    const ch = rawChannels[i];
    console.log(`  [${i + 1}/${rawChannels.length}] ${ch.title} (${ch.slug})`);
    await sleep(DELAY_MS);

    let blocks = [];
    try {
      blocks = await fetchBlocks(ch.slug);
    } catch (e) {
      console.warn(`    ⚠ blocks failed: ${e.message}`);
    }

    results.push({
      id: String(ch.id),
      slug: ch.slug,
      title: ch.title,
      description: ch.metadata?.description || ch.description || "",
      blockCount: ch.length || 0,
      followerCount: ch.follower_count || 0,
      thumbnailUrl: ch.image?.display?.url || null,
      blocks,
    });
  }

  writeFileSync("scripts/arena_raw.json", JSON.stringify(results, null, 2));
  console.log(`\nDone. Wrote ${results.length} channels to scripts/arena_raw.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
