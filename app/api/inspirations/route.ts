import { NextResponse } from "next/server"

import { parseCollectionsInput, VALID_COLLECTIONS } from "@/lib/collection-config"
import {
  addTweetToCollections,
  addUrlToCollections,
  isTwitterStatusUrl,
  normalizeHttpUrl,
} from "@/lib/inspiration-mutations"
import { getTweetData } from "@/lib/twitter"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 })
    }

    const { url, collections: rawCollections } = body as {
      url?: unknown
      collections?: unknown
    }

    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "`url` must be a non-empty string" }, { status: 400 })
    }

    const collections = parseCollectionsInput(rawCollections)
    const normalizedUrl = normalizeHttpUrl(url).toString()

    const item = isTwitterStatusUrl(normalizedUrl)
      ? await createTweetInspiration(normalizedUrl, collections)
      : await addUrlToCollections({
          collections,
          inputUrl: normalizedUrl,
          mode: "route-handler",
        })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create inspiration"
    const status =
      error instanceof SyntaxError ||
      message.startsWith("`collections`") ||
      message.startsWith("Invalid collections:") ||
      message === "URL is required" ||
      message === "Only HTTP(S) URLs are supported" ||
      message === "This URL host is not allowed"
        ? 400
        : message === "Tweet not found"
          ? 404
          : 500

    return NextResponse.json(
      {
        error: message,
        validCollections: VALID_COLLECTIONS,
      },
      { status }
    )
  }
}

async function createTweetInspiration(url: string, collections: string[]) {
  const tweet = await getTweetData(url)
  if (!tweet) {
    throw new Error("Tweet not found")
  }

  const firstImage = tweet.imageUrls[0] ?? tweet.author.profileImageUrl
  const firstVideo = tweet.videoUrls[0]
  const cleanedText = tweet.text.replace(/\s*https?:\/\/t\.co\/\w+\s*$/, "").slice(0, 100)

  return addTweetToCollections({
    collections,
    tweetUrl: url,
    imageUrl: firstImage,
    authorName: tweet.author.name,
    comment: cleanedText,
    remoteVideoUrl: firstVideo,
    mode: "route-handler",
  })
}
