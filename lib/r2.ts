import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
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

function sanitizeFilename(filename: string) {
  return filename
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120)
}

export function getR2KeyFromPublicUrl(publicUrl: string): string | null {
  if (!publicUrl.startsWith(`${PUBLIC_URL}/`)) {
    return null
  }

  const key = publicUrl.slice(PUBLIC_URL.length + 1)
  if (!key) {
    return null
  }

  return key
}

export async function uploadBufferToR2(
  body: Uint8Array,
  filename: string,
  contentType?: string
): Promise<{ key: string; publicUrl: string }> {
  const safeFilename = sanitizeFilename(filename) || "upload.bin"
  const key = `${Date.now()}-${safeFilename}`

  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    })
  )

  return {
    key,
    publicUrl: `${PUBLIC_URL}/${key}`,
  }
}

export async function deleteObjectFromR2(key: string) {
  await R2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  )
}

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
