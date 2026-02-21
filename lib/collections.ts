import { cacheLife, cacheTag } from "next/cache"

import { arrayContains, desc, sql } from "drizzle-orm"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import type { ImageItem } from "@/lib/types"

export async function getCollectionItems(slug: string): Promise<ImageItem[]> {
  "use cache"
  cacheTag(`collection:${slug}`)
  cacheLife({
    stale: 60 * 5,
    revalidate: 60 * 60,
    expire: 60 * 60 * 24 * 7,
  })

  const posts = await db.select().from(postsTable).where(arrayContains(postsTable.collections, [slug])).orderBy(desc(postsTable.createdAt))

  return posts.map((post) => {
    const isFile = !post.url.startsWith("http://") && !post.url.startsWith("https://")
    return {
      id: post.id.toString(),
      imageUrl: post.imageUrl,
      videoUrl: post.videoUrl || undefined,
      title: post.title || post.url,
      originalUrl: isFile ? undefined : post.url,
      comment: post.comment || undefined,
      collections: post.collections,
      dateCreated: post.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }
  })
}

export async function getUncategorizedItems(): Promise<ImageItem[]> {
  "use cache"
  cacheTag("collection:uncategorized")
  cacheLife({
    stale: 60 * 5,
    revalidate: 60 * 60,
    expire: 60 * 60 * 24 * 7,
  })

  const posts = await db.select().from(postsTable).where(sql`coalesce(array_length(${postsTable.collections}, 1), 0) = 0`).orderBy(desc(postsTable.createdAt))

  return posts.map((post) => {
    const isFile = !post.url.startsWith("http://") && !post.url.startsWith("https://")
    return {
      id: post.id.toString(),
      imageUrl: post.imageUrl,
      videoUrl: post.videoUrl || undefined,
      title: post.title || post.url,
      originalUrl: isFile ? undefined : post.url,
      comment: post.comment || undefined,
      collections: post.collections,
      dateCreated: post.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }
  })
}

export async function getAllCollectionSlugs(): Promise<string[]> {
  "use cache"
  cacheTag("all-collection-slugs")
  cacheLife("days")

  const result = await db.selectDistinct({ collection: sql<string>`unnest(${postsTable.collections})` }).from(postsTable)

  return result.map((r) => r.collection)
}
