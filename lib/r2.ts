type R2Sdk = {
  DeleteObjectCommand: typeof import("@aws-sdk/client-s3").DeleteObjectCommand
  PutObjectCommand: typeof import("@aws-sdk/client-s3").PutObjectCommand
  S3Client: typeof import("@aws-sdk/client-s3").S3Client
  getSignedUrl: typeof import("@aws-sdk/s3-request-presigner").getSignedUrl
}

let r2SdkPromise: Promise<R2Sdk> | undefined
let r2ClientPromise: Promise<InstanceType<typeof import("@aws-sdk/client-s3").S3Client>> | undefined

async function loadR2Sdk(): Promise<R2Sdk> {
  if (!r2SdkPromise) {
    r2SdkPromise = Promise.all([
      import("@aws-sdk/client-s3"),
      import("@aws-sdk/s3-request-presigner"),
    ]).then(([clientS3, requestPresigner]) => ({
      DeleteObjectCommand: clientS3.DeleteObjectCommand,
      PutObjectCommand: clientS3.PutObjectCommand,
      S3Client: clientS3.S3Client,
      getSignedUrl: requestPresigner.getSignedUrl,
    }))
  }

  return r2SdkPromise
}

async function getR2Client() {
  if (!r2ClientPromise) {
    r2ClientPromise = loadR2Sdk().then(({ S3Client }) =>
      new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT!,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      })
    )
  }

  return r2ClientPromise
}

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
  const [{ PutObjectCommand }, R2] = await Promise.all([loadR2Sdk(), getR2Client()])
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
  const [{ DeleteObjectCommand }, R2] = await Promise.all([loadR2Sdk(), getR2Client()])
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
  const [{ PutObjectCommand, getSignedUrl }, R2] = await Promise.all([loadR2Sdk(), getR2Client()])
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
