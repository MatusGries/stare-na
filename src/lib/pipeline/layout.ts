// layout.ts — seeded UMAP + the verbatim port of scripts/umap_reduce.py
// post-processing: axis scaling to [-8, 8], top-3 cosine neighbors,
// size/emissiveIntensity formulas, Channel[] assembly.
//
//   embeddings (384d, unit) ──UMAP(seed)──> 3d coords ──scale──> [-8,8]³
//        │                                                          │
//        └──cosine sim──> top-3 neighbors                           │
//   blockCount ──> size      followerCount ──> emissive             ▼
//                                    └──────────────────────> Channel[]
//
// Accounts under MIN_UMAP_CHANNELS get a seeded Fibonacci-sphere layout
// instead (UMAP output degenerates below ~30 points) — the semantic
// `neighbors` lines still carry the meaning there.
import { UMAP } from "umap-js";
import type { Channel } from "@/types/channel";
import type { RawChannel } from "./types";

export const COORD_SCALE = 8.0;
export const N_NEIGHBORS_OUT = 3;
export const MIN_UMAP_CHANNELS = 30;
export const UMAP_SEED = 42;

/** mulberry32 — tiny seeded RNG; same seed ⇒ identical layout, every visit. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const cosineDist = (a: number[], b: number[]) => {
  let dot = 0;
  for (let d = 0; d < a.length; d++) dot += a[d] * b[d];
  return 1 - dot; // unit vectors
};

/** umap_reduce.py scale_axis: min/max → [-COORD_SCALE, COORD_SCALE]. */
export const scaleAxis = (values: number[]): number[] => {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  if (mx === mn) return values.map(() => 0);
  return values.map((v) => ((v - mn) / (mx - mn)) * 2 * COORD_SCALE - COORD_SCALE);
};

/** umap_reduce.py compute_size: 0.8 + log10(blockCount+1)*0.6 ≈ 0.8–2.6 */
export const computeSize = (blockCount: number): number =>
  Math.round((0.8 + Math.log10(blockCount + 1) * 0.6) * 1000) / 1000;

/** umap_reduce.py compute_emissive: 1.0 + min(followerCount/20, 2.0) → 1.0–3.0 */
export const computeEmissive = (followerCount: number): number =>
  Math.round((1.0 + Math.min(followerCount / 20.0, 2.0)) * 1000) / 1000;

/** Top-K cosine neighbors per channel on the ORIGINAL embeddings. */
export const topNeighbors = (
  embeddings: Float32Array[],
  ids: string[],
  k = N_NEIGHBORS_OUT
): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (let i = 0; i < embeddings.length; i++) {
    const sims: { j: number; s: number }[] = [];
    for (let j = 0; j < embeddings.length; j++) {
      if (j === i) continue;
      let dot = 0;
      for (let d = 0; d < embeddings[i].length; d++) dot += embeddings[i][d] * embeddings[j][d];
      sims.push({ j, s: dot });
    }
    sims.sort((a, b) => b.s - a.s);
    map.set(ids[i], sims.slice(0, k).map((x) => ids[x.j]));
  }
  return map;
};

/** Seeded Fibonacci sphere for the <30-channel fallback. */
export const fibonacciSphere = (n: number, radius = COORD_SCALE * 0.75): number[][] => {
  const pts: number[][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push([Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius]);
  }
  return pts;
};

export interface LayoutInput {
  channel: RawChannel;
  /** null ⇒ no embeddable text (empty-title degenerate case) */
  embedding: Float32Array | null;
}

/** Per-frame normalized snapshot: pure shape change at constant scale. */
const scaleFrame = (raw: number[][]): number[][] => {
  const xs = scaleAxis(raw.map((p) => p[0]));
  const ys = scaleAxis(raw.map((p) => p[1]));
  const zs = scaleAxis(raw.map((p) => p[2]));
  return raw.map((_, i) => [xs[i], ys[i], zs[i]]);
};

