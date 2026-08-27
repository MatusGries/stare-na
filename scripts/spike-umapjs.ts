// spike-umapjs.ts — T3 spike from docs/designs/your-galaxy.md
// Questions:
//   1. Does umap-js (random init) produce comparable cluster structure to the
//      Python umap-learn layout in public/data/channels.json?
//   2. Is seeded umap-js deterministic?
//   3. How much does the v1 embedding input (title+desc+bounded enrichment)
//      degrade structure vs full parity (all block titles)?
//   4. How large is the enrichment transition (v1 layout -> full layout)?
// Run: bun scripts/spike-umapjs.ts
import { pipeline } from "@huggingface/transformers";
import { UMAP } from "umap-js";
import raw from "./arena_raw.json";
import published from "../public/data/channels.json";

type RawChannel = {
  id: string; slug: string; title: string; description?: string;
  blocks?: { title?: string; generated_title?: string }[];
};
const channels = raw as RawChannel[];

// ── deterministic RNG (mulberry32) ──────────────────────────────────────────
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ── embedding (mirrors generate_embeddings.py weights) ──────────────────────
const W_TITLE = 2.0, W_DESC = 1.0, W_BLOCKS = 1.5;
const DIM = 384;

const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
const embedTexts = async (texts: string[]) => {
  const out: Float32Array[] = [];
  const BATCH = 64;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const t = await embedder(batch, { pooling: "mean", normalize: true });
    const data = t.data as Float32Array;
    for (let j = 0; j < batch.length; j++) out.push(data.slice(j * DIM, (j + 1) * DIM));
    if (i % 1024 === 0) console.log(`  embedded ${Math.min(i + BATCH, texts.length)}/${texts.length}`);
  }
  return out;
};

const combine = (parts: { emb: Float32Array[]; w: number }[]) => {
  const acc = new Float32Array(DIM);
  let wsum = 0;
  for (const { emb, w } of parts) {
    if (!emb.length) continue;
    const mean = new Float32Array(DIM);
    for (const e of emb) for (let d = 0; d < DIM; d++) mean[d] += e[d];
    for (let d = 0; d < DIM; d++) mean[d] /= emb.length;
    for (let d = 0; d < DIM; d++) acc[d] += w * mean[d];
    wsum += w;
  }
  if (wsum > 0) for (let d = 0; d < DIM; d++) acc[d] /= wsum;
  let n = 0;
  for (let d = 0; d < DIM; d++) n += acc[d] * acc[d];
  n = Math.sqrt(n) || 1;
  for (let d = 0; d < DIM; d++) acc[d] /= n;
  return acc;
};

const blockTitles = (c: RawChannel) =>
  (c.blocks ?? []).map((b) => (b.title || b.generated_title || "").trim()).filter(Boolean);

