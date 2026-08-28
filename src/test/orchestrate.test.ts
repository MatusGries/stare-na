// Orchestrator tests through the mock seam (eng-review decision 2A):
// progress ordering, error mapping, and cancellation.
import { describe, it, expect } from "vitest";
import { runGalaxyPipeline, type PipelineDeps } from "@/lib/pipeline/orchestrate";
import type { GalaxyProgress, RawChannel } from "@/lib/pipeline/types";
import { DIM } from "@/lib/pipeline/embedText";

const unit = () => {
  const v = new Float32Array(DIM);
  v[0] = 1;
  return v;
};

const happyDeps = (overrides: Partial<PipelineDeps> = {}): PipelineDeps => ({
  resolveUser: async () => ({ id: 1 }),
  fetchAllChannels: async (_id, progress) => {
    progress.onPage?.(1, 2);
    progress.onPage?.(2, 2);
    return {
      channels: [
        { id: 1, title: "alpha" },
        { id: 2, title: "beta" },
      ] as RawChannel[],
    };
  },
  enrichChannels: async (_c, onProgress) => onProgress?.(1, 1),
  loadModel: async () => {},
  embedTexts: async (texts, onProgress) => {
    onProgress?.(texts.length, texts.length);
    return texts.map(() => unit());
  },
  layoutChannels: (inputs) => ({ channels: inputs.map((i, idx) => ({
      id: String(i.channel.id),
      slug: String(i.channel.id),
      title: i.channel.title ?? "",
      description: "",
      x: idx, y: 0, z: 0, size: 1, color: "#ffffff", neighbors: [],
    })) }),
  isUnknownUser: (e) => e instanceof Error && e.message === "unknown",
  isNoChannels: (e) => e instanceof Error && e.message === "empty",
  ...overrides,
});

const collect = async (deps: PipelineDeps, signal?: AbortSignal) => {
  const events: GalaxyProgress[] = [];
  await runGalaxyPipeline("someone", deps, (p) => events.push(p), signal);
  return events;
};

describe("runGalaxyPipeline", () => {
  it("emits phases in B2 order: preview first, enrichment behind it, then done", async () => {
    const events = await collect(happyDeps());
    const phases = events.map((e) => e.phase);
    expect(phases).toEqual([
      "resolving",
      "fetching", "fetching",
      "loading-model",
      "embedding",
      "layout",
      "preview",
      "enriching",
      "done",
    ]);
    const done = events.at(-1) as Extract<GalaxyProgress, { phase: "done" }>;
    expect(done.channels).toHaveLength(2);
    expect(done.partial).toBeUndefined();
    // enrichment added no new texts → preview IS final, no settle frames
    expect(done.epochFrames).toBeUndefined();
  });

  it("B2 settle: new enrichment texts trigger a second layout and 2-frame settle", async () => {
    const events = await collect(
      happyDeps({
        enrichChannels: async (channels, onProgress) => {
          channels[0].enrichmentTitles = ["hidden depth", "secret theme"];
          onProgress?.(1, 1);
        },
        // second layout shifts everything by +1 so from ≠ to
        layoutChannels: (() => {
          let call = 0;
          return ((inputs: Parameters<PipelineDeps["layoutChannels"]>[0]) => {
            const offset = call++;
            return {
              channels: inputs.map((i, idx) => ({
                id: String(i.channel.id),
                slug: String(i.channel.id),
                title: i.channel.title ?? "",
                description: "",
                x: idx + offset, y: 0, z: 0, size: 1, color: "#ffffff", neighbors: [],
              })),
              frames: offset === 0 ? [[[0, 0, 0], [1, 0, 0]]] : undefined,
            };
          }) as PipelineDeps["layoutChannels"];
        })(),
      })
    );
    const phases = events.map((e) => e.phase);
    expect(phases).toEqual([
      "resolving",
      "fetching", "fetching",
      "loading-model",
      "embedding",
      "layout",
      "preview",
      "enriching",
      "embedding", // pass 2: only the new texts
      "layout",
      "done",
    ]);
    const done = events.at(-1) as Extract<GalaxyProgress, { phase: "done" }>;
    expect(done.epochFrames).toHaveLength(2);
    // from = preview positions, to = final positions
    expect(done.epochFrames![0][0][0]).toBe(0); // channel 1 preview x
    expect(done.epochFrames![1][0][0]).toBe(1); // channel 1 final x (offset)
  });

  it("maps an unknown user to error(unknown-user)", async () => {
    const events = await collect(
      happyDeps({ resolveUser: async () => { throw new Error("unknown"); } })
    );
    expect(events.at(-1)).toEqual({ phase: "error", kind: "unknown-user", message: "someone" });
  });

  it("maps an empty account to error(no-channels)", async () => {
    const events = await collect(
      happyDeps({ fetchAllChannels: async () => { throw new Error("empty"); } })
    );
    expect((events.at(-1) as any).kind).toBe("no-channels");
  });

  it("surfaces model load failure as error(model-failed)", async () => {
    const events = await collect(
      happyDeps({ loadModel: async () => { throw new Error("cdn down"); } })
    );
    expect((events.at(-1) as any).kind).toBe("model-failed");
  });

  it("passes partial fetch info through to done()", async () => {
    const events = await collect(
      happyDeps({
        fetchAllChannels: async () => ({
          channels: [{ id: 1, title: "a" }] as RawChannel[],
          partial: { fetched: 1, expected: 5 },
        }),
      })
    );
    const done = events.at(-1) as Extract<GalaxyProgress, { phase: "done" }>;
    expect(done.partial).toEqual({ fetched: 1, expected: 5 });
  });

  it("cancel mid-enrichment (post-preview) emits error(cancelled), never done", async () => {
    const ctrl = new AbortController();
    const events = await collect(
      happyDeps({
        enrichChannels: async () => { ctrl.abort(); },
      }),
      ctrl.signal
    );
    expect((events.at(-1) as any).kind).toBe("cancelled");
    // the preview already happened (B2); done must not follow a cancel
    expect(events.some((e) => e.phase === "preview")).toBe(true);
    expect(events.some((e) => e.phase === "done")).toBe(false);
  });

  it("cancel before the fetch emits error(cancelled) and no preview", async () => {
    const ctrl = new AbortController();
    const events = await collect(
      happyDeps({
        fetchAllChannels: async () => { ctrl.abort(); throw new DOMException("Aborted", "AbortError"); },
      }),
      ctrl.signal
    );
    expect((events.at(-1) as any).kind).toBe("cancelled");
    expect(events.some((e) => e.phase === "preview")).toBe(false);
  });
});
