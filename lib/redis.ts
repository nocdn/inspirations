import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 30 days
const CACHE_TTL = 60 * 60 * 24 * 30

export async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const start = performance.now()
  const cached = await redis.get<T>(key)
  const redisTime = (performance.now() - start).toFixed(2)

  if (cached !== null) {
    console.log(`[CACHE HIT] ${key} (${redisTime}ms from Redis)`)
    return cached
  }

  console.log(`[CACHE MISS] ${key} - fetching from database...`)
  const fetchStart = performance.now()
  const data = await fetcher()
  const fetchTime = (performance.now() - fetchStart).toFixed(2)

  const setStart = performance.now()
  await redis.set(key, data, { ex: CACHE_TTL })
  const setTime = (performance.now() - setStart).toFixed(2)

  console.log(`[CACHE SET] ${key} (db: ${fetchTime}ms, redis set: ${setTime}ms, ttl: ${CACHE_TTL}s)`)
  return data
}

export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key)
}

export function collectionCacheKey(slug: string): string {
  return `collection:${slug}`
}
