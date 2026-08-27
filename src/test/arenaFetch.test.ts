// Unit tests for the Are.na fetch layer, with a mocked global fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveUser,
  fetchAllChannels,
  enrichChannels,
  UnknownUserError,
  NoChannelsError,
  CHANNEL_CAP,
  ENRICH_MAX_CHANNELS,
} from "@/lib/arenaFetch";
import type { RawChannel } from "@/lib/pipeline/types";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Run a promise to settlement while auto-advancing fake timers (polite delays). */
type Settled<T> = { ok: true; v: T } | { ok: false; e: unknown };
const settle = async <T,>(p: Promise<T>): Promise<T> => {
  const result: Promise<Settled<T>> = p.then(
    (v) => ({ ok: true, v }) as const,
    (e) => ({ ok: false, e }) as const
  );
  for (let i = 0; i < 300; i++) {
    await vi.advanceTimersByTimeAsync(600);
    const raced = await Promise.race([result, Promise.resolve(null)]);
    if (raced) break;
  }
  const r = await result;
  if (r.ok) return r.v;
  throw (r as { ok: false; e: unknown }).e;
};

describe("resolveUser", () => {
  it("matches the exact slug from open search", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ users: [{ id: 1, slug: "tereza-p" }, { id: 284407, slug: "tereza-slancikova" }] })
    );
    const u = await settle(resolveUser("Tereza-Slancikova"));
    expect(u.id).toBe(284407);
  });

  it("scans further search pages for an exact match", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ users: [{ id: 1, slug: "other" }], total_pages: 2 }))
      .mockResolvedValueOnce(jsonResponse({ users: [{ id: 7, slug: "buried" }], total_pages: 2 }));
    const u = await settle(resolveUser("buried"));
    expect(u.id).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the proxy probe for search-invisible slugs (renamed accounts, surname search gaps)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ users: [], total_pages: 1 })) // search misses
      .mockResolvedValueOnce(jsonResponse({ total_pages: 1, channels: [] })); // proxy 200
    const u = await settle(resolveUser("terezka"));
    expect(u.id).toBe("terezka");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/arena?kind=channels&id=terezka");
  });

  it("throws UnknownUserError when search misses and the proxy probe 404s", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ users: [{ id: 1, slug: "tereza-p" }], total_pages: 1 }))
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404)); // stale slug
    await expect(settle(resolveUser("nobody-here"))).rejects.toBeInstanceOf(UnknownUserError);
  });
});

const page = (kind: string, ids: number[], totalPages: number, length: number) =>
  jsonResponse({
    total_pages: totalPages,
    length,
    channels: ids.map((i) => ({ id: i, slug: `c${i}`, title: `ch ${i}`, class: "Channel", length: i, updated_at: `2026-01-${String((i % 27) + 1).padStart(2, "0")}` })),
  });

