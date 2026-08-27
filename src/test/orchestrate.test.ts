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
  layoutChannels: (inputs) =>
    inputs.map((i, idx) => ({
      id: String(i.channel.id),
      slug: String(i.channel.id),
      title: i.channel.title ?? "",
      description: "",
      x: idx, y: 0, z: 0, size: 1, color: "#ffffff", neighbors: [],
    })),
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
  it("emits phases in protocol order and finishes with done(channels)", async () => {
    const events = await collect(happyDeps());
    const phases = events.map((e) => e.phase);
    expect(phases).toEqual([
      "resolving",
      "fetching", "fetching",
      "enriching",
      "loading-model",
      "embedding",
      "layout",
      "done",
    ]);
    const done = events.at(-1) as Extract<GalaxyProgress, { phase: "done" }>;
    expect(done.channels).toHaveLength(2);
    expect(done.partial).toBeUndefined();
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

  it("cancel mid-phase emits error(cancelled) and nothing after", async () => {
    const ctrl = new AbortController();
    const events = await collect(
      happyDeps({
        enrichChannels: async () => { ctrl.abort(); },
      }),
      ctrl.signal
    );
    expect((events.at(-1) as any).kind).toBe("cancelled");
    expect(events.some((e) => e.phase === "embedding")).toBe(false);
    expect(events.some((e) => e.phase === "done")).toBe(false);
  });
});
