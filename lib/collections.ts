import { cacheLife, cacheTag } from "next/cache"

import { eq } from "drizzle-orm"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import type { ImageItem } from "@/lib/types"

export async function getCollectionItems(slug: string): Promise<ImageItem[]> {
  "use cache"
  cacheTag(`collection:${slug}`)
  cacheLife({
    stale: 60 * 5,           // 5 minutes
    revalidate: 60 * 60,     // 1 hour
    expire: 60 * 60 * 24 * 7 // 7 days
  })

  const posts = await db.select().from(postsTable).where(eq(postsTable.collection, slug))

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
}

export async function getAllCollectionSlugs(): Promise<string[]> {
  "use cache"
  cacheTag("all-collection-slugs")
  cacheLife("days")

  const result = await db.selectDistinct({ collection: postsTable.collection }).from(postsTable)

  return result.map((r) => r.collection)
}
