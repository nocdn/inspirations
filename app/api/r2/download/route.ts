import { NextResponse } from "next/server"

import { getObjectFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"

function getDownloadFilename(key: string) {
  const rawFilename = key.split("/").pop() ?? "download"

  return rawFilename.replace(/^\d+-/, "") || "download"
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const publicUrl = searchParams.get("url")

  if (!publicUrl) {
    return NextResponse.json({ error: "Missing `url` query parameter" }, { status: 400 })
  }

  const key = getR2KeyFromPublicUrl(publicUrl)
  if (!key) {
    return NextResponse.json({ error: "Invalid R2 public URL" }, { status: 400 })
  }

  try {
    const object = await getObjectFromR2(key)

    if (!object.Body) {
      return NextResponse.json({ error: "R2 object has no body" }, { status: 404 })
    }

    const filename = getDownloadFilename(key)

    return new NextResponse(object.Body.transformToWebStream(), {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": object.ContentType || "application/octet-stream",
        ...(typeof object.ContentLength === "number"
          ? { "Content-Length": String(object.ContentLength) }
          : {}),
      },
    })
  } catch (error) {
    console.error("[R2 DOWNLOAD] Failed to fetch object:", error)
    return NextResponse.json({ error: "Failed to download object from R2" }, { status: 500 })
  }
}
