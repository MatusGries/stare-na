// embedText.ts — text assembly + weighted combination for channel embeddings.
// Ports scripts/generate_embeddings.py exactly (weights 2.0 / 1.0 / 1.5,
// presence-aware weight sum, L2 normalization). This module is the ONE
// implementation of this math — the worker and the A2 bun script both use it.
import type { RawChannel } from "./types";

export const W_TITLE = 2.0;
export const W_DESC = 1.0;
export const W_BLOCKS = 1.5;
export const DIM = 384;

export interface ChannelTexts {
  title: string;
  description: string;
  blockTitles: string[];
}

/** Trimmed text inputs for one channel. Empty strings mean "component absent". */
export const channelTexts = (c: RawChannel): ChannelTexts => ({
  title: (c.title ?? "").trim(),
  description: (c.description ?? "").trim(),
  blockTitles: (c.enrichmentTitles ?? []).map((t) => t.trim()).filter(Boolean),
});

/** Every distinct text the pipeline must embed, deduplicated. */
export const collectDistinctTexts = (channels: RawChannel[]): string[] => {
  const set = new Set<string>();
  for (const c of channels) {
    const t = channelTexts(c);
    if (t.title) set.add(t.title);
    if (t.description) set.add(t.description);
    for (const b of t.blockTitles) set.add(b);
  }
  return [...set];
};

const meanOf = (embs: Float32Array[]): Float32Array | null => {
  if (!embs.length) return null;
  const m = new Float32Array(DIM);
  for (const e of embs) for (let d = 0; d < DIM; d++) m[d] += e[d];
  for (let d = 0; d < DIM; d++) m[d] /= embs.length;
  return m;
};

/**
 * Weighted combine of per-component means, mirroring the Python pipeline:
 * only components that are PRESENT contribute their weight to the divisor,
 * so a description-less channel isn't diluted. Result is L2-normalized
 * (cosine similarity == dot product downstream). Returns null when the
 * channel has no embeddable text at all (empty-title degenerate case).
 */
export const combineChannelEmbedding = (
  texts: ChannelTexts,
  embOf: (text: string) => Float32Array
): Float32Array | null => {
  const parts: { mean: Float32Array; w: number }[] = [];
  const titleMean = meanOf(texts.title ? [embOf(texts.title)] : []);
  if (titleMean) parts.push({ mean: titleMean, w: W_TITLE });
  const descMean = meanOf(texts.description ? [embOf(texts.description)] : []);
  if (descMean) parts.push({ mean: descMean, w: W_DESC });
  const blockMean = meanOf(texts.blockTitles.map(embOf));
  if (blockMean) parts.push({ mean: blockMean, w: W_BLOCKS });

  if (!parts.length) return null;

  const acc = new Float32Array(DIM);
  let wsum = 0;
  for (const { mean, w } of parts) {
    for (let d = 0; d < DIM; d++) acc[d] += w * mean[d];
    wsum += w;
  }
  for (let d = 0; d < DIM; d++) acc[d] /= wsum;

  let n = 0;
  for (let d = 0; d < DIM; d++) n += acc[d] * acc[d];
  n = Math.sqrt(n);
  if (n < 1e-12) return null;
  for (let d = 0; d < DIM; d++) acc[d] /= n;
  return acc;
};
