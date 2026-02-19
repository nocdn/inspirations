"use server"

import { updateTag } from "next/cache"

import { eq } from "drizzle-orm"
import ogs from "open-graph-scraper"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import {
  deleteObjectFromR2,
  getPresignedUploadUrl,
  getR2KeyFromPublicUrl,
  uploadBufferToR2,
} from "@/lib/r2"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const MAX_OG_IMAGE_BYTES = 15 * 1024 * 1024

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

function normalizeHttpUrlFromBase(input: string, base: URL) {
  const parsed = new URL(input, base)

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) URLs are supported")
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("This URL host is not allowed")
  }

  return parsed
}

function getExtensionFromContentType(contentType: string | null) {
  if (!contentType) return "bin"

  const normalized = contentType.toLowerCase().split(";")[0].trim()
  const mapping: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/svg+xml": "svg",
  }

  return mapping[normalized] || "bin"
}

function getExtensionFromVideoContentType(contentType: string | null) {
  if (!contentType) return "mp4"
  const normalized = contentType.toLowerCase().split(";")[0].trim()
  const mapping: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  }
  return mapping[normalized] || "mp4"
}

async function uploadRemoteImageToR2(imageUrl: string, sourceHostname: string) {
  console.log(`[OG] Downloading image: ${imageUrl}`)
  const response = await fetch(imageUrl, {
    headers: {
      "user-agent": USER_AGENT,
    },
  })

  if (!response.ok) {
    console.error(`[OG] Image download failed — HTTP ${response.status} from ${imageUrl}`)
    throw new Error(`Failed to download OG image (${response.status})`)
  }

  const contentLengthHeader = response.headers.get("content-length")
  const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : NaN
  console.log(
    `[OG] Response status=${response.status}, content-type=${response.headers.get("content-type")}, content-length=${contentLengthHeader ?? "unknown"}`
  )
  if (!Number.isNaN(contentLength) && contentLength > MAX_OG_IMAGE_BYTES) {
    console.error(`[OG] Image too large: ${contentLength} bytes (max ${MAX_OG_IMAGE_BYTES})`)
    throw new Error("OG image is too large to cache")
  }

  const contentTypeHeader = response.headers.get("content-type")
  const normalizedContentType = contentTypeHeader?.toLowerCase().split(";")[0].trim()
  if (normalizedContentType && !normalizedContentType.startsWith("image/")) {
    console.error(`[OG] URL did not return an image — got content-type: ${normalizedContentType}`)
    throw new Error("OG image URL did not return an image")
  }

  const arrayBuffer = await response.arrayBuffer()
  console.log(`[OG] Downloaded ${arrayBuffer.byteLength} bytes`)
  if (arrayBuffer.byteLength > MAX_OG_IMAGE_BYTES) {
    console.error(`[OG] Image body too large: ${arrayBuffer.byteLength} bytes`)
    throw new Error("OG image is too large to cache")
  }

  const ext = getExtensionFromContentType(contentTypeHeader)
  const filename = `og-${sourceHostname}.${ext}`
  console.log(`[OG] Uploading to R2 as "${filename}" (type: ${normalizedContentType ?? "unknown"})`)
  const result = await uploadBufferToR2(
    new Uint8Array(arrayBuffer),
    filename,
    normalizedContentType
  )
  console.log(`[OG] Upload complete — public URL: ${result.publicUrl}`)
  return result
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024

async function uploadRemoteVideoToR2(videoUrl: string, sourceHostname: string) {
  console.log(`[VIDEO] Downloading video: ${videoUrl}`)
  const response = await fetch(videoUrl, {
    headers: {
      "user-agent": USER_AGENT,
    },
  })

  if (!response.ok) {
    console.error(`[VIDEO] Video download failed — HTTP ${response.status} from ${videoUrl}`)
    throw new Error(`Failed to download video (${response.status})`)
  }

  const contentLengthHeader = response.headers.get("content-length")
  const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : NaN
  console.log(
    `[VIDEO] Response status=${response.status}, content-type=${response.headers.get("content-type")}, content-length=${contentLengthHeader ?? "unknown"}`
  )
  if (!Number.isNaN(contentLength) && contentLength > MAX_VIDEO_BYTES) {
    console.error(`[VIDEO] Video too large: ${contentLength} bytes (max ${MAX_VIDEO_BYTES})`)
    throw new Error("Video is too large to cache")
  }

  const contentTypeHeader = response.headers.get("content-type")
  const normalizedContentType = contentTypeHeader?.toLowerCase().split(";")[0].trim()

  const arrayBuffer = await response.arrayBuffer()
  console.log(`[VIDEO] Downloaded ${arrayBuffer.byteLength} bytes`)
  if (arrayBuffer.byteLength > MAX_VIDEO_BYTES) {
    console.error(`[VIDEO] Video body too large: ${arrayBuffer.byteLength} bytes`)
    throw new Error("Video is too large to cache")
  }

  const ext = getExtensionFromVideoContentType(contentTypeHeader)
  const filename = `video-${sourceHostname}.${ext}`
  console.log(`[VIDEO] Uploading to R2 as "${filename}" (type: ${normalizedContentType ?? "unknown"})`)
  const result = await uploadBufferToR2(
    new Uint8Array(arrayBuffer),
    filename,
    normalizedContentType ?? "video/mp4"
  )
  console.log(`[VIDEO] Upload complete — public URL: ${result.publicUrl}`)
  return result
}

const BROWSER_HEADERS: Record<string, string> = {
  "user-agent": USER_AGENT,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
}

async function uploadFallbackOgImageToR2(pageUrl: URL) {
  const fallbackEndpointBase = process.env.FALLBACK_METADATA_ENDPOINT_URL?.trim()
  if (!fallbackEndpointBase) {
    throw new Error("Fallback metadata endpoint is not configured")
  }

  const fallbackEndpoint = new URL("/og", fallbackEndpointBase)
  console.log(
    `[OG] Falling back to metadata service for image extraction: ${fallbackEndpoint.toString()}`
  )

  const response = await fetch(fallbackEndpoint.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "image/*",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({
      url: pageUrl.toString(),
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    console.error(
      `[OG] Fallback metadata endpoint failed — HTTP ${response.status}: ${errorBody.slice(0, 200)}`
    )
    throw new Error(`Fallback metadata endpoint failed (${response.status})`)
  }

  const contentTypeHeader = response.headers.get("content-type")
  const normalizedContentType = contentTypeHeader?.toLowerCase().split(";")[0].trim()
  if (normalizedContentType && !normalizedContentType.startsWith("image/")) {
    const bodyPreview = await response.text().catch(() => "")
    console.error(
      `[OG] Fallback metadata endpoint returned non-image content-type: ${normalizedContentType} (${bodyPreview.slice(0, 200)})`
    )
    throw new Error("Fallback metadata endpoint did not return an image")
  }

  const arrayBuffer = await response.arrayBuffer()
  if (!arrayBuffer.byteLength) {
    throw new Error("Fallback metadata endpoint returned an empty image")
  }
  if (arrayBuffer.byteLength > MAX_OG_IMAGE_BYTES) {
    throw new Error("Fallback OG image is too large to cache")
  }

  const ext = getExtensionFromContentType(contentTypeHeader)
  const filename = `og-${pageUrl.hostname}-fallback.${ext}`
  console.log(
    `[OG] Uploading fallback image to R2 as "${filename}" (type: ${normalizedContentType ?? "unknown"})`
  )
  return uploadBufferToR2(new Uint8Array(arrayBuffer), filename, normalizedContentType)
}

function getFirstImageUrl(result: {
  ogImage?: Array<{ url: string }>
  twitterImage?: Array<{ url: string }>
  favicon?: string
}) {
  console.log(
    `[OG] Searching for image — ogImage: ${JSON.stringify(result.ogImage)}, twitterImage: ${JSON.stringify(result.twitterImage)}, favicon: ${result.favicon ?? "none"}`
  )

  const imageFromOg = result.ogImage?.find((image) => typeof image.url === "string" && image.url)
  if (imageFromOg?.url) {
    console.log(`[OG] Found og:image: ${imageFromOg.url}`)
    return imageFromOg.url
  }
  console.log(`[OG] No og:image found`)

  const imageFromTwitter = result.twitterImage?.find(
    (image) => typeof image.url === "string" && image.url
  )
  if (imageFromTwitter?.url) {
    console.log(`[OG] Found twitter:image: ${imageFromTwitter.url}`)
    return imageFromTwitter.url
  }
  console.log(`[OG] No twitter:image found`)

  if (result.favicon) {
    console.log(`[OG] Falling back to favicon: ${result.favicon}`)
  } else {
    console.log(`[OG] No image found at all (no og:image, no twitter:image, no favicon)`)
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
  comment: string,
  remoteVideoUrl?: string
) {
  let videoPublicUrl: string | undefined
  if (remoteVideoUrl) {
    try {
      const uploaded = await uploadRemoteVideoToR2(remoteVideoUrl, "twitter")
      videoPublicUrl = uploaded.publicUrl
    } catch (err) {
      console.error("[VIDEO] Failed to upload tweet video:", err)
    }
  }

  const [inserted] = await db
    .insert(postsTable)
    .values({
      collection,
      url: tweetUrl,
      imageUrl,
      videoUrl: videoPublicUrl ?? null,
      comment,
    })
    .returning()

  console.log(`[DB INSERT] Added tweet ${inserted.id} to collection: ${collection}`)

  updateTag(`collection:${collection}`)
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)

  return {
    id: inserted.id.toString(),
    imageUrl: inserted.imageUrl,
    videoUrl: inserted.videoUrl || undefined,
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
  console.log(`[OG] Starting OG extraction for: ${parsedUrl.toString()}`)

  let metadataResult: Awaited<ReturnType<typeof ogs>>["result"] | undefined
  try {
    const response = await ogs({
      url: parsedUrl.toString(),
      timeout: 10,
      fetchOptions: {
        headers: BROWSER_HEADERS,
      },
    })

    if (response.error) {
      console.error(
        `[OG] Metadata extraction failed for ${parsedUrl.toString()}: ${response.result.error}`
      )
    } else {
      metadataResult = response.result
      console.log(
        `[OG] Metadata extracted — title: "${metadataResult.ogTitle ?? "none"}", description: "${metadataResult.ogDescription ?? "none"}", site: "${metadataResult.ogSiteName ?? "none"}"`
      )
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object"
          ? JSON.stringify(err)
          : String(err)
    console.error(`[OG] Metadata extraction failed for ${parsedUrl.toString()}: ${message}`)
  }

  let uploadedOgImage
  try {
    const image = metadataResult ? getFirstImageUrl(metadataResult) : undefined
    if (!image) {
      throw new Error("No preview image found in metadata")
    }

    const resolvedImageUrl = normalizeHttpUrlFromBase(image, parsedUrl)
    console.log(`[OG] Resolved image URL: ${resolvedImageUrl.toString()}`)
    uploadedOgImage = await uploadRemoteImageToR2(resolvedImageUrl.toString(), parsedUrl.hostname)
  } catch (primaryImageError) {
    const message =
      primaryImageError instanceof Error ? primaryImageError.message : String(primaryImageError)
    console.error(`[OG] Primary image extraction failed for ${parsedUrl.toString()}: ${message}`)

    try {
      uploadedOgImage = await uploadFallbackOgImageToR2(parsedUrl)
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      console.error(
        `[OG] Fallback image extraction failed for ${parsedUrl.toString()}: ${fallbackMessage}`
      )
      throw new Error("No preview image was found for this URL")
    }
  }

  const title =
    metadataResult?.ogTitle ||
    metadataResult?.twitterTitle ||
    metadataResult?.dcTitle ||
    metadataResult?.ogSiteName ||
    parsedUrl.hostname

  const description =
    metadataResult?.ogDescription ||
    metadataResult?.twitterDescription ||
    metadataResult?.dcDescription ||
    ""

  console.log(
    `[OG] Extraction complete for ${parsedUrl.hostname} — title: "${title}", image: ${uploadedOgImage.publicUrl}`
  )

  const [inserted] = await db
    .insert(postsTable)
    .values({
      collection,
      url: title,
      imageUrl: uploadedOgImage.publicUrl,
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
