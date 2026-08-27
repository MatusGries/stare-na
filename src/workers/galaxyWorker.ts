// galaxyWorker.ts — thin Web Worker around the pipeline orchestrator.
// All heavy lifting (fetch, MiniLM embedding, UMAP) happens here, off the
// main thread. The page talks the GalaxyProgress protocol (types.ts) and
// terminates this worker on unmount (eng-review decision 2A).
import { pipeline as hfPipeline } from "@huggingface/transformers";
import { runGalaxyPipeline } from "@/lib/pipeline/orchestrate";
import { layoutChannels } from "@/lib/pipeline/layout";
import { DIM } from "@/lib/pipeline/embedText";
import {
  resolveUser,
  fetchAllChannels,
  enrichChannels,
  UnknownUserError,
  NoChannelsError,
} from "@/lib/arenaFetch";
import type { GalaxyProgress, GalaxyWorkerRequest } from "@/lib/pipeline/types";

let embedder: any = null;
const controller = new AbortController();

const loadModel = async () => {
  if (embedder) return;
  embedder = await hfPipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
  });
};

const embedTexts = async (
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<Float32Array[]> => {
  const out: Float32Array[] = [];
  const BATCH = 32;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const t = await embedder(batch, { pooling: "mean", normalize: true });
    const data = t.data as Float32Array;
    for (let j = 0; j < batch.length; j++) out.push(data.slice(j * DIM, (j + 1) * DIM));
    onProgress?.(Math.min(i + BATCH, texts.length), texts.length);
  }
  return out;
};

const emit = (p: GalaxyProgress) => (self as unknown as Worker).postMessage(p);

self.onmessage = (e: MessageEvent<GalaxyWorkerRequest>) => {
  const msg = e.data;
  if (msg.type === "cancel") {
    controller.abort();
    return;
  }
  if (msg.type === "start") {
    void runGalaxyPipeline(
      msg.username,
      {
        resolveUser,
        fetchAllChannels,
        enrichChannels,
        loadModel,
        embedTexts,
        layoutChannels: (inputs) => layoutChannels(inputs),
        isUnknownUser: (err) => err instanceof UnknownUserError,
        isNoChannels: (err) => err instanceof NoChannelsError,
      },
      emit,
      controller.signal
    );
  }
};
