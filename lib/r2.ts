import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = "inspirations"
const PUBLIC_URL = "https://images.bartoszbak.org"

export async function uploadToR2(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const key = `${Date.now()}-${filename}`

  console.log(`[R2 UPLOAD] Uploading ${key} (${contentType}, ${file.length} bytes)`)
  const start = performance.now()

  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  )

  const elapsed = (performance.now() - start).toFixed(2)
  console.log(`[R2 UPLOAD] Complete: ${key} (${elapsed}ms)`)

  return `${PUBLIC_URL}/${key}`
}
