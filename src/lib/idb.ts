// idb.ts — one place that owns the IndexedDB schema, so the layout cache and
// the fetch-progress cache can't fight over the version number.
//
//   stare-na (v2)
//     ├── layouts   keyPath slug  — computed Channel[] (instant revisits)
//     └── progress  keyPath slug  — raw channels + which pages landed, so a
//                                   throttled fetch RESUMES instead of restarting
export const DB_NAME = "stare-na";
export const DB_VERSION = 2;
export const STORE_LAYOUTS = "layouts";
export const STORE_PROGRESS = "progress";

export const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_LAYOUTS)) {
        db.createObjectStore(STORE_LAYOUTS, { keyPath: "slug" });
      }
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS, { keyPath: "slug" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Every cache read/write is best-effort: private windows and blocked storage
 *  must degrade to "no cache", never break a galaxy. */
export const withStore = async <T,>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest | void,
  fallback: T
): Promise<T> => {
  try {
    const db = await openDb();
    return await new Promise<T>((resolve) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      let value: T = fallback;
      if (req) req.onsuccess = () => { value = (req.result as T) ?? fallback; };
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onerror = () => { db.close(); resolve(fallback); };
      tx.onabort = () => { db.close(); resolve(fallback); };
    });
  } catch {
    return fallback;
  }
};
