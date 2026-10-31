/** Public data only: a short, location-keyed memory cache and shared requests. */
export function createCatalogResource<T>(load: (key: string) => Promise<T>, ttl = 30_000) {
  const cache = new Map<string, { data: T; at: number }>();
  const pending = new Map<string, Promise<T>>();
  return (key: string, force = false): Promise<T> => {
    const active = pending.get(key);
    if (active) return active;
    const cached = cache.get(key);
    if (!force && cached && Date.now() - cached.at < ttl) return Promise.resolve(cached.data);
    const task = load(key).then((data) => {
      if (cache.size >= 8) cache.delete(cache.keys().next().value as string);
      cache.set(key, { data, at: Date.now() });
      return data;
    }).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}
