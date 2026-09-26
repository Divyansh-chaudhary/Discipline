const cache = new Map()
const inflight = new Map()

export function cacheKey(splitId, date) {
  return `${splitId}:${date}`
}

export function readCache(splitId, date) {
  return cache.get(cacheKey(splitId, date)) || null
}

export function writeCache(splitId, date, payload) {
  cache.set(cacheKey(splitId, date), { ...payload, cachedAt: Date.now() })
}

export function clearCache(splitId, date) {
  cache.delete(cacheKey(splitId, date))
}

export async function fetchCached(splitId, date, loader) {
  const key = cacheKey(splitId, date)
  const hit = cache.get(key)
  if (hit) return hit
  if (inflight.has(key)) return inflight.get(key)
  const pending = loader()
    .then((data) => {
      writeCache(splitId, date, data)
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, pending)
  return pending
}
