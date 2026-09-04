// Unit tests for the Are.na fetch layer, with a mocked global fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveUser,
  fetchAllChannels,
  enrichChannels,
  UnknownUserError,
  NoChannelsError,
  ResolveUnavailableError,
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
  it("resolves a slug through the proxy FIRST, without touching public search", async () => {
    // Are.na's public search rate-limits hard; our proxy is cached + tokened.
    fetchMock.mockResolvedValueOnce(jsonResponse({ total_pages: 1, channels: [] }));
    const u = await settle(resolveUser("terezka"));
    expect(u.slug).toBe("terezka");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/arena?kind=channels&id=terezka");
  });

  it("falls back to search when the proxy 404s (stale slug), matching full_name", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404)) // proxy: slug not current
      .mockResolvedValueOnce(
        jsonResponse({
          users: [
            { id: 1, slug: "tereza-p", full_name: "Tereza P" },
            { id: 284407, slug: "terezka", full_name: "Tereza Slančíková" },
          ],
          total_pages: 1,
        })
      );
    const u = await settle(resolveUser("Tereza Slančíková"));
    expect(u.id).toBe(284407);
    expect(u.slug).toBe("terezka"); // navigation uses the REAL slug
  });

  it("scans further search pages for an exact slug match", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404)) // proxy miss
      .mockResolvedValueOnce(jsonResponse({ users: [{ id: 1, slug: "other" }], total_pages: 2 }))
      .mockResolvedValueOnce(jsonResponse({ users: [{ id: 7, slug: "buried" }], total_pages: 2 }));
    const u = await settle(resolveUser("buried"));
    expect(u.id).toBe(7);
  });

  it("REGRESSION: a rate-limited search does not abort resolution", async () => {
    // The bug: search 429 threw out of resolveUser before the working proxy
    // fallback ran, so /you showed "are.na isn't answering" for a real user.
    fetchMock.mockImplementation((url: any) => {
      const s = String(url);
      if (s.includes("/api/arena")) return Promise.resolve(jsonResponse({ total_pages: 1, channels: [] }));
      return Promise.resolve(jsonResponse({ message: "Too Many Requests" }, 429));
    });
    const u = await settle(resolveUser("terezka"));
    expect(u.slug).toBe("terezka");
  });

  it("throws UnknownUserError when the proxy definitively 404s and search answers with no match", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: 404 }, 404))
      .mockResolvedValueOnce(jsonResponse({ users: [{ id: 1, slug: "someone-else" }], total_pages: 1 }));
    await expect(settle(resolveUser("nobody-here"))).rejects.toBeInstanceOf(UnknownUserError);
  });

  it("throws ResolveUnavailableError when NOTHING answered (retry, don't reject the name)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: "Too Many Requests" }, 429));
    await expect(settle(resolveUser("terezka"))).rejects.toBeInstanceOf(ResolveUnavailableError);
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

  it("RESUME: a second attempt fetches only the missing pages and keeps the first attempt's channels", async () => {
    // Attempt 1: page 1 of 3 lands, pages 2-3 die (Are.na throttling).
    fetchMock.mockImplementation((url: string) => {
      const u = new URL(url, "http://x");
      if (u.searchParams.get("kind") === "channels") {
        return Number(u.searchParams.get("page")) === 1
          ? Promise.resolve(page("channels", [1, 2], 3, 6))
          : Promise.reject(new Error("504"));
      }
      return Promise.resolve(jsonResponse({ total_pages: 1, length: 0, channels: [] }));
    });
    const first = await settle(fetchAllChannels(99));
    expect(first.channels.map((c) => String(c.id)).sort()).toEqual(["1", "2"]);
    expect(first.partial).toBeDefined();
    expect(first.progress.pagesDone.channels).toEqual([1]);

    // Attempt 2, resuming: page 1 must NOT be requested again; 2-3 now land.
    fetchMock.mockClear();
    fetchMock.mockImplementation((url: string) => {
      const u = new URL(url, "http://x");
      const p = Number(u.searchParams.get("page"));
      if (u.searchParams.get("kind") === "channels") {
        return Promise.resolve(page("channels", p === 2 ? [3, 4] : [5], 3, 6));
      }
      return Promise.resolve(jsonResponse({ total_pages: 1, length: 0, channels: [] }));
    });
    const second = await settle(fetchAllChannels(99, {}, undefined, first.progress));

    const requestedChannelPages = fetchMock.mock.calls
      .map((c: any[]) => new URL(String(c[0]), "http://x"))
      .filter((u: URL) => u.searchParams.get("kind") === "channels")
      .map((u: URL) => Number(u.searchParams.get("page")));
    expect(requestedChannelPages).not.toContain(1); // already had it
    expect(requestedChannelPages).toEqual(expect.arrayContaining([2, 3]));

    // accumulated across BOTH attempts
    expect(second.channels.map((c) => String(c.id)).sort()).toEqual(["1", "2", "3", "4", "5"]);
    expect(second.partial).toBeUndefined(); // complete now
  });

  it("RESUME: enrichment gathered earlier survives a re-fetch of the same channel", async () => {
    const resume = {
      channels: [
        { id: "1", slug: "c1", title: "ch 1", blockCount: 1, enrichmentTitles: ["deep", "cut"] },
      ] as RawChannel[],
      pagesDone: { channels: [], following: [] },
      totalPages: { channels: 1, following: 0 },
    };
    fetchMock.mockImplementation((url: string) => {
      const u = new URL(url, "http://x");
      if (u.searchParams.get("kind") === "channels") return Promise.resolve(page("channels", [1], 1, 1));
      return Promise.resolve(jsonResponse({ total_pages: 1, length: 0, channels: [] }));
    });
    const { channels } = await settle(fetchAllChannels(99, {}, undefined, resume));
    expect(channels[0].enrichmentTitles).toEqual(["deep", "cut"]);
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
  it("RESUME: skips channels already enriched on an earlier attempt", async () => {
    const channels: RawChannel[] = [
      { id: "1", title: "a", description: "", blockCount: 90, enrichmentTitles: ["cached"] },
      { id: "2", title: "b", description: "", blockCount: 80 },
    ];
    const hit: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      hit.push(String(url));
      return Promise.resolve(jsonResponse({ contents: [{ title: "fresh" }] }));
    });
    await settle(enrichChannels(channels));
    expect(hit.length).toBe(1); // only channel 2
    expect(hit[0]).toContain("/channels/2/contents");
    expect(channels[0].enrichmentTitles).toEqual(["cached"]); // untouched
  });

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