console.log("[1/5] embedding texts (full parity + v1 variant share the same cache)…");
// Deduplicate: embed every distinct text once.
const textSet = new Map<string, number>();
const need = (t: string) => { if (t && !textSet.has(t)) textSet.set(t, textSet.size); };
for (const c of channels) {
  need((c.title || "").trim());
  need((c.description || "").trim());
  for (const t of blockTitles(c)) need(t);
}
const allTexts = [...textSet.keys()];
console.log(`  distinct texts: ${allTexts.length}`);
const t0 = Date.now();
const allEmb = await embedTexts(allTexts);
console.log(`  embed time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const embOf = (t: string) => allEmb[textSet.get(t)!];

// Full-parity channel embeddings (title + desc + ALL block titles)
const fullEmb = channels.map((c) =>
  combine([
    { emb: (c.title || "").trim() ? [embOf((c.title || "").trim())] : [], w: W_TITLE },
    { emb: (c.description || "").trim() ? [embOf((c.description || "").trim())] : [], w: W_DESC },
    { emb: blockTitles(c).map(embOf), w: W_BLOCKS },
  ])
);

// v1 embeddings: title + desc; block titles (first 50) ONLY for desc-less
// channels, largest-first, capped at 60 channels (the bounded enrichment).
const descless = channels
  .map((c, i) => ({ i, n: (c.blocks ?? []).length, hasDesc: !!(c.description || "").trim() }))
  .filter((x) => !x.hasDesc)
  .sort((a, b) => b.n - a.n)
  .slice(0, 60)
  .map((x) => x.i);
const enriched = new Set(descless);
const v1Emb = channels.map((c, i) =>
  combine([
    { emb: (c.title || "").trim() ? [embOf((c.title || "").trim())] : [], w: W_TITLE },
    { emb: (c.description || "").trim() ? [embOf((c.description || "").trim())] : [], w: W_DESC },
    { emb: enriched.has(i) ? blockTitles(c).slice(0, 50).map(embOf) : [], w: W_BLOCKS },
  ])
);

// ── UMAP (umap_reduce.py params) ─────────────────────────────────────────────
const cosineDist = (a: number[], b: number[]) => {
  let dot = 0;
  for (let d = 0; d < a.length; d++) dot += a[d] * b[d];
  return 1 - dot; // inputs are L2-normalized
};
const runUmap = (emb: Float32Array[], seed: number) => {
  const u = new UMAP({
    nComponents: 3, nNeighbors: 8, minDist: 0.3,
    distanceFn: cosineDist as any, random: mulberry32(seed),
  });
  return u.fit(emb.map((e) => [...e]));
};

console.log("[2/5] umap-js: full-parity layout (seed 42), twice for determinism…");
const t1 = Date.now();
const layoutFullA = runUmap(fullEmb, 42);
console.log(`  umap time: ${((Date.now() - t1) / 1000).toFixed(1)}s`);
const layoutFullB = runUmap(fullEmb, 42);
const deterministic = JSON.stringify(layoutFullA) === JSON.stringify(layoutFullB);

console.log("[3/5] umap-js: v1-input layout (seed 42)…");
const layoutV1 = runUmap(v1Emb, 42);

// ── metrics ──────────────────────────────────────────────────────────────────
const euclid = (a: number[], b: number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const knn = (layout: number[][], k: number) =>
  layout.map((p, i) =>
    layout
      .map((q, j) => ({ j, d: i === j ? Infinity : euclid(p, q) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
      .map((x) => x.j)
  );
const jaccardMean = (A: number[][], B: number[][]) => {
  let s = 0;
  for (let i = 0; i < A.length; i++) {
    const a = new Set(A[i]);
    const inter = B[i].filter((x) => a.has(x)).length;
    s += inter / (A[i].length + B[i].length - inter);
  }
  return s / A.length;
};

console.log("[4/5] metrics…");
// Published Python layout, in the same channel order (match by id)
const pubById = new Map((published as any[]).map((c) => [String(c.id), c]));
const pyLayout = channels.map((c) => {
  const p = pubById.get(String(c.id));
  return p ? [p.x, p.y, p.z] : null;
});
const validIdx = pyLayout.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
const pyL = validIdx.map((i) => pyLayout[i]!) as number[][];
const jsL = validIdx.map((i) => layoutFullA[i]);
const v1L = validIdx.map((i) => layoutV1[i]);

const K = 10;
const pyKnn = knn(pyL, K), jsKnn = knn(jsL, K), v1Knn = knn(v1L, K);

// Baseline: how well does EITHER layout preserve embedding-space neighbors?
const embKnnOf = (emb: Float32Array[]) =>
  validIdx.map((i) =>
    validIdx
      .map((j, jj) => ({ jj, d: i === validIdx[jj] ? Infinity : cosineDist([...emb[i]] as any, [...emb[validIdx[jj]]] as any) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, K)
      .map((x) => x.jj)
  );
const embKnn = embKnnOf(fullEmb);

const results = {
  channels: channels.length,
  matchedToPublished: validIdx.length,
  desclessChannels: channels.filter((c) => !(c.description || "").trim()).length,
  enrichedInV1: enriched.size,
  deterministicSameSeed: deterministic,
  publicInitAPI: "none — initFromRandom/initFromTree are private; step()/initializeFit() ARE public (live epochs OK)",
  knnOverlap_pythonVsUmapjs_full: +jaccardMean(pyKnn, jsKnn).toFixed(3),
  knnOverlap_umapjsFull_vs_embeddingSpace: +jaccardMean(jsKnn, embKnn).toFixed(3),
  knnOverlap_python_vs_embeddingSpace: +jaccardMean(pyKnn, embKnn).toFixed(3),
  knnOverlap_v1_vs_full_umapjs: +jaccardMean(v1Knn, jsKnn).toFixed(3),
  knnOverlap_v1_vs_embeddingSpace: +jaccardMean(v1Knn, embKnn).toFixed(3),
};

console.log("[5/5] RESULTS");
console.log(JSON.stringify(results, null, 2));
