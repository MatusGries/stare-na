// layoutCache.ts — IndexedDB cache for computed galaxy layouts (T6 / 7A).
// A returning visitor gets their galaxy instantly instead of re-paying the
// full fetch+embed+layout. Client-only, per-browser, 24h TTL. Every call is
// failure-tolerant: any IDB error behaves like a cache miss (a private
// window or blocked storage must never break generation).
import type { Channel } from "@/types/channel";

const DB_NAME = "stare-na";
const STORE = "layouts";
const TTL_MS = 24 * 60 * 60 * 1000;

interface CachedLayout {
  slug: string;
  channels: Channel[];
  savedAt: number;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "slug" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const getCachedLayout = async (slug: string): Promise<Channel[] | null> => {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(slug);
      req.onsuccess = () => {
        const hit = req.result as CachedLayout | undefined;
        db.close();
        if (!hit || Date.now() - hit.savedAt > TTL_MS || !hit.channels?.length) {
          resolve(null);
        } else {
          resolve(hit.channels);
        }
      };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
};

export const putCachedLayout = async (slug: string, channels: Channel[]): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ slug, channels, savedAt: Date.now() } satisfies CachedLayout);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {
    // storage unavailable — next visit just recomputes
  }
};

export const dropCachedLayout = async (slug: string): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(slug);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {
    // ignore
  }
};
