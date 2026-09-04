// galaxyWorker.ts — thin Web Worker around the pipeline orchestrator.
// All heavy lifting (fetch, MiniLM embedding, UMAP) happens here, off the
// main thread. The page talks the GalaxyProgress protocol (types.ts) and
// terminates this worker on unmount (eng-review decision 2A).
import { pipeline as hfPipeline, env as hfEnv } from "@huggingface/transformers";

// Self-hosted weights (eng review D12.2): served from our own deployment,
// no Hugging Face CDN on the cold path. scripts/fetch-model.mjs stages them
// into public/models/ before dev and build.
hfEnv.allowRemoteModels = false;
hfEnv.allowLocalModels = true; // browser builds default this to false
hfEnv.localModelPath = "/models/";
import { runGalaxyPipeline } from "@/lib/pipeline/orchestrate";
import { layoutChannelsAnimated } from "@/lib/pipeline/layout";
import { DIM } from "@/lib/pipeline/embedText";
import {
  resolveUser,
  fetchAllChannels,
  enrichChannels,
  UnknownUserError,
  NoChannelsError,
} from "@/lib/arenaFetch";
import { getProgress, putProgress } from "@/lib/progressCache";
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
    const slug = msg.username;
    void runGalaxyPipeline(
      slug,
      {
        // Never re-resolve someone we've already resolved: a throttled search
        // used to strand resumes at "finding <user>…" even though we held
        // their channels on disk.
        resolveUser: async (input, signal) => {
          const cached = await getProgress(slug);
          if (cached?.userId !== undefined) return { id: cached.userId, slug };
          return resolveUser(input, signal);
        },
        // Resumable: reuse whatever earlier attempts gathered for this user,
        // fetch only the missing pages, and persist the new watermark. Are.na
        // throttles unpredictably, so each attempt must add ground, not restart.
        fetchAllChannels: async (userId, cbs, signal) => {
          const resume = await getProgress(slug);
          const result = await fetchAllChannels(userId, cbs, signal, resume);
          await putProgress(slug, { ...result.progress, userId });
          return result;
        },
        enrichChannels: async (channels, onProgress, signal) => {
          await enrichChannels(channels, onProgress, signal);
          // Persist enrichment too — a retry then skips those ~60 requests.
          const resume = await getProgress(slug);
          if (resume) {
            const byId = new Map(channels.map((c) => [String(c.id), c]));
            await putProgress(slug, {
              ...resume,
              channels: resume.channels.map((c) => byId.get(String(c.id)) ?? c),
            });
          }
        },
        loadModel,
        embedTexts,
        layoutChannels: (inputs, opts) => layoutChannelsAnimated(inputs, undefined, opts?.frames ? 48 : 0),
        isUnknownUser: (err) => err instanceof UnknownUserError,
        isNoChannels: (err) => err instanceof NoChannelsError,
      },
      emit,
      controller.signal
    );
  }
};
