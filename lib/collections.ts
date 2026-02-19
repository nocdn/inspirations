import { cacheLife, cacheTag } from "next/cache"

import { desc, eq } from "drizzle-orm"

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

  const posts = await db.select().from(postsTable).where(eq(postsTable.collection, slug)).orderBy(desc(postsTable.createdAt))

  return posts.map((post) => {
    const isFile = !post.url.startsWith("http://") && !post.url.startsWith("https://")
    return {
      id: post.id.toString(),
      imageUrl: post.imageUrl,
      videoUrl: post.videoUrl || undefined,
      title: post.title || post.url,
      originalUrl: isFile ? undefined : post.url,
      comment: post.comment || undefined,
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

  const result = await db.selectDistinct({ collection: postsTable.collection }).from(postsTable)

  return result.map((r) => r.collection)
}
