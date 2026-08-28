// Unit tests for the galaxy pipeline (design doc: Testing section).
import { describe, it, expect } from "vitest";
import {
  channelTexts,
  collectDistinctTexts,
  combineChannelEmbedding,
  DIM,
  W_TITLE,
  W_DESC,
} from "@/lib/pipeline/embedText";
import {
  layoutChannels,
  layoutChannelsAnimated,
  computeSize,
  computeEmissive,
  scaleAxis,
  fibonacciSphere,
  topNeighbors,
  COORD_SCALE,
  MIN_UMAP_CHANNELS,
} from "@/lib/pipeline/layout";
import type { RawChannel } from "@/lib/pipeline/types";

// Deterministic fake embeddings: unit vector seeded from the text hash
const fakeEmb = (text: string): Float32Array => {
  const v = new Float32Array(DIM);
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  for (let d = 0; d < DIM; d++) {
    h = (h * 1103515245 + 12345) | 0;
    v[d] = ((h >>> 16) & 0xffff) / 0xffff - 0.5;
  }
  let n = 0;
  for (let d = 0; d < DIM; d++) n += v[d] * v[d];
  n = Math.sqrt(n);
  for (let d = 0; d < DIM; d++) v[d] /= n;
  return v;
};

describe("embedText", () => {
  it("collects distinct texts across title/description/enrichment", () => {
    const chans: RawChannel[] = [
      { id: 1, title: "food", description: "", enrichmentTitles: ["soup", "soup", "bread"] },
      { id: 2, title: "food", description: "eating well" },
    ];
    expect(collectDistinctTexts(chans).sort()).toEqual(["bread", "eating well", "food", "soup"]);
  });

  it("weights title 2:1 over description (python parity)", () => {
    const t = fakeEmb("title-text");
    const d = fakeEmb("desc-text");
    const embOf = (s: string) => (s === "t" ? t : d);
    const combined = combineChannelEmbedding(
      { title: "t", description: "d", blockTitles: [] },
      embOf
    )!;
    // expected: normalize((2*t + 1*d) / 3)
    const raw = new Float32Array(DIM);
    for (let i = 0; i < DIM; i++) raw[i] = (W_TITLE * t[i] + W_DESC * d[i]) / (W_TITLE + W_DESC);
    let n = 0;
    for (let i = 0; i < DIM; i++) n += raw[i] * raw[i];
    n = Math.sqrt(n);
    for (let i = 0; i < DIM; i++) expect(combined[i]).toBeCloseTo(raw[i] / n, 5);
  });

  it("absent components do not dilute (presence-aware weight sum)", () => {
    const t = fakeEmb("only-title");
    const combined = combineChannelEmbedding(
      { title: "x", description: "", blockTitles: [] },
      () => t
    )!;
    for (let i = 0; i < DIM; i++) expect(combined[i]).toBeCloseTo(t[i], 5);
  });

  it("returns null for a channel with no embeddable text", () => {
    expect(
      combineChannelEmbedding({ title: "", description: "", blockTitles: [] }, fakeEmb)
    ).toBeNull();
  });

  it("channelTexts trims and drops empty block titles", () => {
    const t = channelTexts({ id: 1, title: "  a  ", enrichmentTitles: [" b ", "", "  "] });
    expect(t).toEqual({ title: "a", description: "", blockTitles: ["b"] });
  });
});

