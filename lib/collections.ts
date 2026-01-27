import { eq } from "drizzle-orm"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import { collectionCacheKey, getCached } from "@/lib/redis"
import type { ImageItem } from "@/lib/types"

export async function getCollectionItems(slug: string): Promise<ImageItem[]> {
  return getCached(collectionCacheKey(slug), async () => {
    const posts = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.collection, slug))

    return posts.map((post) => ({
      id: post.id.toString(),
      imageUrl: post.imageUrl,
      title: post.url,
      comment: post.comment || undefined,
      dateCreated: post.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }))
  })
}

export async function getAllCollectionSlugs(): Promise<string[]> {
  return getCached("all-collection-slugs", async () => {
    const result = await db
      .selectDistinct({ collection: postsTable.collection })
      .from(postsTable)

    return result.map((r) => r.collection)
  })
}
