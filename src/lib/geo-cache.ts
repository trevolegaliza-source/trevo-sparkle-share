// In-memory cache for GeoJSON data — avoids sessionStorage quota issues.
// SEC-006: LRU + TTL pra não vazar memória em sessões longas (SPA).
const MAX_ENTRIES = 50;
const TTL_MS = 30 * 60 * 1000; // 30 min

interface Entry {
  data: any;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

function isFresh(entry: Entry | undefined): entry is Entry {
  return !!entry && entry.expiresAt > Date.now();
}

export const geoCache = {
  get(key: string): any | null {
    const entry = cache.get(key);
    if (!isFresh(entry)) {
      if (entry) cache.delete(key); // limpa expirado
      return null;
    }
    // LRU: re-insere pra mover pro fim
    cache.delete(key);
    cache.set(key, entry);
    return entry.data;
  },
  set(key: string, data: any): void {
    cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
    // Evicção LRU: remove o mais antigo se ultrapassou limite
    while (cache.size > MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  },
  has(key: string): boolean {
    return isFresh(cache.get(key));
  },
  clear(): void {
    cache.clear();
  },
};
