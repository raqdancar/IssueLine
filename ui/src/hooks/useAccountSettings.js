// State and side effects for the account settings page.
import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import {
  ALLOWED_AVATAR_TYPES,
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  createSignedAvatarUrl,
  extensionFromFile,
  hasOwnMetadataField,
  removeAvatarFiles,
  updateAccountMetadata,
  updateAccountPassword,
  uploadAvatarFile,
} from '@/lib/accountApi.js'

const initialProfileForm = {
  displayName: '',
}

const initialPasswordForm = {
  nextPassword: '',
  confirmPassword: '',
}

export const useAccountSettings = ({ t }) => {
  const { session, isAuthenticated } = useSessionContext()
  const [profileForm, setProfileForm] = useState(initialProfileForm)
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm)
  const [profileStatus, setProfileStatus] = useState({ type: 'idle', message: '' })
  const [avatarStatus, setAvatarStatus] = useState({ type: 'idle', message: '' })
  const [passwordStatus, setPasswordStatus] = useState({ type: 'idle', message: '' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null)
  const [avatarPath, setAvatarPath] = useState(null)
  const [isSavingProfile, setSavingProfile] = useState(false)
  const [isSavingAvatar, setSavingAvatar] = useState(false)
  const [isDeletingAvatar, setDeletingAvatar] = useState(false)
  const [isSavingPassword, setSavingPassword] = useState(false)

  const user = session?.user ?? null
  const userMetadata = useMemo(() => user?.user_metadata ?? {}, [user?.user_metadata])

  useEffect(() => {
    setProfileForm({
      displayName: userMetadata.display_name ?? userMetadata.full_name ?? '',
    })
    setProfileStatus({ type: 'idle', message: '' })
    setPasswordForm(initialPasswordForm)
    setPasswordStatus({ type: 'idle', message: '' })
  }, [user?.id, userMetadata.display_name, userMetadata.full_name])

  useEffect(() => {
    if (!user) {
      setAvatarPath(null)
      setAvatarFile(null)
      setAvatarPreviewUrl(null)
      setAvatarStatus({ type: 'idle', message: '' })
      return
    }

    if (hasOwnMetadataField(userMetadata, 'avatar_path')) {
      setAvatarPath(userMetadata.avatar_path ?? null)
    }

    setAvatarFile(null)
    setAvatarStatus({ type: 'idle', message: '' })
  }, [user, userMetadata])

  useEffect(() => {
    if (!supabase || !user || !avatarPath) {
      setAvatarPreviewUrl(null)
      return
    }

    let active = true

    const loadSignedAvatar = async () => {
      const { data, error } = await createSignedAvatarUrl({ supabaseClient: supabase, avatarPath })
      if (!active) return
      if (error) {
        setAvatarStatus({ type: 'error', message: t('account.avatarPreviewError', { message: error.message }) })
        setAvatarPreviewUrl(null)
        return
      }
      setAvatarPreviewUrl(data?.signedUrl ?? null)
    }

    void loadSignedAvatar()

    return () => {
      active = false
    }
  }, [avatarPath, t, user])

  const handleProfileInputChange = (event) => {
    const { name, value } = event.target
    setProfileForm((previous) => ({ ...previous, [name]: value }))
  }

  const handlePasswordInputChange = (event) => {
    const { name, value } = event.target
    setPasswordForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0] ?? null
    setAvatarFile(file)
    setAvatarStatus({ type: 'idle', message: file ? t('account.selectedFile', { name: file.name }) : '' })
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()
    if (!supabase || !isAuthenticated) return

    setSavingProfile(true)
    setProfileStatus({ type: 'loading', message: t('account.savingProfileStatus') })

    const displayName = profileForm.displayName.trim()
    const avatarPathToPersist = avatarPath ?? userMetadata.avatar_path ?? null
    const avatarBucketToPersist = avatarPathToPersist ? userMetadata.avatar_bucket ?? AVATAR_BUCKET : null
    const { error } = await updateAccountMetadata({
      supabaseClient: supabase,
      metadata: {
        ...userMetadata,
        display_name: displayName || null,
        full_name: displayName || null,
        avatar_path: avatarPathToPersist,
        avatar_bucket: avatarBucketToPersist,
      },
    })

    if (error) {
      setProfileStatus({ type: 'error', message: error.message })
      setSavingProfile(false)
      return
    }

    setProfileStatus({ type: 'success', message: t('account.profileUpdated') })
    setSavingProfile(false)
  }

  const handleAvatarUpload = async () => {
    if (!supabase || !isAuthenticated || !user) return
    if (!avatarFile) {
      setAvatarStatus({ type: 'error', message: t('account.selectImageFirst') })
      return
    }

    if (!ALLOWED_AVATAR_TYPES.includes(avatarFile.type)) {
      setAvatarStatus({ type: 'error', message: t('account.allowedTypesOnly') })
      return
    }

    if (avatarFile.size > MAX_AVATAR_BYTES) {
      setAvatarStatus({ type: 'error', message: t('account.maxAvatarSize') })
      return
    }

    setSavingAvatar(true)
    setAvatarStatus({ type: 'loading', message: t('account.uploadingAvatarStatus') })

    const ext = extensionFromFile(avatarFile)
    const nextPath = `${user.id}/avatar.${ext}`
    const previousPath = avatarPath

    if (previousPath && previousPath !== nextPath) {
      await removeAvatarFiles({ supabaseClient: supabase, paths: [previousPath] })
    }

    const { error: uploadError } = await uploadAvatarFile({ supabaseClient: supabase, path: nextPath, file: avatarFile })

    if (uploadError) {
      setAvatarStatus({ type: 'error', message: uploadError.message })
      setSavingAvatar(false)
      return
    }

    const { error: metadataError } = await updateAccountMetadata({
      supabaseClient: supabase,
      metadata: {
        ...userMetadata,
        avatar_path: nextPath,
        avatar_bucket: AVATAR_BUCKET,
      },
    })

    if (metadataError) {
      setAvatarStatus({ type: 'error', message: metadataError.message })
      setSavingAvatar(false)
      return
    }

    const { data: signedData, error: signedError } = await createSignedAvatarUrl({
      supabaseClient: supabase,
      avatarPath: nextPath,
    })

    if (signedError) {
      setAvatarStatus({ type: 'error', message: t('account.uploadedButPreviewFailed', { message: signedError.message }) })
      setAvatarPath(nextPath)
      setAvatarFile(null)
      setSavingAvatar(false)
      return
    }

    setAvatarPath(nextPath)
    setAvatarPreviewUrl(signedData?.signedUrl ?? null)
    setAvatarFile(null)
    setAvatarStatus({ type: 'success', message: t('account.avatarUploadedAndSaved') })
    setSavingAvatar(false)
  }

  const handleAvatarDelete = async () => {
    if (!supabase || !isAuthenticated || !user) return
    if (!avatarPath) {
      setAvatarStatus({ type: 'error', message: t('account.noAvatarToDelete') })
      return
    }

    setDeletingAvatar(true)
    setAvatarStatus({ type: 'loading', message: t('account.deletingAvatarStatus') })

    const { error: removeError } = await removeAvatarFiles({ supabaseClient: supabase, paths: [avatarPath] })
    if (removeError) {
      setAvatarStatus({ type: 'error', message: removeError.message })
      setDeletingAvatar(false)
      return
    }

    const { error: metadataError } = await updateAccountMetadata({
      supabaseClient: supabase,
      metadata: {
        ...userMetadata,
        avatar_path: null,
        avatar_bucket: null,
      },
    })

    if (metadataError) {
      setAvatarStatus({ type: 'error', message: metadataError.message })
      setDeletingAvatar(false)
      return
    }

    setAvatarPath(null)
    setAvatarPreviewUrl(null)
    setAvatarFile(null)
    setAvatarStatus({ type: 'success', message: t('account.avatarDeleted') })
    setDeletingAvatar(false)
  }

  const handlePasswordSave = async (event) => {
    event.preventDefault()
    if (!supabase || !isAuthenticated) return

    const nextPassword = passwordForm.nextPassword.trim()
    const confirmPassword = passwordForm.confirmPassword.trim()

    if (!nextPassword) {
      setPasswordStatus({ type: 'error', message: t('account.enterNewPassword') })
      return
    }

    if (nextPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: t('account.passwordMinLength') })
      return
    }

    if (nextPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: t('account.passwordConfirmationMismatch') })
      return
    }

    setSavingPassword(true)
    setPasswordStatus({ type: 'loading', message: t('account.updatingPasswordStatus') })

    const { error } = await updateAccountPassword({ supabaseClient: supabase, password: nextPassword })

    if (error) {
      setPasswordStatus({ type: 'error', message: error.message })
      setSavingPassword(false)
      return
    }

    setPasswordForm(initialPasswordForm)
    setPasswordStatus({ type: 'success', message: t('account.passwordUpdated') })
    setSavingPassword(false)
  }

  return {
    isConfigured: Boolean(isSupabaseConfigured && supabase),
    isAuthenticated,
    user,
    avatarBucket: AVATAR_BUCKET,
    allowedAvatarTypes: ALLOWED_AVATAR_TYPES,
    profileForm,
    passwordForm,
    profileStatus,
    avatarStatus,
    passwordStatus,
    avatarPreview: avatarPreviewUrl,
    avatarPath,
    isSavingProfile,
    isSavingAvatar,
    isDeletingAvatar,
    isSavingPassword,
    handleProfileInputChange,
    handlePasswordInputChange,
    handleAvatarFileChange,
    handleProfileSave,
    handleAvatarUpload,
    handleAvatarDelete,
    handlePasswordSave,
  }
}
