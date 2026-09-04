// layoutCache.ts — computed galaxy layouts, so a revisit renders instantly
// (T6 / eng-review 7A). Partial galaxies ARE cached now: with resumable
// fetching (progressCache) a partial is a legitimate waypoint — show it
// immediately and offer to continue gathering the rest.
import { withStore, STORE_LAYOUTS } from "./idb";
import type { Channel } from "@/types/channel";

const TTL_MS = 24 * 60 * 60 * 1000;

interface CachedLayout {
  slug: string;
  channels: Channel[];
  /** Set when the fetch behind this layout was incomplete. */
  partial?: { fetched: number; expected: number };
  savedAt: number;
}

export interface CachedGalaxy {
  channels: Channel[];
  partial?: { fetched: number; expected: number };
}

export const getCachedLayout = async (slug: string): Promise<CachedGalaxy | null> => {
  const hit = await withStore<CachedLayout | null>(
    STORE_LAYOUTS,
    "readonly",
    (s) => s.get(slug),
    null
  );
  if (!hit || Date.now() - hit.savedAt > TTL_MS || !hit.channels?.length) return null;
  return { channels: hit.channels, partial: hit.partial };
};

export const putCachedLayout = async (
  slug: string,
  channels: Channel[],
  partial?: { fetched: number; expected: number }
): Promise<void> => {
  await withStore<void>(
    STORE_LAYOUTS,
    "readwrite",
    (s) => s.put({ slug, channels, partial, savedAt: Date.now() } satisfies CachedLayout),
    undefined
  );
};

export const dropCachedLayout = async (slug: string): Promise<void> => {
  await withStore<void>(STORE_LAYOUTS, "readwrite", (s) => s.delete(slug), undefined);
};
