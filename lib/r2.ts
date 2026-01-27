import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

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
const PUBLIC_URL = "https://images.bartoszbak.org"

export async function getPresignedUploadUrl(
  filename: string,
  contentType: string
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const key = `${Date.now()}-${filename}`
  const normalizedContentType = contentType?.trim()

  console.log(`[R2 PRESIGN] Generating presigned URL for ${key} (${contentType})`)
  const start = performance.now()

  const uploadUrl = await getSignedUrl(
    R2,
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ...(normalizedContentType ? { ContentType: normalizedContentType } : {}),
    }),
    { expiresIn: 3600 }
  )

  const elapsed = (performance.now() - start).toFixed(2)
  console.log(`[R2 PRESIGN] Generated in ${elapsed}ms`)

  return {
    uploadUrl,
    key,
    publicUrl: `${PUBLIC_URL}/${key}`,
  }
}
