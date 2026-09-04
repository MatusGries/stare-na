// arenaFetch.ts — browser-side Are.na data layer for generated galaxies.
// Endpoint facts measured in the T1 probe (docs/designs/your-galaxy.md):
//   · search/users + channel contents are OPEN (browser-direct)
//   · users/:id/channels and /following are 401 anonymous → go through our
//     thin Vercel proxy at /api/arena (token server-side only)
//   · per=25 (larger pages 504 on big accounts); paginate by total_pages —
//     pages return FEWER items than `per` (privates filtered post-pagination)
//   · channel list is NOT recency-sorted → the 750 cap sorts client-side
import type { RawChannel } from "./pipeline/types";
import { decodeEntities } from "./decodeEntities";
import { emptyProgress, type FetchProgress } from "./progressCache";

const ARENA = "https://api.are.na/v2";
export const PER_PAGE = 25;
export const CHANNEL_CAP = 750;
const PAGE_DELAY_MS = 350;
const RETRIES = 3;

export class UnknownUserError extends Error {}
export class NoChannelsError extends Error {}
/** Couldn't determine whether the user exists (Are.na refused to answer).
 *  Distinct from UnknownUserError: callers should retry, not reject the name. */
export class ResolveUnavailableError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getJson = async (url: string, signal?: AbortSignal): Promise<any> => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const r = await fetch(url, { signal });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) return { __status: r.status };
      return await r.json();
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
      await sleep(500 * 2 ** attempt); // 0.5s, 1s, 2s
    }
  }
  throw lastErr;
};

const SEARCH_PAGES = 3;

