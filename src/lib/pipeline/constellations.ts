// constellations.ts — post-reveal constellation summary (milestone B3).
// Seeded k-means over the 3D layout positions (clusters as the viewer sees
// them), named by TF-IDF over channel-title tokens across clusters — words
// every cluster shares ("research", "stuff") cancel out on their own.
// Pure function over Channel[]: works for fresh, cached, and partial layouts.
import type { Channel } from "@/types/channel";
import { mulberry32 } from "./layout";

export interface Constellation {
  /** 1-2 distinctive lowercase tokens, e.g. "kitchens · rituals" */
  name: string;
  /** Channel ids in the cluster, largest (blockCount) first */
  channelIds: string[];
  /** The cluster's flagship channel — clicking the name flies here */
  anchorId: string;
  count: number;
}

const STOPWORDS = new Set([
  "the","and","for","with","from","this","that","into","are","was","were","its",
  "not","you","your","our","out","all","one","two","new","old","very","more",
  "some","other","than","them","then","there","here","what","when","how","why",
  "about","also","just","like","via","per","etc","ish","non","pre","post",
]);

const tokenize = (title: string): string[] =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));

/** Seeded k-means (k-means++ style init) on channel positions. */
const kmeans = (points: number[][], k: number, seed: number): number[] => {
  const rand = mulberry32(seed);
  const n = points.length;
  const dist2 = (a: number[], b: number[]) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  // k-means++ init: first centroid seeded-random, rest weighted by distance²
  const centroids: number[][] = [points[Math.floor(rand() * n)].slice()];
  while (centroids.length < k) {
    const d = points.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const total = d.reduce((s, v) => s + v, 0) || 1;
    let r = rand() * total;
    let idx = 0;
    while (r > d[idx] && idx < n - 1) r -= d[idx++];
    centroids.push(points[idx].slice());
  }

  const assign = new Array<number>(n).fill(0);
  for (let iter = 0; iter < 24; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(points[i], centroids[c]);
        if (d < bd) { bd = d; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; moved = true; }
    }
    if (!moved) break;
    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => assign[i] === c);
      if (!members.length) continue;
      centroids[c] = [0, 1, 2].map(
        (d) => members.reduce((s, p) => s + p[d], 0) / members.length
      );
    }
  }
  return assign;
};

/**
 * Top-N constellations for a laid-out galaxy. Deterministic (seeded), cheap
 * (O(n·k·iters)), and honest: clusters whose titles yield no distinctive
 * tokens are skipped rather than given a made-up name.
 */
export const nameConstellations = (
  channels: Channel[],
  topN = 3,
  seed = 42
): Constellation[] => {
  if (channels.length < 12) return [];
  const k = Math.max(3, Math.min(7, Math.round(Math.sqrt(channels.length / 8)) + 2));
  const assign = kmeans(channels.map((c) => [c.x, c.y, c.z]), k, seed);

  // token counts per cluster + document frequency across clusters
  const clusterTokens: Map<string, number>[] = Array.from({ length: k }, () => new Map());
  for (let i = 0; i < channels.length; i++) {
    const m = clusterTokens[assign[i]];
    for (const t of new Set(tokenize(channels[i].title))) m.set(t, (m.get(t) ?? 0) + 1);
  }
  const df = new Map<string, number>();
  for (const m of clusterTokens)
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);

  const clusters = Array.from({ length: k }, (_, c) => {
    const members = channels.filter((_, i) => assign[i] === c);
    const scored = [...clusterTokens[c].entries()]
      .map(([t, tf]) => ({ t, score: tf * Math.log(1 + k / df.get(t)!) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const nameTokens = scored.slice(0, 2).filter((x, i) => i === 0 || x.score > scored[0].score * 0.4);
    const sorted = [...members].sort((a, b) => (b.blockCount ?? 0) - (a.blockCount ?? 0));
    return {
      name: nameTokens.map((x) => x.t).join(" · "),
      channelIds: sorted.map((m) => m.id),
      anchorId: sorted[0]?.id ?? "",
      count: members.length,
    };
  });

  return clusters
    .filter((c) => c.name && c.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
};
