import { revalidatePath, revalidateTag, updateTag } from "next/cache"

import ogs from "open-graph-scraper"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import {
  deleteObjectFromR2,
  getPresignedUploadUrl,
  getR2KeyFromPublicUrl,
  uploadBufferToR2,
} from "@/lib/r2"
import type { ImageItem } from "@/lib/types"

type CacheInvalidationMode = "route-handler" | "server-action"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const MAX_OG_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const TWITTER_STATUS_URL_RE = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i

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

function revalidateCollectionNavigation() {
  revalidatePath("/")
  revalidatePath("/", "layout")
}

function revalidateCollectionTag(tag: string, mode: CacheInvalidationMode) {
  if (mode === "server-action") {
    updateTag(tag)
    return
  }

  revalidateTag(tag, "max")
}

function revalidateCollections(collections: string[], mode: CacheInvalidationMode) {
  const uniqueCollections = Array.from(new Set(collections))

  for (const collection of uniqueCollections) {
    revalidateCollectionTag(`collection:${collection}`, mode)
    revalidatePath(`/collections/${collection}`)
  }

  revalidateCollectionTag("all-collection-slugs", mode)
  revalidateCollectionNavigation()
}

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

export function isTwitterStatusUrl(input: string) {
  return TWITTER_STATUS_URL_RE.test(input)
}

export function normalizeHttpUrl(input: string) {
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
    console.error(`[OG] Image download failed - HTTP ${response.status} from ${imageUrl}`)
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
    console.error(`[OG] URL did not return an image - got content-type: ${normalizedContentType}`)
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
  console.log(`[OG] Upload complete - public URL: ${result.publicUrl}`)
  return result
}

async function uploadRemoteVideoToR2(videoUrl: string, sourceHostname: string) {
  console.log(`[VIDEO] Downloading video: ${videoUrl}`)
  const response = await fetch(videoUrl, {
    headers: {
      "user-agent": USER_AGENT,
    },
  })

  if (!response.ok) {
    console.error(`[VIDEO] Video download failed - HTTP ${response.status} from ${videoUrl}`)
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
  console.log(
    `[VIDEO] Uploading to R2 as "${filename}" (type: ${normalizedContentType ?? "unknown"})`
  )
  const result = await uploadBufferToR2(
    new Uint8Array(arrayBuffer),
    filename,
    normalizedContentType ?? "video/mp4"
  )
  console.log(`[VIDEO] Upload complete - public URL: ${result.publicUrl}`)
  return result
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
      `[OG] Fallback metadata endpoint failed - HTTP ${response.status}: ${errorBody.slice(0, 200)}`
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
    `[OG] Searching for image - ogImage: ${JSON.stringify(result.ogImage)}, twitterImage: ${JSON.stringify(result.twitterImage)}, favicon: ${result.favicon ?? "none"}`
  )

  const imageFromOg = result.ogImage?.find((image) => typeof image.url === "string" && image.url)
  if (imageFromOg?.url) {
    console.log(`[OG] Found og:image: ${imageFromOg.url}`)
    return imageFromOg.url
  }
  console.log("[OG] No og:image found")

  const imageFromTwitter = result.twitterImage?.find(
    (image) => typeof image.url === "string" && image.url
  )
  if (imageFromTwitter?.url) {
    console.log(`[OG] Found twitter:image: ${imageFromTwitter.url}`)
    return imageFromTwitter.url
  }
  console.log("[OG] No twitter:image found")

  if (result.favicon) {
    console.log(`[OG] Falling back to favicon: ${result.favicon}`)
  } else {
    console.log("[OG] No image found at all (no og:image, no twitter:image, no favicon)")
  }

  return result.favicon
}

function formatInsertedItem(inserted: typeof postsTable.$inferSelect): ImageItem {
  const isFile = !inserted.url.startsWith("http://") && !inserted.url.startsWith("https://")

  return {
    id: inserted.id.toString(),
    imageUrl: inserted.imageUrl,
    videoUrl: inserted.videoUrl || undefined,
    title: inserted.title || inserted.url,
    originalUrl: isFile ? undefined : inserted.url,
    comment: inserted.comment || undefined,
    collections: inserted.collections,
    dateCreated: inserted.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }
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
      collections: [collection],
      url: filename,
      imageUrl,
      comment,
    })
    .returning()

  console.log(`[DB INSERT] Added item ${inserted.id} to collection: ${collection}`)

  revalidateCollectionTag(`collection:${collection}`, "server-action")
  console.log(`[CACHE INVALIDATE] Updated cache for collection: ${collection}`)

  return formatInsertedItem(inserted)
}