/** Fold diacritics: "Slančíková" → "Slancikova". */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** What the user typed → an Are.na-slug-shaped candidate ("Jane Doe" → "jane-doe"). */
export const slugifyInput = (s: string) =>
  fold(s.trim().toLowerCase())
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Resolve whatever the user typed — a slug, a display name ("Tereza
 * Slančíková"), any casing, with or without diacritics — to an id the proxy
 * can use. Are.na's user search tokenizes on hyphens and doesn't index
 * surnames (measured), so we scan a few search pages and accept a user whose
 * SLUG matches the slugified input or whose FULL NAME matches the typed text
 * (both diacritics-folded). Fallback: probe the authed channels endpoint with
 * the slug candidate (works when the slug is current; stale slugs 404).
 */
export const resolveUser = async (
  input: string,
  signal?: AbortSignal
): Promise<{ id: number | string; slug: string; fullName?: string }> => {
  const typed = fold(input.trim().toLowerCase());
  const slugQ = slugifyInput(input);
  if (!slugQ) throw new UnknownUserError(input);

  // 1. Proxy probe FIRST when the input is already slug-shaped: it goes
  //    through our own cached endpoint with a token, so it's both faster and
  //    far more reliable than Are.na's public search (which rate-limits hard).
  //    A 404 here means the slug isn't current — fall through to search.
  let probeSaidMissing = false;
  if (slugQ === typed.replace(/\s+/g, "-")) {
    try {
      const probe = await getJson(`/api/arena?kind=channels&id=${slugQ}&page=1&per=1`, signal);
      if (!probe.__status) return { id: slugQ, slug: slugQ };
      probeSaidMissing = probe.__status === 404;
    } catch (e) {
      if (signal?.aborted) throw e;
      // proxy unreachable — search is the only hope
    }
  }

  // 2. Search by the folded typed text: catches display names ("Tereza
  //    Slančíková") and slugs the probe missed. Failures here are NOT fatal.
  let searchAnswered = false;
  try {
    for (let page = 1; page <= SEARCH_PAGES; page++) {
      const data = await getJson(
        `${ARENA}/search/users?q=${encodeURIComponent(typed)}&page=${page}`,
        signal
      );
      searchAnswered = true;
      const match = (data.users ?? []).find((u: any) => {
        const uSlug = (u.slug ?? "").toLowerCase();
        const uName = fold((u.full_name ?? "").trim().toLowerCase());
        return uSlug === slugQ || (uName && uName === typed);
      });
      if (match) return { id: match.id, slug: match.slug, fullName: match.full_name };
      if ((data.total_pages ?? 1) <= page) break;
    }
  } catch (e) {
    if (signal?.aborted) throw e;
    // Are.na refused (429/5xx) — we simply don't know
  }

  // 3. Last chance for non-slug input (a display name whose account the probe
  //    never tried) — ask the proxy with the slugified guess.
  if (!probeSaidMissing && slugQ !== typed.replace(/\s+/g, "-")) {
    try {
      const probe = await getJson(`/api/arena?kind=channels&id=${slugQ}&page=1&per=1`, signal);
      if (!probe.__status) return { id: slugQ, slug: slugQ };
      probeSaidMissing = probe.__status === 404;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }

  // A definitive "no such user" needs at least one endpoint to have answered.
  if (probeSaidMissing || searchAnswered) throw new UnknownUserError(input);
  throw new ResolveUnavailableError(input);
};

interface FetchCallbacks {
  onPage?: (page: number, totalPages: number) => void;
}

const mapChannel = (c: any): RawChannel => ({
  id: String(c.id),
  slug: c.slug,
  // Are.na entity-encodes symbol-heavy titles ("EVA ⋆｡°✩") — decode once here
  title: decodeEntities(c.title ?? ""),
  description: decodeEntities(c.metadata?.description ?? c.description ?? ""),
  blockCount: c.length ?? 0,
  followerCount: c.follower_count ?? 0,
  thumbnailUrl: null,
  updatedAt: c.updated_at,
});

export interface FetchResult {
  channels: RawChannel[];
  partial?: { fetched: number; expected: number };
  /** Bookkeeping to persist so the NEXT attempt resumes where this stopped. */
  progress: FetchProgress;
}

/**
 * Fetch a user's galaxy channels (owned + followed, matching the gift) via
 * the proxy — RESUMABLY. Pages recorded in `resume` are skipped, new pages
 * merge into what's already there, and the returned progress lets the next
 * attempt pick up the rest. Are.na throttles unpredictably, so an attempt
 * that only lands some pages is normal and must not lose ground.
 */
export const fetchAllChannels = async (
  userId: number | string,
  { onPage }: FetchCallbacks = {},
  signal?: AbortSignal,
  resume?: FetchProgress | null
): Promise<FetchResult> => {
  const progress: FetchProgress = resume
    ? {
        channels: [...resume.channels],
        pagesDone: {
          channels: [...resume.pagesDone.channels],
          following: [...resume.pagesDone.following],
        },
        totalPages: { ...resume.totalPages },
      }
    : emptyProgress();

  // Dedup across attempts by id; later data wins so enrichment survives.
  const byId = new Map<string, RawChannel>(progress.channels.map((c) => [String(c.id), c]));
  let failed = false;
  let expected = 0;

  // A failed page is SKIPPED, not fatal — Are.na 504s intermittently and one
  // bad page must not drop every page after it. Stop a kind only after 3
  // consecutive failures (the API is likely down, not flaky).
  const MAX_CONSECUTIVE_FAILURES = 3;
  for (const kind of ["channels", "following"] as const) {
    const done = new Set(progress.pagesDone[kind]);
    let totalPages = progress.totalPages[kind] || 1;
    let consecutiveFailures = 0;
    for (let page = 1; page <= totalPages; page++) {
      if (done.has(page)) continue; // already landed on an earlier attempt
      try {
        const data = await getJson(
          `/api/arena?kind=${kind}&id=${userId}&page=${page}&per=${PER_PAGE}`,
          signal
        );
        if (data.__status) throw new Error(`HTTP ${data.__status}`);
        consecutiveFailures = 0;
        totalPages = data.total_pages ?? 1;
        progress.totalPages[kind] = totalPages;
        if (page === 1) expected += data.length ?? 0;
        // /following mixes users/blocks in — keep only channels
        const items = (data.channels ?? []).filter(
          (c: any) => (c.base_class ?? c.class ?? "Channel") === "Channel" || c.class === "Channel"
        );
        for (const item of items) {
          const mapped = mapChannel(item);
          const prev = byId.get(String(mapped.id));
          // keep enrichment already gathered for this channel
          byId.set(String(mapped.id), prev?.enrichmentTitles
            ? { ...mapped, enrichmentTitles: prev.enrichmentTitles }
            : mapped);
        }
        done.add(page);
        progress.pagesDone[kind] = [...done];
        onPage?.(done.size, totalPages);
        if (page < totalPages) await sleep(PAGE_DELAY_MS);
      } catch (e) {
        if (signal?.aborted) throw e;
        failed = true;
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) break;
      }
    }
  }

  let channels = [...byId.values()];
  progress.channels = channels;

  if (!channels.length && !failed) throw new NoChannelsError();

  // 750 cap: list is NOT recency-sorted (T1) — sort by updated_at client-side
  if (channels.length > CHANNEL_CAP) {
    channels = [...channels]
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
      .slice(0, CHANNEL_CAP);
  }

  // "expected" across attempts: the API's reported totals, or what we hold
  const reported = Math.max(expected, resume?.channels.length ?? 0);
  const stillMissing =
    progress.pagesDone.channels.length < progress.totalPages.channels ||
    progress.pagesDone.following.length < progress.totalPages.following;

  return {
    channels,
    progress,
    partial:
      (failed || stillMissing) && channels.length
        ? { fetched: channels.length, expected: Math.max(reported, channels.length) }
        : undefined,
  };
};

export const ENRICH_MAX_CHANNELS = 60;
export const ENRICH_PER = 50;

/**
 * Bounded block-title enrichment (design doc T1 / D9): first-page contents
 * for description-less channels only, largest first, capped. Browser-direct
 * (contents endpoint is open). Failures are silently skipped — enrichment is
 * a quality boost, never a blocker.
 */
export const enrichChannels = async (
  channels: RawChannel[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> => {
  const targets = channels
    .filter(
      (c) =>
        !(c.description ?? "").trim() &&
        (c.blockCount ?? 0) > 0 &&
        // already enriched on an earlier attempt (restored from progress cache)
        !c.enrichmentTitles
    )
    .sort((a, b) => (b.blockCount ?? 0) - (a.blockCount ?? 0))
    .slice(0, ENRICH_MAX_CHANNELS);

  for (let i = 0; i < targets.length; i++) {
    if (signal?.aborted) return;
    try {
      const data = await getJson(
        `${ARENA}/channels/${targets[i].id}/contents?per=${ENRICH_PER}`,
        signal
      );
      targets[i].enrichmentTitles = (data.contents ?? [])
        .map((b: any) => decodeEntities(b.title || b.generated_title || "").trim())
        .filter(Boolean);
    } catch {
      // skip — enrichment is best-effort, and an un-enriched channel stays
      // eligible on the next attempt (no enrichmentTitles set)
    }
    onProgress?.(i + 1, targets.length);
    if (i < targets.length - 1) await sleep(120);
  }
};

/** Lazy SidePanel previews: first 6 blocks of one channel, browser-direct. */
export const fetchBlockPreviews = async (channelId: string, signal?: AbortSignal) => {
  const data = await getJson(`${ARENA}/channels/${channelId}/contents?per=6`, signal);
  return (data.contents ?? []).map((b: any) => ({
    id: b.id,
    title: decodeEntities(b.title || b.generated_title || ""),
    kind: b.kind || b.class || "Block",
    imageUrl: b.image?.thumb?.url ?? b.image?.square?.url ?? null,
  }));
};
