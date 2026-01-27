import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 30 days
const CACHE_TTL = 60 * 60 * 24 * 30

export async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await redis.get<T>(key)
  if (cached !== null) {
    return cached
  }

  const data = await fetcher()
  await redis.set(key, data, { ex: CACHE_TTL })
  return data
}

export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key)
}

export function collectionCacheKey(slug: string): string {
  return `collection:${slug}`
}
