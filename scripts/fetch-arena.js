// scripts/fetch-arena.js
// Fetches Tereza's Are.na channels + first 50 blocks per channel.
// Output: scripts/arena_raw.json
// Usage: node scripts/fetch-arena.js

import { writeFileSync } from "fs";

const BASE = "https://api.are.na/v2";
const USER = "tereza-slancikova";
const DELAY_MS = 800; // be polite to the API

// Accept --token <value> flag
const tokenFlag = process.argv.indexOf("--token");
const ACCESS_TOKEN = tokenFlag !== -1 ? process.argv[tokenFlag + 1] : null;
if (!ACCESS_TOKEN) {
  console.error("Usage: node scripts/fetch-arena.js --token <your_access_token>");
  console.error("Get a token at: https://dev.are.na/oauth/applications");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PER = 25;
const MAX_RETRIES = 5;

async function get(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "stare.na/1.0 (personal gift project)",
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
        },
      });
      if (res.ok) return res.json();
      if (res.status >= 500 || res.status === 429) {
        // Rate limit (429) needs significantly longer cool-down than 5xx.
        const wait = res.status === 429 ? 15000 * (i + 1) : 1500 * (i + 1);
        console.warn(`    ⚠ ${res.status} on ${url} — retry ${i + 1}/${retries} in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw new Error(`${res.status} ${url}`);
    } catch (e) {
      if (i === retries - 1) throw e;
      const wait = 1500 * (i + 1);
      console.warn(`    ⚠ fetch error on ${url}: ${e.message} — retry ${i + 1}/${retries} in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

async function fetchChannels() {
  console.log(`Fetching OWNED channels for ${USER}…`);
  // Paginate until empty/short page. Do NOT trust data.total — Are.na v2 has been
  // observed to undercount, silently dropping channels.
  const channels = [];
  let page = 1;
  while (true) {
    const data = await get(`${BASE}/users/${USER}/channels?per=${PER}&page=${page}`);
    const batch = data.channels || [];
    if (batch.length === 0) break;
    channels.push(...batch);
    console.log(`  Page ${page}: +${batch.length} (running: ${channels.length}, api total: ${data.total})`);
    // Do NOT break on a short page — Are.na pagination returns short pages mid-sequence.
    // Only an empty batch reliably signals the end.
    page++;
    await sleep(DELAY_MS);
  }
  return channels;
}

async function fetchFollowedChannels() {
  console.log(`Fetching FOLLOWED channels for ${USER}…`);
  const followed = [];
  let page = 1;
  while (true) {
    const data = await get(`${BASE}/users/${USER}/following?per=${PER}&page=${page}`);
    const items = data.following || [];
    if (items.length === 0) break;
    const chans = items.filter((it) => it && (it.class === "Channel" || it.base_class === "Channel"));
    followed.push(...chans);
    console.log(`  Followed page ${page}: +${chans.length} channels (running: ${followed.length})`);
    // Same Are.na pagination quirk: short pages can occur mid-sequence.
    // Only stop on empty.
    page++;
    await sleep(DELAY_MS);
  }
  return followed;
}

async function fetchBlocks(channelSlug, maxBlocks = Infinity) {
  const PER_BLOCK = 50;
  const all = [];
  const first = await get(`${BASE}/channels/${channelSlug}?per=${PER_BLOCK}&page=1`);
  all.push(...(first.contents || []));

  const total = Math.min(first.length || all.length, maxBlocks);
  const totalPages = Math.ceil(total / PER_BLOCK);
  for (let p = 2; p <= totalPages && all.length < maxBlocks; p++) {
    await sleep(DELAY_MS);
    try {
      const page = await get(`${BASE}/channels/${channelSlug}?per=${PER_BLOCK}&page=${p}`);
      all.push(...(page.contents || []));
    } catch (e) {
      console.warn(`    ⚠ page ${p} of ${channelSlug} failed: ${e.message}`);
    }
  }

  return all.slice(0, maxBlocks).map((b) => ({
    id: b.id,
    title: b.title || b.generated_title || "",
    kind: b.class,
    imageUrl: b.image?.display?.url || b.image?.original?.url || null,
  }));
}

// Cap on blocks per FOLLOWED channel — keeps file size + API load sane while
// still giving the embedding enough signal. Owned channels are unlimited.
const FOLLOWED_BLOCK_CAP = 50;

async function main() {
  const owned    = await fetchChannels();
  const followed = await fetchFollowedChannels();

  // Dedupe: if a followed channel is also one she owns (rare), keep the owned record.
  const ownedIds = new Set(owned.map((c) => String(c.id)));
  const followedDedup = followed.filter((c) => !ownedIds.has(String(c.id)));

  const all = [
    ...owned.map((c)         => ({ ...c, ownership: "owned"    })),
    ...followedDedup.map((c) => ({ ...c, ownership: "followed" })),
  ];

  console.log(`\nTotal: ${all.length} channels (${owned.length} owned + ${followedDedup.length} followed)\n`);

  const results = [];
  for (let i = 0; i < all.length; i++) {
    const ch  = all[i];
    const cap = ch.ownership === "owned" ? Infinity : FOLLOWED_BLOCK_CAP;
    console.log(`  [${i + 1}/${all.length}] (${ch.ownership}) ${ch.title} (${ch.slug})`);
    await sleep(DELAY_MS);

    let blocks = [];
    try {
      blocks = await fetchBlocks(ch.slug, cap);
      console.log(`     → ${blocks.length} blocks`);
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
      ownership: ch.ownership,
      ownerSlug: ch.user?.slug || null,
      ownerName: ch.user?.full_name || ch.user?.username || null,
      blocks,
    });
  }

  writeFileSync("scripts/arena_raw.json", JSON.stringify(results, null, 2));
  console.log(`\nDone. Wrote ${results.length} channels to scripts/arena_raw.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