/** Full layout + post-processing: RawChannel[] + embeddings → Channel[]. */
export const layoutChannels = (inputs: LayoutInput[], seed = UMAP_SEED): Channel[] =>
  layoutChannelsAnimated(inputs, seed, 0).channels;

export interface AnimatedLayout {
  channels: Channel[];
  /** UMAP optimization snapshots (positions aligned to `channels` order, in
   *  [-8,8]³ layout space). Empty when frameCount=0 or the fallback ran. */
  frames: number[][][];
}

/**
 * Same layout as layoutChannels, but records `frameCount` evenly spaced
 * snapshots of the UMAP optimization — the raw material of the milestone-B
 * live condensation. step()-driven optimization with the same seeded RNG is
 * identical to fit() (unit-tested), so animated and plain layouts agree.
 */
export const layoutChannelsAnimated = (
  inputs: LayoutInput[],
  seed = UMAP_SEED,
  frameCount = 48
): AnimatedLayout => {
  const embedded = inputs.filter((i) => i.embedding !== null);
  const unembedded = inputs.filter((i) => i.embedding === null);

  const embs = embedded.map((i) => i.embedding!) ;
  const ids = embedded.map((i) => String(i.channel.id));

  let coords: number[][];
  const rawFrames: number[][][] = [];
  if (embedded.length >= MIN_UMAP_CHANNELS) {
    const umap = new UMAP({
      nComponents: 3,
      nNeighbors: 8,
      minDist: 0.3,
      distanceFn: cosineDist,
      random: mulberry32(seed),
    });
    const data = embs.map((e) => [...e]);
    const nEpochs = umap.initializeFit(data);
    const every = frameCount > 0 ? Math.max(1, Math.floor(nEpochs / frameCount)) : Infinity;
    for (let epoch = 0; epoch < nEpochs; epoch++) {
      umap.step();
      if (frameCount > 0 && (epoch % every === 0 || epoch === nEpochs - 1)) {
        rawFrames.push(scaleFrame(umap.getEmbedding().map((p) => [...p])));
      }
    }
    coords = scaleFrame(umap.getEmbedding());
  } else {
    coords = fibonacciSphere(embedded.length);
  }

  const neighborMap = topNeighbors(embs, ids);

  const round4 = (v: number) => Math.round(v * 10000) / 10000;
  const toChannel = (c: RawChannel, xyz: number[], neighbors: string[]): Channel => ({
    id: String(c.id),
    slug: c.slug || String(c.id),
    title: (c.title ?? "").trim(),
    description: (c.description ?? "").trim(),
    x: round4(xyz[0]),
    y: round4(xyz[1]),
    z: round4(xyz[2]),
    size: computeSize(c.blockCount ?? 0),
    color: "#ffffff",
    emissiveIntensity: computeEmissive(c.followerCount ?? 0),
    blockCount: c.blockCount ?? 0,
    followerCount: c.followerCount ?? 0,
    neighbors,
    thumbnailUrl: c.thumbnailUrl ?? null,
    // blocks stay empty — SidePanel lazy-loads previews on star click
  });

  const out = embedded.map((inp, i) =>
    toChannel(inp.channel, coords[i], neighborMap.get(ids[i]) ?? [])
  );

  // Empty-title degenerates: dim, on an outer shell, no neighbors
  const shell = fibonacciSphere(unembedded.length || 1, COORD_SCALE * 1.05);
  unembedded.forEach((inp, i) => {
    const ch = toChannel(inp.channel, shell[i], []);
    ch.size = 0.8; // dust
    out.push(ch);
  });

  // Frames aligned to the OUTPUT order: animated embedded positions, then the
  // static shell positions appended (degenerates don't participate in UMAP).
  const shellTail = unembedded.map((_, i) => shell[i]);
  const frames = rawFrames.map((f) => [...f, ...shellTail]);

  return { channels: out, frames };
};
