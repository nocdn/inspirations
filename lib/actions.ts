"use server"

import { updateTag } from "next/cache"

import { eq } from "drizzle-orm"
import ogs from "open-graph-scraper"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import { getPresignedUploadUrl } from "@/lib/r2"

function isPrivateIPv4(hostname: string) {
  const parts = hostname.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false
  }

  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true

  return false
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase()
  if (
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    return isPrivateIPv4(normalized)
  }

  return false
}

function normalizeHttpUrl(input: string) {
  const raw = input.trim()
  if (!raw) {
    throw new Error("URL is required")
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const parsed = new URL(withProtocol)

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) URLs are supported")
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("This URL host is not allowed")
  }

  return parsed
}

function getFirstImageUrl(result: {
  ogImage?: Array<{ url: string }>
  twitterImage?: Array<{ url: string }>
  favicon?: string
}) {
  const imageFromOg = result.ogImage?.find((image) => typeof image.url === "string" && image.url)
  if (imageFromOg?.url) {
    return imageFromOg.url
  }

  const imageFromTwitter = result.twitterImage?.find(
    (image) => typeof image.url === "string" && image.url
  )
  if (imageFromTwitter?.url) {
    return imageFromTwitter.url
  }

  return result.favicon
}

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

  updateTag(`collection:${collection}`)
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)

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

  updateTag(`collection:${collection}`)
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)

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

export async function addUrlToCollection(collection: string, inputUrl: string) {
  const parsedUrl = normalizeHttpUrl(inputUrl)

  const response = await ogs({
    url: parsedUrl.toString(),
    timeout: 10,
    fetchOptions: {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
    },
  })

  if (response.error) {
    throw new Error(response.result.error || "Could not extract metadata from URL")
  }

  const image = getFirstImageUrl(response.result)
  if (!image) {
    throw new Error("No preview image was found for this URL")
  }

  const resolvedImageUrl = new URL(image, parsedUrl).toString()
  const title =
    response.result.ogTitle ||
    response.result.twitterTitle ||
    response.result.dcTitle ||
    response.result.ogSiteName ||
    parsedUrl.hostname

  const description =
    response.result.ogDescription ||
    response.result.twitterDescription ||
    response.result.dcDescription ||
    ""

  const [inserted] = await db
    .insert(postsTable)
    .values({
      collection,
      url: title,
      imageUrl: resolvedImageUrl,
      comment: description,
    })
    .returning()

  console.log(`[DB INSERT] Added URL ${inserted.id} to collection: ${collection}`)

  updateTag(`collection:${collection}`)
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)

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

  console.log(
    `[DB DELETE] Deleted item ${itemId} from collection: ${collection} (${(dbTime - startTime).toFixed(2)}ms)`
  )

  updateTag(`collection:${collection}`)
  const totalTime = performance.now()
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)
  console.log(`[TOTAL] Delete operation completed in ${(totalTime - startTime).toFixed(2)}ms`)

  return { id: deleted.id.toString() }
}
