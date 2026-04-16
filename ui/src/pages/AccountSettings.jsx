import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'
import { useSessionContext } from '@/lib/sessionContext.jsx'

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || 'avatars'
const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const initialProfileForm = {
  displayName: '',
}

const initialPasswordForm = {
  nextPassword: '',
  confirmPassword: '',
}

const extensionFromFile = (file) => {
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

function AccountSettings({ onRequireSignIn }) {
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
  const userMetadata = user?.user_metadata ?? {}

  useEffect(() => {
    setProfileForm({
      displayName: userMetadata.display_name ?? userMetadata.full_name ?? '',
    })
    setAvatarPath(userMetadata.avatar_path ?? null)
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    setProfileStatus({ type: 'idle', message: '' })
    setAvatarStatus({ type: 'idle', message: '' })
    setPasswordForm(initialPasswordForm)
    setPasswordStatus({ type: 'idle', message: '' })
  }, [user?.id, userMetadata.display_name, userMetadata.full_name, userMetadata.avatar_path])

  useEffect(() => {
    if (!supabase || !user || !avatarPath) {
      setAvatarPreviewUrl(null)
      return
    }

    let active = true

    const loadSignedAvatar = async () => {
      const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath, 60 * 60 * 24)
      if (!active) return
      if (error) {
        setAvatarStatus({ type: 'error', message: `Avatar preview error: ${error.message}` })
        setAvatarPreviewUrl(null)
        return
      }
      setAvatarPreviewUrl(data?.signedUrl ?? null)
    }

    void loadSignedAvatar()

    return () => {
      active = false
    }
  }, [avatarPath, user?.id])

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
    setAvatarStatus({ type: 'idle', message: file ? `Selected: ${file.name}` : '' })
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()
    if (!supabase || !isAuthenticated) return

    setSavingProfile(true)
    setProfileStatus({ type: 'loading', message: 'Saving profile...' })

    const displayName = profileForm.displayName.trim()
    const { error } = await supabase.auth.updateUser({
      data: {
        ...userMetadata,
        display_name: displayName || null,
        full_name: displayName || null,
        avatar_path: avatarPath || null,
        avatar_bucket: avatarPath ? AVATAR_BUCKET : null,
      },
    })

    if (error) {
      setProfileStatus({ type: 'error', message: error.message })
      setSavingProfile(false)
      return
    }

    setProfileStatus({ type: 'success', message: 'Profile updated successfully.' })
    setSavingProfile(false)
  }

  const handleAvatarUpload = async () => {
    if (!supabase || !isAuthenticated || !user) return
    if (!avatarFile) {
      setAvatarStatus({ type: 'error', message: 'Select an image file first.' })
      return
    }

    if (!ALLOWED_AVATAR_TYPES.includes(avatarFile.type)) {
      setAvatarStatus({ type: 'error', message: 'Only JPG, PNG, WEBP, or GIF images are allowed.' })
      return
    }

    if (avatarFile.size > MAX_AVATAR_BYTES) {
      setAvatarStatus({ type: 'error', message: 'Avatar file must be 5MB or smaller.' })
      return
    }

    setSavingAvatar(true)
    setAvatarStatus({ type: 'loading', message: 'Uploading avatar...' })

    const ext = extensionFromFile(avatarFile)
    const nextPath = `${user.id}/avatar.${ext}`
    const previousPath = avatarPath

    if (previousPath && previousPath !== nextPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
    }

    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(nextPath, avatarFile, {
      upsert: true,
      contentType: avatarFile.type,
      cacheControl: '3600',
    })

    if (uploadError) {
      setAvatarStatus({ type: 'error', message: uploadError.message })
      setSavingAvatar(false)
      return
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
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

    const { data: signedData, error: signedError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(nextPath, 60 * 60 * 24)

    if (signedError) {
      setAvatarStatus({ type: 'error', message: `Uploaded, but preview failed: ${signedError.message}` })
      setAvatarPath(nextPath)
      setAvatarFile(null)
      setSavingAvatar(false)
      return
    }

    setAvatarPath(nextPath)
    setAvatarPreviewUrl(signedData?.signedUrl ?? null)
    setAvatarFile(null)
    setAvatarStatus({ type: 'success', message: 'Avatar uploaded and saved.' })
    setSavingAvatar(false)
  }

  const handleAvatarDelete = async () => {
    if (!supabase || !isAuthenticated || !user) return
    if (!avatarPath) {
      setAvatarStatus({ type: 'error', message: 'There is no avatar to delete.' })
      return
    }

    setDeletingAvatar(true)
    setAvatarStatus({ type: 'loading', message: 'Deleting avatar...' })

    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath])
    if (removeError) {
      setAvatarStatus({ type: 'error', message: removeError.message })
      setDeletingAvatar(false)
      return
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
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
    setAvatarStatus({ type: 'success', message: 'Avatar deleted.' })
    setDeletingAvatar(false)
  }

  const handlePasswordSave = async (event) => {
    event.preventDefault()
    if (!supabase || !isAuthenticated) return

    const nextPassword = passwordForm.nextPassword.trim()
    const confirmPassword = passwordForm.confirmPassword.trim()

    if (!nextPassword) {
      setPasswordStatus({ type: 'error', message: 'Please enter your new password.' })
      return
    }

    if (nextPassword.length < 8) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 8 characters long.' })
      return
    }

    if (nextPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Password confirmation does not match.' })
      return
    }

    setSavingPassword(true)
    setPasswordStatus({ type: 'loading', message: 'Updating password...' })

    const { error } = await supabase.auth.updateUser({ password: nextPassword })

    if (error) {
      setPasswordStatus({ type: 'error', message: error.message })
      setSavingPassword(false)
      return
    }

    setPasswordForm(initialPasswordForm)
    setPasswordStatus({ type: 'success', message: 'Password updated successfully.' })
    setSavingPassword(false)
  }

  const avatarPreview = useMemo(() => avatarPreviewUrl, [avatarPreviewUrl])

  if (!isSupabaseConfigured || !supabase) {
    return (
      <section className="w-full rounded-[32px] border border-slate-100 bg-white/85 p-6 text-slate-700 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Account</p>
            <h2 className="title-md">Account settings</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back to roster</Link>
          </Button>
        </div>
        <p className="mt-4 body-sm">
          Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to manage user settings.
        </p>
      </section>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="w-full rounded-[32px] border border-slate-100 bg-white/85 p-6 text-slate-700 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Account</p>
            <h2 className="title-md">Account settings</h2>
            <p className="mt-2 body-sm">Sign in first to manage your profile, avatar, and password.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back to roster</Link>
          </Button>
        </div>
        <div className="mt-6">
          <Button type="button" onClick={onRequireSignIn}>
            Sign in
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full rounded-[32px] border border-slate-100 bg-white/85 p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Account</p>
          <h2 className="title-md">Account settings</h2>
          <p className="mt-2 body-sm">Manage your display name, private avatar image, and password.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Back to roster</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="rounded-3xl border border-slate-100 bg-white/80 p-5 shadow-sm lg:col-span-4 xl:col-span-3 xl:sticky xl:top-24">
          <div className="mx-auto h-36 w-36 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Profile avatar preview"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-widest text-slate-400">
                No avatar
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-slate-500">Email</p>
            <p className="font-medium text-slate-800">{user.email}</p>
            <p className="text-xs text-slate-500">Private bucket: {AVATAR_BUCKET}</p>
          </div>
        </aside>

        <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-8 xl:col-span-5">
          <h3 className="text-base font-semibold text-slate-900">Profile</h3>
          <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleProfileSave}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                name="displayName"
                value={profileForm.displayName}
                onChange={handleProfileInputChange}
                placeholder="Stephen Strange"
              />
            </div>
            {profileStatus.message ? (
              <p
                className={`text-sm md:col-span-2 ${
                  profileStatus.type === 'error'
                    ? 'text-rose-600'
                    : profileStatus.type === 'success'
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                }`}
              >
                {profileStatus.message}
              </p>
            ) : null}
            <Button type="submit" disabled={isSavingProfile} className="md:col-span-2">
              {isSavingProfile ? 'Saving...' : 'Save profile'}
            </Button>
          </form>
        </article>

        <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-6 xl:col-span-4">
          <h3 className="text-base font-semibold text-slate-900">Avatar upload</h3>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="avatarFile">Upload from your device</Label>
              <Input
                id="avatarFile"
                name="avatarFile"
                type="file"
                accept={ALLOWED_AVATAR_TYPES.join(',')}
                onChange={handleAvatarFileChange}
              />
              <p className="text-xs text-slate-500">Allowed: JPG, PNG, WEBP, GIF. Max: 5MB.</p>
            </div>
            {avatarStatus.message ? (
              <p
                className={`text-sm ${
                  avatarStatus.type === 'error'
                    ? 'text-rose-600'
                    : avatarStatus.type === 'success'
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                }`}
              >
                {avatarStatus.message}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={isSavingAvatar || isDeletingAvatar}
                onClick={() => void handleAvatarUpload()}
              >
                {isSavingAvatar ? 'Uploading...' : 'Upload avatar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
                disabled={!avatarPath || isSavingAvatar || isDeletingAvatar}
                onClick={() => void handleAvatarDelete()}
              >
                {isDeletingAvatar ? 'Deleting...' : 'Delete avatar'}
              </Button>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-12">
          <h3 className="text-base font-semibold text-slate-900">Password</h3>
          <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handlePasswordSave}>
            <div className="space-y-2">
              <Label htmlFor="nextPassword">New password</Label>
              <Input
                id="nextPassword"
                name="nextPassword"
                type="password"
                value={passwordForm.nextPassword}
                onChange={handlePasswordInputChange}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordInputChange}
                placeholder="Repeat your new password"
              />
            </div>
            {passwordStatus.message ? (
              <p
                className={`text-sm md:col-span-2 ${
                  passwordStatus.type === 'error'
                    ? 'text-rose-600'
                    : passwordStatus.type === 'success'
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                }`}
              >
                {passwordStatus.message}
              </p>
            ) : null}
            <Button type="submit" disabled={isSavingPassword} className="md:col-span-2">
              {isSavingPassword ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </article>
      </div>
    </section>
  )
}

export default AccountSettings
