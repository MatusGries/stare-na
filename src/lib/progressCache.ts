// progressCache.ts — remembers what a galaxy fetch already managed to get,
// so a throttled or partial attempt CONTINUES instead of starting over.
//
// Are.na 504s/429s pages unpredictably (measured all day: 108 of ~398 on a
// bad run). Each attempt now accumulates: pages that landed are recorded,
// enrichment results ride along on the channels, and the next attempt only
// asks for what's still missing.
import { withStore, STORE_PROGRESS } from "./idb";
import type { RawChannel } from "./pipeline/types";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // a week: channel lists move slowly

export interface FetchProgress {
  /** The resolved Are.na user id/slug. Once we've resolved someone we never
   *  ask again — re-resolving was the step that broke resumes when Are.na
   *  throttled its public search. */
  userId?: number | string;
  /** Everything gathered so far, deduped by id (may carry enrichmentTitles). */
  channels: RawChannel[];
  /** Page numbers already fetched successfully, per list. */
  pagesDone: { channels: number[]; following: number[] };
  /** total_pages as last reported, per list (0 = unknown yet). */
  totalPages: { channels: number; following: number };
}

interface StoredProgress extends FetchProgress {
  slug: string;
  savedAt: number;
}

export const emptyProgress = (): FetchProgress => ({
  channels: [],
  pagesDone: { channels: [], following: [] },
  totalPages: { channels: 0, following: 0 },
});

export const getProgress = async (slug: string): Promise<FetchProgress | null> => {
  const hit = await withStore<StoredProgress | null>(
    STORE_PROGRESS,
    "readonly",
    (s) => s.get(slug),
    null
  );
  if (!hit || Date.now() - hit.savedAt > TTL_MS || !hit.channels?.length) return null;
  return {
    userId: hit.userId,
    channels: hit.channels,
    pagesDone: {
      channels: hit.pagesDone?.channels ?? [],
      following: hit.pagesDone?.following ?? [],
    },
    totalPages: {
      channels: hit.totalPages?.channels ?? 0,
      following: hit.totalPages?.following ?? 0,
    },
  };
};

export const putProgress = async (slug: string, progress: FetchProgress): Promise<void> => {
  await withStore<void>(
    STORE_PROGRESS,
    "readwrite",
    (s) => s.put({ slug, ...progress, savedAt: Date.now() } satisfies StoredProgress),
    undefined
  );
};

export const dropProgress = async (slug: string): Promise<void> => {
  await withStore<void>(STORE_PROGRESS, "readwrite", (s) => s.delete(slug), undefined);
};

/** True when every known page of both lists has landed. */
export const isComplete = (p: FetchProgress): boolean =>
  p.totalPages.channels > 0 &&
  p.pagesDone.channels.length >= p.totalPages.channels &&
  p.pagesDone.following.length >= p.totalPages.following;
