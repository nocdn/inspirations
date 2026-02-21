import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import { NextResponse } from "next/server"

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

const BUCKET_NAME = "inspirations"

export async function GET() {
  const result = await R2.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    })
  )

  return NextResponse.json({
    objects: result.Contents ?? [],
    count: result.KeyCount ?? 0,
  })
}
