export const VALID_COLLECTIONS = ["typography", "components", "animations", "uncategorized"] as const

export type ValidCollection = (typeof VALID_COLLECTIONS)[number]

export function normalizeCollectionName(input: string) {
  return input.trim().toLowerCase()
}

export function isValidCollection(input: string): input is ValidCollection {
  return VALID_COLLECTIONS.includes(input as ValidCollection)
}

export function parseCollectionsInput(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("`collections` must be a non-empty array")
  }

  const normalized = input.map((value) => {
    if (typeof value !== "string") {
      throw new Error("`collections` must only contain strings")
    }

    return normalizeCollectionName(value)
  })

  const invalid = normalized.filter((value) => !isValidCollection(value))
  if (invalid.length > 0) {
    throw new Error(`Invalid collections: ${invalid.join(", ")}`)
  }

  return Array.from(new Set(normalized))
}
