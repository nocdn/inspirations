"use server"

import { revalidatePath } from "next/cache"

import { eq } from "drizzle-orm"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import { getPresignedUploadUrl } from "@/lib/r2"
import { collectionCacheKey, invalidateCache } from "@/lib/redis"

export async function getUploadUrl(filename: string, contentType: string) {
  const { uploadUrl, key, publicUrl } = await getPresignedUploadUrl(filename, contentType)
  return { uploadUrl, key, publicUrl }
}

export async function saveImageToCollection(
  collection: string,
  imageUrl: string,
  filename: string,
  comment: string = ""
) {
  const [inserted] = await db
    .insert(postsTable)
    .values({
      collection,
      url: filename,
      imageUrl,
      comment,
    })
    .returning()

  console.log(`[DB INSERT] Added item ${inserted.id} to collection: ${collection}`)

  await invalidateCache(collectionCacheKey(collection))
  console.log(`[CACHE INVALIDATE] Busted cache for collection: ${collection}`)

  revalidatePath(`/collections/${collection}`)
  console.log(`[REVALIDATE] Revalidated path: /collections/${collection}`)

  return {
    id: inserted.id.toString(),
    imageUrl: inserted.imageUrl,
    title: inserted.url,
    comment: inserted.comment || undefined,
    dateCreated: inserted.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }
}

export async function addTweetToCollection(
  collection: string,
  tweetUrl: string,
  imageUrl: string,
  authorName: string,
  comment: string
) {
  const [inserted] = await db
    .insert(postsTable)
    .values({
      collection,
      url: tweetUrl,
      imageUrl,
      comment,
    })
    .returning()

  console.log(`[DB INSERT] Added tweet ${inserted.id} to collection: ${collection}`)

  await invalidateCache(collectionCacheKey(collection))
  console.log(`[CACHE INVALIDATE] Busted cache for collection: ${collection}`)

  revalidatePath(`/collections/${collection}`)
  console.log(`[REVALIDATE] Revalidated path: /collections/${collection}`)

  return {
    id: inserted.id.toString(),
    imageUrl: inserted.imageUrl,
    title: authorName,
    comment: inserted.comment || undefined,
    dateCreated: inserted.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }
}

export async function updateItemComment(itemId: string, collection: string, comment: string) {
  const [updated] = await db
    .update(postsTable)
    .set({
      comment,
      updatedAt: new Date(),
    })
    .where(eq(postsTable.id, parseInt(itemId, 10)))
    .returning()

  if (!updated) {
    throw new Error(`Item ${itemId} not found`)
  }

  console.log(`[DB UPDATE] Updated comment for item ${itemId}`)

  await invalidateCache(collectionCacheKey(collection))
  console.log(`[CACHE INVALIDATE] Busted cache for collection: ${collection}`)

  revalidatePath(`/collections/${collection}`)
  console.log(`[REVALIDATE] Revalidated path: /collections/${collection}`)

  return {
    id: updated.id.toString(),
    comment: updated.comment || undefined,
  }
}

export async function deleteItem(itemId: string, collection: string) {
  const startTime = performance.now()

  const [deleted] = await db
    .delete(postsTable)
    .where(eq(postsTable.id, parseInt(itemId, 10)))
    .returning()

  const dbTime = performance.now()

  if (!deleted) {
    throw new Error(`Item ${itemId} not found`)
  }

  console.log(
    `[DB DELETE] Deleted item ${itemId} from collection: ${collection} (${(dbTime - startTime).toFixed(2)}ms)`
  )

  await invalidateCache(collectionCacheKey(collection))
  const cacheTime = performance.now()
  console.log(
    `[CACHE INVALIDATE] Busted cache for collection: ${collection} (${(cacheTime - dbTime).toFixed(2)}ms)`
  )

  revalidatePath(`/collections/${collection}`)
  const totalTime = performance.now()
  console.log(`[REVALIDATE] Revalidated path: /collections/${collection}`)
  console.log(`[TOTAL] Delete operation completed in ${(totalTime - startTime).toFixed(2)}ms`)

  return { id: deleted.id.toString() }
}
