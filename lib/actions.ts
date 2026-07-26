"use server"

import { revalidatePath, updateTag } from "next/cache"

import { eq, sql } from "drizzle-orm"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import {
  addTweetToCollections,
  addUrlToCollections,
  deleteObjectFromR2,
  getUploadUrl as getSharedUploadUrl,
  getR2KeyFromPublicUrl,
  saveImageToCollection as saveSharedImageToCollection,
} from "@/lib/inspiration-mutations"

function revalidateCollectionNavigation() {
  revalidatePath("/")
  revalidatePath("/", "layout")
}

export async function getUploadUrl(filename: string, contentType: string) {
  return getSharedUploadUrl(filename, contentType)
}

export async function saveImageToCollection(
  collection: string,
  imageUrl: string,
  filename: string,
  comment: string = ""
) {
  return saveSharedImageToCollection(collection, imageUrl, filename, comment)
}

export async function addTweetToCollection(
  collection: string,
  tweetUrl: string,
  imageUrl: string,
  authorName: string,
  comment: string,
  remoteVideoUrl?: string
) {
  return addTweetToCollections({
    collections: [collection],
    tweetUrl,
    imageUrl,
    authorName,
    comment,
    remoteVideoUrl,
    mode: "server-action",
  })
}

export async function addUrlToCollection(collection: string, inputUrl: string) {
  return addUrlToCollections({
    collections: [collection],
    inputUrl,
    mode: "server-action",
  })
}

export async function updateItemTitle(itemId: string, collection: string, title: string) {
  const [updated] = await db
    .update(postsTable)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(eq(postsTable.id, parseInt(itemId, 10)))
    .returning()

  if (!updated) {
    throw new Error(`Item ${itemId} not found`)
  }

  console.log(`[DB UPDATE] Updated title for item ${itemId}`)

  updateTag(`collection:${collection}`)
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)

  return {
    id: updated.id.toString(),
    title: updated.title || undefined,
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

  updateTag(`collection:${collection}`)
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)

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

  const maybeR2Key = getR2KeyFromPublicUrl(deleted.imageUrl)
  if (maybeR2Key) {
    try {
      await deleteObjectFromR2(maybeR2Key)
      console.log(`[R2 DELETE] Deleted object ${maybeR2Key}`)
    } catch (error) {
      console.error(`[R2 DELETE] Failed to delete object ${maybeR2Key}:`, error)
    }
  }

  if (deleted.videoUrl) {
    const maybeVideoR2Key = getR2KeyFromPublicUrl(deleted.videoUrl)
    if (maybeVideoR2Key) {
      try {
        await deleteObjectFromR2(maybeVideoR2Key)
        console.log(`[R2 DELETE] Deleted video object ${maybeVideoR2Key}`)
      } catch (error) {
        console.error(`[R2 DELETE] Failed to delete video object ${maybeVideoR2Key}:`, error)
      }
    }
  }

  console.log(
    `[DB DELETE] Deleted item ${itemId} from collection: ${collection} (${(dbTime - startTime).toFixed(2)}ms)`
  )

  updateTag(`collection:${collection}`)
  const totalTime = performance.now()
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)
  console.log(`[TOTAL] Delete operation completed in ${(totalTime - startTime).toFixed(2)}ms`)

  return { id: deleted.id.toString() }
}

export async function addItemToCollection(
  itemId: string,
  collection: string,
  currentCollection?: string
) {
  const [updated] = await db
    .update(postsTable)
    .set({
      collections: sql`array_append(${postsTable.collections}, ${collection})`,
      updatedAt: new Date(),
    })
    .where(eq(postsTable.id, parseInt(itemId, 10)))
    .returning()

  if (!updated) {
    throw new Error(`Item ${itemId} not found`)
  }

  console.log(`[DB UPDATE] Added collection "${collection}" to item ${itemId}`)

  updateTag(`collection:${collection}`)
  revalidatePath(`/collections/${collection}`)
  if (currentCollection && currentCollection !== collection) {
    updateTag(`collection:${currentCollection}`)
    revalidatePath(`/collections/${currentCollection}`)
  }
  for (const existing of updated.collections) {
    if (existing !== collection && existing !== currentCollection) {
      updateTag(`collection:${existing}`)
      revalidatePath(`/collections/${existing}`)
    }
  }
  updateTag("collection:uncategorized")
  revalidatePath("/collections/uncategorized")
  updateTag("all-collection-slugs")
  revalidateCollectionNavigation()

  return { id: updated.id.toString(), collections: updated.collections }
}

export async function removeItemFromCollection(
  itemId: string,
  collection: string,
  currentCollection?: string
) {
  const [updated] = await db
    .update(postsTable)
    .set({
      collections: sql`array_remove(${postsTable.collections}, ${collection})`,
      updatedAt: new Date(),
    })
    .where(eq(postsTable.id, parseInt(itemId, 10)))
    .returning()

  if (!updated) {
    throw new Error(`Item ${itemId} not found`)
  }

  console.log(`[DB UPDATE] Removed collection "${collection}" from item ${itemId}`)

  updateTag(`collection:${collection}`)
  revalidatePath(`/collections/${collection}`)
  if (currentCollection && currentCollection !== collection) {
    updateTag(`collection:${currentCollection}`)
    revalidatePath(`/collections/${currentCollection}`)
  }
  for (const remaining of updated.collections) {
    if (remaining !== collection && remaining !== currentCollection) {
      updateTag(`collection:${remaining}`)
      revalidatePath(`/collections/${remaining}`)
    }
  }
  updateTag("collection:uncategorized")
  revalidatePath("/collections/uncategorized")
  revalidateCollectionNavigation()

  return { id: updated.id.toString(), collections: updated.collections }
}