export async function addTweetToCollections(options: {
  collections: string[]
  tweetUrl: string
  imageUrl: string
  authorName: string
  comment: string
  remoteVideoUrl?: string
  mode: CacheInvalidationMode
}) {
  const { collections, tweetUrl, imageUrl, authorName, comment, remoteVideoUrl, mode } = options

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
      collections,
      url: tweetUrl,
      title: authorName,
      imageUrl,
      videoUrl: videoPublicUrl ?? null,
      comment,
    })
    .returning()

  console.log(
    `[DB INSERT] Added tweet ${inserted.id} to collections: ${collections.join(", ")}`
  )

  revalidateCollections(collections, mode)

  return formatInsertedItem(inserted)
}

export async function addUrlToCollections(options: {
  collections: string[]
  inputUrl: string
  mode: CacheInvalidationMode
}) {
  const { collections, inputUrl, mode } = options

  const totalStart = performance.now()
  const parsedUrl = normalizeHttpUrl(inputUrl)
  console.log(`[OG] Starting OG extraction for: ${parsedUrl.toString()}`)

  let metadataResult: Awaited<ReturnType<typeof ogs>>["result"] | undefined
  try {
    const ogsStart = performance.now()
    console.log("[OG] Fetching metadata via ogs...")
    const response = await ogs({
      url: parsedUrl.toString(),
      timeout: 10,
      fetchOptions: {
        headers: BROWSER_HEADERS,
      },
    })
    console.log(`[OG] ogs() completed in ${(performance.now() - ogsStart).toFixed(0)}ms`)

    if (response.error) {
      console.error(
        `[OG] Metadata extraction failed for ${parsedUrl.toString()}: ${response.result.error}`
      )
    } else {
      metadataResult = response.result
      console.log(
        `[OG] Metadata extracted - title: "${metadataResult.ogTitle ?? "none"}", description: "${metadataResult.ogDescription ?? "none"}", site: "${metadataResult.ogSiteName ?? "none"}"`
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
    const imageDownloadStart = performance.now()
    uploadedOgImage = await uploadRemoteImageToR2(resolvedImageUrl.toString(), parsedUrl.hostname)
    console.log(
      `[OG] Image download+upload completed in ${(performance.now() - imageDownloadStart).toFixed(0)}ms`
    )
  } catch (primaryImageError) {
    const message =
      primaryImageError instanceof Error ? primaryImageError.message : String(primaryImageError)
    console.error(`[OG] Primary image extraction failed for ${parsedUrl.toString()}: ${message}`)

    try {
      const fallbackStart = performance.now()
      console.log("[OG] Trying fallback metadata endpoint...")
      uploadedOgImage = await uploadFallbackOgImageToR2(parsedUrl)
      console.log(
        `[OG] Fallback image completed in ${(performance.now() - fallbackStart).toFixed(0)}ms`
      )
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
    `[OG] Extraction complete for ${parsedUrl.hostname} - title: "${title}", image: ${uploadedOgImage.publicUrl}`
  )

  const dbStart = performance.now()
  const [inserted] = await db
    .insert(postsTable)
    .values({
      collections,
      url: parsedUrl.toString(),
      title,
      imageUrl: uploadedOgImage.publicUrl,
      comment: description,
    })
    .returning()
  console.log(
    `[DB INSERT] Added URL ${inserted.id} to collections: ${collections.join(", ")} (${(performance.now() - dbStart).toFixed(0)}ms)`
  )

  revalidateCollections(collections, mode)
  console.log(
    `[TOTAL] addUrlToCollections completed in ${(performance.now() - totalStart).toFixed(0)}ms`
  )

  return formatInsertedItem(inserted)
}

export { deleteObjectFromR2, getR2KeyFromPublicUrl }
