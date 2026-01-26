"use server"

const SYNDICATION_URL = "https://cdn.syndication.twimg.com"

interface TweetPhoto {
  url: string
  width: number
  height: number
  expandedUrl: string
}

interface MediaDetails {
  type: "photo" | "animated_gif" | "video"
  media_url_https: string
  video_info?: {
    variants: {
      bitrate?: number
      content_type: string
      url: string
    }[]
  }
}

interface TweetData {
  text: string
  photos?: TweetPhoto[]
  mediaDetails?: MediaDetails[]
  user: {
    name: string
    screen_name: string
    profile_image_url_https: string
  }
  created_at: string
  favorite_count: number
  conversation_count: number
}

export interface ExtractedTweetData {
  text: string
  imageUrls: string[]
  videoUrls: string[]
  author: {
    name: string
    username: string
    profileImageUrl: string
  }
  createdAt: string
  likes: number
  replies: number
}

function getToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(6 ** 2)
    .replace(/(0+|\.)/g, "")
}

function extractTweetId(urlOrId: string): string | null {
  if (/^[0-9]+$/.test(urlOrId)) {
    return urlOrId
  }

  const patterns = [
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    /(?:twitter\.com|x\.com)\/\w+\/statuses\/(\d+)/,
  ]

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

async function fetchTweetFromSyndication(
  id: string
): Promise<TweetData | null> {
  const url = new URL(`${SYNDICATION_URL}/tweet-result`)
  url.searchParams.set("id", id)
  url.searchParams.set("lang", "en")
  url.searchParams.set(
    "features",
    [
      "tfw_timeline_list:",
      "tfw_follower_count_sunset:true",
      "tfw_tweet_edit_backend:on",
      "tfw_refsrc_session:on",
      "tfw_fosnr_soft_interventions_enabled:on",
      "tfw_show_birdwatch_pivots_enabled:on",
      "tfw_show_business_verified_badge:on",
      "tfw_duplicate_scribes_to_settings:on",
      "tfw_use_profile_image_shape_enabled:on",
      "tfw_show_blue_verified_badge:on",
      "tfw_legacy_timeline_sunset:true",
      "tfw_show_gov_verified_badge:on",
      "tfw_show_business_affiliate_badge:on",
      "tfw_tweet_edit_frontend:on",
    ].join(";")
  )
  url.searchParams.set("token", getToken(id))

  const res = await fetch(url.toString(), {
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    if (res.status === 404) {
      return null
    }
    throw new Error(`Failed to fetch tweet: ${res.status}`)
  }

  const data = await res.json()

  if (data?.__typename === "TweetTombstone" || Object.keys(data).length === 0) {
    return null
  }

  return data as TweetData
}

export async function getTweetData(
  urlOrId: string
): Promise<ExtractedTweetData | null> {
  const tweetId = extractTweetId(urlOrId)

  if (!tweetId) {
    throw new Error("Invalid Twitter/X URL or tweet ID")
  }

  const tweet = await fetchTweetFromSyndication(tweetId)

  if (!tweet) {
    return null
  }

  const imageUrls: string[] = []
  const videoUrls: string[] = []

  if (tweet.photos) {
    for (const photo of tweet.photos) {
      imageUrls.push(photo.url)
    }
  }

  if (tweet.mediaDetails) {
    for (const media of tweet.mediaDetails) {
      if (media.type === "photo") {
        if (!imageUrls.includes(media.media_url_https)) {
          imageUrls.push(media.media_url_https)
        }
      } else if (
        (media.type === "video" || media.type === "animated_gif") &&
        media.video_info
      ) {
        const mp4Variants = media.video_info.variants
          .filter((v) => v.content_type === "video/mp4")
          .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))

        if (mp4Variants.length > 0) {
          videoUrls.push(mp4Variants[0].url)
        }
      }
    }
  }

  return {
    text: tweet.text,
    imageUrls,
    videoUrls,
    author: {
      name: tweet.user.name,
      username: tweet.user.screen_name,
      profileImageUrl: tweet.user.profile_image_url_https,
    },
    createdAt: tweet.created_at,
    likes: tweet.favorite_count,
    replies: tweet.conversation_count,
  }
}
