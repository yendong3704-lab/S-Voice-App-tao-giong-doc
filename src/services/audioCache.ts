/**
 * Lớp 2 - Bộ nhớ đệm Âm thanh & Văn bản (IndexedDB Audio Hash Cache)
 * Tự động băm (Hash) tổ hợp [Câu thoại + Mã giọng + Tốc độ + Cảm xúc + Kỹ thuật + Vùng miền].
 * Nếu một câu đã được tổng hợp âm thanh trước đó, phát lại ngay từ IndexedDB mà không gọi lại API
 * (giảm 90–95% chi phí khi người dùng chỉ sửa vài chữ trong bài dài).
 */

const DB_NAME = 'svoice_studio_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_segments';

export interface CachedAudioEntry {
  hash: string;
  audioBase64: string;
  durationSec: number;
  createdAt: number;
  voiceId: string;
  textPreview: string;
}

export function computeAudioSegmentHash(params: {
  text: string;
  voiceId: string;
  speed: number;
  mood: string;
  delivery: string;
  region: string;
}): string {
  const raw = `${params.text.trim()}|${params.voiceId}|${params.speed}|${params.mood}|${params.delivery}|${params.region}`;
  // FNV-1a 64-bit inspired deterministic hash in hex
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0, ch; i < raw.length; i++) {
    ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'svhash_' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedAudioSegment(hash: string): Promise<CachedAudioEntry | null> {
  try {
    const db = await openCacheDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(hash);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setCachedAudioSegment(entry: CachedAudioEntry): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export async function getCachedAudioCount(): Promise<number> {
  try {
    const db = await openCacheDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

export async function clearAudioCache(): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}
