import { sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { postsTable } from "@/db/schema"
import { db } from "@/lib/db"
import { deleteObjectFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"

export async function GET() {
  const start = performance.now()

  const posts = await db.select().from(postsTable)
  const rowCount = posts.length

  let r2Count = 0
  for (const post of posts) {
    const imageKey = getR2KeyFromPublicUrl(post.imageUrl)
    if (imageKey) {
      try {
        await deleteObjectFromR2(imageKey)
        r2Count++
      } catch (err) {
        console.error(`[DESTROY] Failed to delete R2 image ${imageKey}:`, err)
      }
    }
    if (post.videoUrl) {
      const videoKey = getR2KeyFromPublicUrl(post.videoUrl)
      if (videoKey) {
        try {
          await deleteObjectFromR2(videoKey)
          r2Count++
        } catch (err) {
          console.error(`[DESTROY] Failed to delete R2 video ${videoKey}:`, err)
        }
      }
    }
  }
  console.log(`[DESTROY] Deleted ${r2Count} objects from R2`)

  await db.delete(postsTable)
  console.log(`[DESTROY] Deleted ${rowCount} rows from database`)

  revalidatePath("/", "layout")
  console.log(`[DESTROY] Invalidated all caches`)

  const elapsed = (performance.now() - start).toFixed(2)
  console.log(`[DESTROY] Complete in ${elapsed}ms`)

  return NextResponse.json({
    destroyed: true,
    dbRowsDeleted: rowCount,
    r2ObjectsDeleted: r2Count,
    elapsed: `${elapsed}ms`,
  })
}
