// Shared types for the in-browser galaxy pipeline (design doc: v1 Pipeline Spec).

/** Raw channel as returned by the Are.na API (via our proxy), pre-pipeline. */
export interface RawChannel {
  id: string | number;
  slug?: string;
  title?: string;
  description?: string;
  /** blockCount from Are.na's `length` field */
  blockCount?: number;
  followerCount?: number;
  thumbnailUrl?: string | null;
  /** Block titles gathered by the bounded enrichment step (design doc T1). */
  enrichmentTitles?: string[];
}

/**
 * Worker protocol (eng-review decision 2A) — a discriminated union.
 *
 *   resolving → fetching(page/total) → loading-model → embedding(i/n)
 *     → layout → done(Channel[]) | error(kind)
 *
 * The UserGalaxy page renders one status line from these; milestone B's
 * narration plugs into the same seam.
 */
export type GalaxyProgress =
  | { phase: "resolving" }
  | { phase: "fetching"; page: number; totalPages: number }
  | { phase: "enriching"; done: number; total: number }
  | { phase: "loading-model" }
  | { phase: "embedding"; done: number; total: number }
  | { phase: "layout" }
  | {
      /** B2 first pass: a fast titles+descriptions galaxy, explorable
       *  immediately; enrichment continues in the background. */
      phase: "preview";
      channels: import("@/types/channel").Channel[];
      epochFrames?: number[][][];
    }
  | {
      phase: "done";
      channels: import("@/types/channel").Channel[];
      partial?: { fetched: number; expected: number };
      /** UMAP optimization snapshots for the live condensation (milestone B).
       *  Each frame: positions aligned to `channels` order, in layout space
       *  ([-8,8]³ — the renderer applies its own world scale). Absent for the
       *  <30-channel fallback and for cached layouts. */
      epochFrames?: number[][][];
    }
  | { phase: "error"; kind: GalaxyErrorKind; message: string };

export type GalaxyErrorKind =
  | "unknown-user"
  | "no-channels"
  | "fetch-failed"
  | "model-failed"
  | "cancelled";

/** Message sent INTO the worker. */
export type GalaxyWorkerRequest =
  | { type: "start"; username: string }
  | { type: "cancel" };
