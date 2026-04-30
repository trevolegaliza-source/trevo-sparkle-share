// In-memory cache for GeoJSON data — avoids sessionStorage quota issues
const cache = new Map<string, any>();

export const geoCache = {
  get(key: string): any | null {
    return cache.get(key) || null;
  },
  set(key: string, data: any): void {
    cache.set(key, data);
  },
  has(key: string): boolean {
    return cache.has(key);
  },
  clear(): void {
    cache.clear();
  },
};
