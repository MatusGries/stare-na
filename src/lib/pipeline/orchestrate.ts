// orchestrate.ts — the galaxy pipeline conductor. Pure orchestration with
// injected dependencies (the eng-review "mock seam"): tests drive it with
// fakes; the worker wires in the real fetchers/embedder/layouter.
import type { Channel } from "@/types/channel";
import type { GalaxyProgress, RawChannel } from "./types";
import { channelTexts, collectDistinctTexts, combineChannelEmbedding } from "./embedText";

export interface PipelineDeps {
  resolveUser: (slug: string, signal?: AbortSignal) => Promise<{ id: number | string }>;
  fetchAllChannels: (
    userId: number | string,
    progress: { onPage?: (page: number, totalPages: number) => void },
    signal?: AbortSignal
  ) => Promise<{ channels: RawChannel[]; partial?: { fetched: number; expected: number } }>;
  enrichChannels: (
    channels: RawChannel[],
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ) => Promise<void>;
  /** Loads the embedding model (idempotent). */
  loadModel: () => Promise<void>;
  /** Embeds a batch of texts, in order. */
  embedTexts: (
    texts: string[],
    onProgress?: (done: number, total: number) => void
  ) => Promise<Float32Array[]>;
  layoutChannels: (
    inputs: { channel: RawChannel; embedding: Float32Array | null }[]
  ) => { channels: Channel[]; frames?: number[][][] };
  isUnknownUser: (e: unknown) => boolean;
  isNoChannels: (e: unknown) => boolean;
}

/** Run the full pipeline, emitting typed progress. Cancel via AbortSignal. */
export const runGalaxyPipeline = async (
  username: string,
  deps: PipelineDeps,
  emit: (p: GalaxyProgress) => void,
  signal?: AbortSignal
): Promise<void> => {
  const cancelled = () => signal?.aborted === true;
  const bail = () => emit({ phase: "error", kind: "cancelled", message: "cancelled" });

  try {
    // Model download starts in parallel with the fetch (design doc step 5)
    const modelReady = deps.loadModel();
    modelReady.catch(() => {}); // surfaced later, at the await

    emit({ phase: "resolving" });
    let userId: number | string;
    try {
      userId = (await deps.resolveUser(username, signal)).id;
    } catch (e) {
      if (cancelled()) return bail();
      if (deps.isUnknownUser(e)) {
        return emit({ phase: "error", kind: "unknown-user", message: username });
      }
      return emit({ phase: "error", kind: "fetch-failed", message: String(e) });
    }

    let channels: RawChannel[];
    let partial: { fetched: number; expected: number } | undefined;
    try {
      const res = await deps.fetchAllChannels(
        userId,
        { onPage: (page, totalPages) => !cancelled() && emit({ phase: "fetching", page, totalPages }) },
        signal
      );
      channels = res.channels;
      partial = res.partial;
    } catch (e) {
      if (cancelled()) return bail();
      if (deps.isNoChannels(e)) {
        return emit({ phase: "error", kind: "no-channels", message: username });
      }
      return emit({ phase: "error", kind: "fetch-failed", message: String(e) });
    }
    if (cancelled()) return bail();
    if (!channels.length) return emit({ phase: "error", kind: "no-channels", message: username });

    await deps.enrichChannels(
      channels,
      (done, total) => !cancelled() && emit({ phase: "enriching", done, total }),
      signal
    );
    if (cancelled()) return bail();

    emit({ phase: "loading-model" });
    try {
      await modelReady;
    } catch (e) {
      return emit({ phase: "error", kind: "model-failed", message: String(e) });
    }
    if (cancelled()) return bail();

    const distinct = collectDistinctTexts(channels);
    const embs = await deps.embedTexts(distinct, (done, total) =>
      !cancelled() && emit({ phase: "embedding", done, total })
    );
    if (cancelled()) return bail();

    const index = new Map(distinct.map((t, i) => [t, embs[i]]));
    const embOf = (t: string) => index.get(t)!;

    emit({ phase: "layout" });
    const inputs = channels.map((c) => ({
      channel: c,
      embedding: combineChannelEmbedding(channelTexts(c), embOf),
    }));
    const out = deps.layoutChannels(inputs);
    if (cancelled()) return bail();

    emit({
      phase: "done",
      channels: out.channels,
      partial,
      epochFrames: out.frames?.length ? out.frames : undefined,
    });
  } catch (e) {
    if (cancelled()) return bail();
    emit({ phase: "error", kind: "fetch-failed", message: String(e) });
  }
};