describe("layout post-processing (umap_reduce.py parity)", () => {
  it("computeSize matches the python formula on golden values", () => {
    // python: round(0.8 + log10(n+1)*0.6, 3)
    expect(computeSize(0)).toBeCloseTo(0.8, 3);
    expect(computeSize(81)).toBeCloseTo(0.8 + Math.log10(82) * 0.6, 3);
    expect(computeSize(340)).toBeCloseTo(0.8 + Math.log10(341) * 0.6, 3);
  });

  it("computeEmissive matches the python formula and clamps at 3.0", () => {
    expect(computeEmissive(0)).toBeCloseTo(1.0, 3);
    expect(computeEmissive(6)).toBeCloseTo(1.3, 3);
    expect(computeEmissive(1000)).toBeCloseTo(3.0, 3);
  });

  it("scaleAxis maps to [-8, 8] and handles the degenerate flat axis", () => {
    const scaled = scaleAxis([0, 5, 10]);
    expect(scaled[0]).toBeCloseTo(-COORD_SCALE);
    expect(scaled[1]).toBeCloseTo(0);
    expect(scaled[2]).toBeCloseTo(COORD_SCALE);
    expect(scaleAxis([3, 3, 3])).toEqual([0, 0, 0]);
  });

  it("topNeighbors returns the k most cosine-similar ids", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0.9, 0.1, 0]);
    const c = new Float32Array([0, 1, 0]);
    const map = topNeighbors([a, b, c], ["a", "b", "c"], 1);
    expect(map.get("a")).toEqual(["b"]);
    expect(map.get("b")).toEqual(["a"]);
  });

  it("fibonacciSphere points sit on the requested radius", () => {
    for (const p of fibonacciSphere(10, 6)) {
      expect(Math.hypot(p[0], p[1], p[2])).toBeCloseTo(6, 5);
    }
  });
});

describe("layoutChannels", () => {
  const mkInputs = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      channel: { id: i, slug: `c${i}`, title: `channel ${i}`, blockCount: i * 3, followerCount: i } as RawChannel,
      embedding: fakeEmb(`channel ${i}`),
    }));

  it("is deterministic: same inputs → identical layout", () => {
    const a = layoutChannels(mkInputs(MIN_UMAP_CHANNELS + 5));
    const b = layoutChannels(mkInputs(MIN_UMAP_CHANNELS + 5));
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("animated layout settles on EXACTLY the plain layout (step loop ≡ fit)", () => {
    const plain = layoutChannels(mkInputs(MIN_UMAP_CHANNELS + 5));
    const anim = layoutChannelsAnimated(mkInputs(MIN_UMAP_CHANNELS + 5), undefined, 12);
    expect(JSON.stringify(anim.channels)).toEqual(JSON.stringify(plain));
  });

  it("records frames aligned to channel order, last frame = final positions", () => {
    const n = MIN_UMAP_CHANNELS + 5;
    const { channels, frames } = layoutChannelsAnimated(mkInputs(n), undefined, 12);
    expect(frames.length).toBeGreaterThanOrEqual(10);
    for (const f of frames) expect(f.length).toBe(channels.length);
    const last = frames[frames.length - 1];
    channels.forEach((c, i) => {
      expect(last[i][0]).toBeCloseTo(c.x, 3);
      expect(last[i][1]).toBeCloseTo(c.y, 3);
      expect(last[i][2]).toBeCloseTo(c.z, 3);
    });
  });

  it("fallback path (<30 channels) records no frames", () => {
    const { frames } = layoutChannelsAnimated(mkInputs(5), undefined, 12);
    expect(frames.length).toBe(0);
  });

  it("UMAP path: coords span [-8, 8], schema is complete", () => {
    const out = layoutChannels(mkInputs(MIN_UMAP_CHANNELS + 10));
    const xs = out.map((c) => c.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-COORD_SCALE - 1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(COORD_SCALE + 1e-6);
    for (const c of out) {
      expect(c.id).toBeTypeOf("string");
      expect(c.neighbors).toHaveLength(3);
      expect(c.color).toBe("#ffffff");
    }
  });

  it("small accounts (<30) get the sphere fallback with neighbor lines", () => {
    const out = layoutChannels(mkInputs(8));
    for (const c of out) {
      expect(Math.hypot(c.x, c.y, c.z)).toBeCloseTo(COORD_SCALE * 0.75, 3);
      expect(c.neighbors.length).toBeGreaterThan(0);
    }
  });

  it("empty-title channels land dim on the outer shell with no neighbors", () => {
    const inputs = [...mkInputs(5), { channel: { id: "x" } as RawChannel, embedding: null }];
    const out = layoutChannels(inputs);
    const ghost = out.find((c) => c.id === "x")!;
    expect(ghost.size).toBe(0.8);
    expect(ghost.neighbors).toEqual([]);
    expect(Math.hypot(ghost.x, ghost.y, ghost.z)).toBeGreaterThan(COORD_SCALE * 0.9);
  });
});
