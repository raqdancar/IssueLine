// Account settings API helpers around Supabase Auth and Storage.
export const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || 'avatars'
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const extensionFromFile = (file) => {
  const byType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  if (byType[file.type]) return byType[file.type]
  const parts = file.name.split('.')
  return parts.length > 1 ? parts.at(-1).toLowerCase() : 'jpg'
}

export const hasOwnMetadataField = (metadata, key) => Object.prototype.hasOwnProperty.call(metadata ?? {}, key)

export const createSignedAvatarUrl = ({ supabaseClient, avatarPath }) =>
  supabaseClient.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath, 60 * 60 * 24)

export const updateAccountMetadata = ({ supabaseClient, metadata }) =>
  supabaseClient.auth.updateUser({ data: metadata })

export const uploadAvatarFile = ({ supabaseClient, path, file }) =>
  supabaseClient.storage.from(AVATAR_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })

export const removeAvatarFiles = ({ supabaseClient, paths }) =>
  supabaseClient.storage.from(AVATAR_BUCKET).remove(paths)

export const updateAccountPassword = ({ supabaseClient, password }) =>
  supabaseClient.auth.updateUser({ password })
