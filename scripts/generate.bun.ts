// generate.bun.ts — A2: regenerate Tereza's channels.json through the SAME
// TypeScript pipeline the browser uses (shared embedText + layout modules),
// replacing the Python scripts. One implementation of the math, everywhere.
//
//   bun scripts/generate.bun.ts            → writes channels.candidate.json
//   bun scripts/generate.bun.ts --commit   → writes public/data/channels.json
//
// Full-parity inputs (title + description + ALL block titles), matching the
// original gift pipeline. Runs on scripts/arena_raw.json.
import { writeFileSync } from "fs";
import { pipeline } from "@huggingface/transformers";
import raw from "./arena_raw.json";
import {
  channelTexts,
  collectDistinctTexts,
  combineChannelEmbedding,
  DIM,
} from "../src/lib/pipeline/embedText";
import { layoutChannels, type LayoutInput } from "../src/lib/pipeline/layout";
import type { RawChannel } from "../src/lib/pipeline/types";

const COMMIT = process.argv.includes("--commit");
const OUT = COMMIT ? "public/data/channels.json" : "public/data/channels.candidate.json";

type FixtureChannel = {
  id: string | number; slug?: string; title?: string; description?: string;
  blockCount?: number; followerCount?: number; thumbnailUrl?: string | null;
  blocks?: { id: number; title?: string; generated_title?: string; kind?: string; imageUrl?: string | null }[];
};
const fixture = raw as FixtureChannel[];

// Full parity: every block title feeds the embedding (weight 1.5, mean-pooled)
const rawChannels: RawChannel[] = fixture.map((c) => ({
  id: String(c.id),
  slug: c.slug,
  title: c.title ?? "",
  description: c.description ?? "",
  blockCount: c.blockCount ?? 0,
  followerCount: c.followerCount ?? 0,
  thumbnailUrl: c.thumbnailUrl ?? null,
  enrichmentTitles: (c.blocks ?? [])
    .map((b) => (b.title || b.generated_title || "").trim())
    .filter(Boolean),
}));

console.log(`[gen] ${rawChannels.length} channels from fixture`);
const texts = collectDistinctTexts(rawChannels);
console.log(`[gen] embedding ${texts.length} distinct texts (q8, ~2 min)…`);

const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
const embOfMap = new Map<string, Float32Array>();
const BATCH = 64;
const t0 = Date.now();
for (let i = 0; i < texts.length; i += BATCH) {
  const batch = texts.slice(i, i + BATCH);
  const t = await embedder(batch, { pooling: "mean", normalize: true });
  const data = t.data as Float32Array;
  for (let j = 0; j < batch.length; j++) embOfMap.set(batch[j], data.slice(j * DIM, (j + 1) * DIM));
  if (i % 2048 === 0) console.log(`  ${Math.min(i + BATCH, texts.length)}/${texts.length}`);
}
console.log(`[gen] embed done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

const inputs: LayoutInput[] = rawChannels.map((c) => ({
  channel: c,
  embedding: combineChannelEmbedding(channelTexts(c), (t) => embOfMap.get(t)!),
}));

console.log("[gen] umap layout…");
const channels = layoutChannels(inputs);

// Root-galaxy extras the browser pipeline skips: pre-baked block previews
// (SidePanel on the root route reads them from the JSON).
const byId = new Map(fixture.map((c) => [String(c.id), c]));
for (const ch of channels) {
  const src = byId.get(ch.id);
  ch.blocks = (src?.blocks ?? []).slice(0, 6).map((b) => ({
    id: b.id,
    title: b.title || b.generated_title || "",
    kind: b.kind || "Block",
    imageUrl: b.imageUrl ?? null,
  }));
}

writeFileSync(OUT, JSON.stringify(channels, null, 2));
console.log(`[gen] wrote ${channels.length} channels -> ${OUT}${COMMIT ? "" : "  (candidate — rerun with --commit to adopt)"}`);
