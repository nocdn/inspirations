"use server"

import { revalidatePath } from "next/cache"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import { uploadToR2 } from "@/lib/r2"
import { collectionCacheKey, invalidateCache } from "@/lib/redis"

export async function addImageToCollection(formData: FormData) {
  const file = formData.get("file") as File | null
  const collection = formData.get("collection") as string
  const comment = (formData.get("comment") as string) || ""
  const url = (formData.get("url") as string) || ""

  if (!file || !collection) {
    throw new Error("File and collection are required")
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const imageUrl = await uploadToR2(buffer, file.name, file.type)

  const [inserted] = await db
    .insert(postsTable)
    .values({
      collection,
      url: url || file.name,
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
