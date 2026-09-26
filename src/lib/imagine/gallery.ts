import type { GalleryItem } from "./types";

const META_KEY = "imagine.gallery.v1";
const MAX_ITEMS = 48;
const DB_NAME = "imagine-studio";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function loadGalleryMeta(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GalleryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveGalleryMeta(items: GalleryItem[]) {
  const meta = items.slice(0, MAX_ITEMS).map((item) => {
    const remote = item.remoteUrl || "";
    const url =
      remote ||
      (item.url.startsWith("blob:") || item.url.startsWith("data:") ? "" : item.url);
    return {
      ...item,
      url,
      remoteUrl: remote || url || undefined,
    };
  });
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* storage optional */
  }
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch {
    return undefined;
  }
}

export async function deleteBlob(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

export async function cacheRemoteMedia(id: string, url: string): Promise<string | undefined> {
  try {
    const src = url.startsWith("data:")
      ? url
      : `/api/media?url=${encodeURIComponent(url)}`;
    const res = await fetch(src);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    await putBlob(id, blob);
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}
