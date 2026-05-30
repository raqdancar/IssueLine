// Agrupa funcions compartides per accedir a dades i normalitzar informacio.
export const ISSUE_IMAGE_BUCKET = 'issue-images'
const ABSOLUTE_URL_REGEX = /^https?:\/\//i

const trimTrailingSlash = (value) => {
  if (!value) return value
  return value.replace(/\/+$/, '')
}

const trimLeadingSlash = (value) => {
  if (!value) return value
  return value.replace(/^\/+/, '')
}

const getRuntimeEnv = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    return import.meta.env[key]
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key]
  }
  return undefined
}

const getSupabaseBaseUrl = () => {
  return getRuntimeEnv('VITE_SUPABASE_URL') || getRuntimeEnv('NEXT_PUBLIC_SUPABASE_URL') || null
}

export const buildPublicStorageUrl = (value, bucketName = ISSUE_IMAGE_BUCKET) => {
  if (!value) return null
  const asString = String(value).trim()
  if (!asString) return null
  if (ABSOLUTE_URL_REGEX.test(asString)) {
    return asString
  }

  const baseUrl = getSupabaseBaseUrl()
  if (!baseUrl) return null
  const sanitizedBase = trimTrailingSlash(baseUrl)
  const sanitizedBucket = trimLeadingSlash(String(bucketName || ISSUE_IMAGE_BUCKET))
  const sanitizedPath = trimLeadingSlash(asString)
  return `${sanitizedBase}/storage/v1/object/public/${sanitizedBucket}/${sanitizedPath}`
}

export const buildIssueImageUrl = (relativePath) => {
  return buildPublicStorageUrl(relativePath, ISSUE_IMAGE_BUCKET)
}

export const resolveIssueCoverImage = (metadata = {}, fallbackImage = null) => {
  const storagePath = metadata.cover_image_path || metadata.coverImagePath
  const uploadedCover = buildIssueImageUrl(storagePath)
  return uploadedCover || metadata.cover || metadata.coverUrl || metadata.cover_url || fallbackImage || null
}

