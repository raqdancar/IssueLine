import { describe, expect, it, vi } from 'vitest'
import {
  AVATAR_BUCKET,
  createSignedAvatarUrl,
  extensionFromFile,
  hasOwnMetadataField,
  removeAvatarFiles,
  updateAccountMetadata,
  updateAccountPassword,
  uploadAvatarFile,
} from './accountApi'

describe('accountApi', () => {
  it('derives avatar file extensions from type or filename fallback', () => {
    expect(extensionFromFile({ type: 'image/png', name: 'avatar.anything' })).toBe('png')
    expect(extensionFromFile({ type: 'application/octet-stream', name: 'avatar.WEBP' })).toBe('webp')
    expect(extensionFromFile({ type: '', name: 'avatar' })).toBe('jpg')
  })

  it('checks metadata fields without being fooled by inherited properties', () => {
    const metadata = Object.create({ nickname: 'inherited' })
    metadata.fullName = ''

    expect(hasOwnMetadataField(metadata, 'fullName')).toBe(true)
    expect(hasOwnMetadataField(metadata, 'nickname')).toBe(false)
    expect(hasOwnMetadataField(null, 'fullName')).toBe(false)
  })

  it('wraps Supabase auth and storage calls with the expected bucket/options', () => {
    const createSignedUrl = vi.fn()
    const upload = vi.fn()
    const remove = vi.fn()
    const from = vi.fn(() => ({ createSignedUrl, upload, remove }))
    const updateUser = vi.fn()
    const supabaseClient = {
      auth: { updateUser },
      storage: { from },
    }
    const file = { type: 'image/webp', name: 'avatar.webp' }

    createSignedAvatarUrl({ supabaseClient, avatarPath: 'avatars/u1.webp' })
    uploadAvatarFile({ supabaseClient, path: 'avatars/u1.webp', file })
    removeAvatarFiles({ supabaseClient, paths: ['avatars/u1.webp'] })
    updateAccountMetadata({ supabaseClient, metadata: { fullName: 'Stephen' } })
    updateAccountPassword({ supabaseClient, password: 'secret-password' })

    expect(from).toHaveBeenCalledWith(AVATAR_BUCKET)
    expect(createSignedUrl).toHaveBeenCalledWith('avatars/u1.webp', 60 * 60 * 24)
    expect(upload).toHaveBeenCalledWith('avatars/u1.webp', file, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '3600',
    })
    expect(remove).toHaveBeenCalledWith(['avatars/u1.webp'])
    expect(updateUser).toHaveBeenCalledWith({ data: { fullName: 'Stephen' } })
    expect(updateUser).toHaveBeenCalledWith({ password: 'secret-password' })
  })
})
