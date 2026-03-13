export const ISSUE_IMAGE_BUCKET = 'issue-images'

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

export const buildIssueImageUrl = (relativePath) => {
  if (!relativePath) return null
  const baseUrl = getSupabaseBaseUrl()
  if (!baseUrl) return null
  const sanitizedBase = trimTrailingSlash(baseUrl)
  const sanitizedPath = trimLeadingSlash(String(relativePath))
  return `${sanitizedBase}/storage/v1/object/public/${ISSUE_IMAGE_BUCKET}/${sanitizedPath}`
}

export const resolveIssueCoverImage = (metadata = {}, fallbackImage = null) => {
  const storagePath = metadata.cover_image_path || metadata.coverImagePath
  const uploadedCover = buildIssueImageUrl(storagePath)
  return uploadedCover || metadata.cover || metadata.coverUrl || metadata.cover_url || fallbackImage || null
}