describe("fetchAllChannels", () => {
  it("paginates by total_pages across channels + following and dedups", async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = new URL(url, "http://x");
      const kind = u.searchParams.get("kind");
      const p = Number(u.searchParams.get("page"));
      if (kind === "channels") {
        return Promise.resolve(p === 1 ? page(kind, [1, 2], 2, 3) : page(kind, [3], 2, 3));
      }
      return Promise.resolve(page("following", [3, 4], 1, 2)); // 3 duplicates an owned channel
    });
    const { channels, partial } = await settle(fetchAllChannels(99));
    expect(partial).toBeUndefined();
    expect(channels.map((c) => String(c.id)).sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("returns partial results instead of throwing on a mid-fetch failure", async () => {
    let calls = 0;
    fetchMock.mockImplementation((url: string) => {
      const u = new URL(url, "http://x");
      if (u.searchParams.get("kind") === "channels") {
        calls++;
        if (Number(u.searchParams.get("page")) === 1) return Promise.resolve(page("channels", [1, 2], 3, 10));
        return Promise.reject(new Error("network down")); // page 2 fails, retries exhaust
      }
      return Promise.resolve(page("following", [5], 1, 1));
    });
    const { channels, partial } = await settle(fetchAllChannels(99));
    expect(channels.length).toBe(3); // 1, 2 + followed 5
    expect(partial).toBeDefined();
  });

  it("skips a failed page and keeps fetching later pages", async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = new URL(url, "http://x");
      if (u.searchParams.get("kind") === "channels") {
        const p = Number(u.searchParams.get("page"));
        if (p === 1) return Promise.resolve(page("channels", [1], 3, 5));
        if (p === 2) return Promise.reject(new Error("504 storm")); // retries exhaust
        return Promise.resolve(page("channels", [3], 3, 5)); // page 3 still lands
      }
      return Promise.resolve(jsonResponse({ total_pages: 1, length: 0, channels: [] }));
    });
    const { channels, partial } = await settle(fetchAllChannels(99));
    expect(channels.map((c) => String(c.id)).sort()).toEqual(["1", "3"]);
    expect(partial).toBeDefined();
  });

  it("throws NoChannelsError when both lists are empty", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ total_pages: 1, length: 0, channels: [] }))
    );
    await expect(settle(fetchAllChannels(99))).rejects.toBeInstanceOf(NoChannelsError);
  });

  it("caps at CHANNEL_CAP sorted by updated_at (list is not recency-sorted)", async () => {
    const many = Array.from({ length: CHANNEL_CAP + 30 }, (_, i) => i + 1);
    fetchMock.mockImplementation((url: string) => {
      const u = new URL(url, "http://x");
      if (u.searchParams.get("kind") === "channels") {
        return Promise.resolve(page("channels", many, 1, many.length));
      }
      return Promise.resolve(jsonResponse({ total_pages: 1, length: 0, channels: [] }));
    });
    const { channels } = await settle(fetchAllChannels(99));
    expect(channels.length).toBe(CHANNEL_CAP);
  });
});

describe("enrichChannels", () => {
  it("enriches only description-less channels, largest first, capped", async () => {
    const channels: RawChannel[] = Array.from({ length: ENRICH_MAX_CHANNELS + 20 }, (_, i) => ({
      id: i,
      title: `c${i}`,
      description: i % 5 === 0 ? "has description" : "",
      blockCount: i,
    }));
    const hit: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      hit.push(url);
      return Promise.resolve(jsonResponse({ contents: [{ title: "block a" }, { generated_title: "block b" }] }));
    });
    await settle(enrichChannels(channels));
    expect(hit.length).toBe(ENRICH_MAX_CHANNELS);
    // largest-first: the biggest desc-less channel is fetched first
    const firstId = new URL(hit[0], "http://x").pathname.split("/")[3];
    const desclessMax = Math.max(...channels.filter((c) => !c.description).map((c) => Number(c.id)));
    expect(firstId).toBe(String(desclessMax));
    const enriched = channels.filter((c) => c.enrichmentTitles?.length);
    expect(enriched.length).toBe(ENRICH_MAX_CHANNELS);
    expect(enriched[0].enrichmentTitles).toEqual(["block a", "block b"]);
    // channels WITH descriptions were never enriched
    expect(channels.filter((c) => c.description && c.enrichmentTitles).length).toBe(0);
  });

  it("skips failures silently — enrichment never blocks", async () => {
    const channels: RawChannel[] = [
      { id: 1, title: "a", description: "", blockCount: 10 },
      { id: 2, title: "b", description: "", blockCount: 5 },
    ];
    fetchMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom")) // retries for channel 1 exhaust
      .mockResolvedValue(jsonResponse({ contents: [{ title: "ok" }] }));
    await settle(enrichChannels(channels));
    expect(channels[0].enrichmentTitles).toBeUndefined();
    expect(channels[1].enrichmentTitles).toEqual(["ok"]);
  });
});
