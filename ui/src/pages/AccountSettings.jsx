// Render the AccountSettings page container.
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { useAccountSettings } from '@/hooks/useAccountSettings.js'

function AccountSettings({ onRequireSignIn }) {
  const { t } = useI18n()
  const account = useAccountSettings({ t })
  const {
    isConfigured,
    isAuthenticated,
    user,
    avatarBucket,
    allowedAvatarTypes,
    profileForm,
    passwordForm,
    profileStatus,
    avatarStatus,
    passwordStatus,
    avatarPreview,
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
  } = account

  if (!isConfigured) {
    return (
      <section className="w-full rounded-[32px] border border-slate-100 bg-white/85 p-6 text-slate-700 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{t('common.account')}</p>
            <h2 className="title-md">{t('account.title')}</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/">{t('account.backToRoster')}</Link>
          </Button>
        </div>
        <p className="mt-4 body-sm">{t('account.supabaseHint')}</p>
      </section>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="w-full rounded-[32px] border border-slate-100 bg-white/85 p-6 text-slate-700 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{t('common.account')}</p>
            <h2 className="title-md">{t('account.title')}</h2>
            <p className="mt-2 body-sm">{t('account.signInHint')}</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">{t('account.backToRoster')}</Link>
          </Button>
        </div>
        <div className="mt-6">
          <Button type="button" onClick={onRequireSignIn}>
            {t('account.signIn')}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full rounded-[32px] border border-slate-100 bg-white/85 p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{t('common.account')}</p>
          <h2 className="title-md">{t('account.title')}</h2>
          <p className="mt-2 body-sm">{t('account.subtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">{t('account.backToRoster')}</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{t('account.profile')}</h3>
            <form className="mt-4 space-y-4" onSubmit={handleProfileSave}>
              <div className="space-y-2">
                <Label htmlFor="displayName">{t('account.displayName')}</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  value={profileForm.displayName}
                  onChange={handleProfileInputChange}
                  placeholder={t('account.displayNamePlaceholder')}
                />
              </div>
              {profileStatus.message ? (
                <p className={`text-sm ${profileStatus.type === 'error' ? 'text-rose-600' : profileStatus.type === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {profileStatus.message}
                </p>
              ) : null}
              <div className="pt-2">
                <div className="border-t border-slate-100 pt-4">
                  <Button type="submit" disabled={isSavingProfile} className="w-full sm:w-auto">
                    {isSavingProfile ? t('account.savingProfile') : t('account.saveProfile')}
                  </Button>
                </div>
              </div>
            </form>
          </article>

          <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">{t('account.password')}</h3>
            <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handlePasswordSave}>
              <div className="space-y-2">
                <Label htmlFor="nextPassword">{t('account.newPassword')}</Label>
                <Input id="nextPassword" name="nextPassword" type="password" value={passwordForm.nextPassword} onChange={handlePasswordInputChange} placeholder={t('account.passwordPlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('account.confirmNewPassword')}</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" value={passwordForm.confirmPassword} onChange={handlePasswordInputChange} placeholder={t('account.repeatPasswordPlaceholder')} />
              </div>
              {passwordStatus.message ? (
                <p className={`text-sm md:col-span-2 ${passwordStatus.type === 'error' ? 'text-rose-600' : passwordStatus.type === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {passwordStatus.message}
                </p>
              ) : null}
              <Button type="submit" disabled={isSavingPassword} className="md:col-span-2">
                {isSavingPassword ? t('account.updatingPassword') : t('account.updatePassword')}
              </Button>
            </form>
          </article>
        </div>

        <aside className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-5 xl:col-span-4">
          <h3 className="text-base font-semibold text-slate-900">{t('account.avatarUpload')}</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[auto,minmax(0,1fr)] sm:items-start">
            <div className="mx-auto h-32 w-32 overflow-hidden rounded-full border border-slate-200 bg-slate-100 sm:mx-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt={t('account.avatarPreviewAlt')} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {t('account.noAvatar')}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <p className="text-slate-500">{t('account.email')}</p>
                <p className="font-medium break-all text-slate-800">{user.email}</p>
                <p className="text-xs text-slate-500">{t('account.privateBucket', { bucket: avatarBucket })}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatarFile">{t('account.uploadFromDevice')}</Label>
                <Input id="avatarFile" name="avatarFile" type="file" accept={allowedAvatarTypes.join(',')} onChange={handleAvatarFileChange} />
                <p className="text-xs text-slate-500">{t('account.avatarRules')}</p>
              </div>
              {avatarStatus.message ? (
                <p className={`text-sm ${avatarStatus.type === 'error' ? 'text-rose-600' : avatarStatus.type === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {avatarStatus.message}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={isSavingAvatar || isDeletingAvatar} onClick={() => void handleAvatarUpload()}>
                  {isSavingAvatar ? t('account.uploadingAvatar') : t('account.uploadAvatar')}
                </Button>
                <Button type="button" variant="outline" className="border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800" disabled={!avatarPath || isSavingAvatar || isDeletingAvatar} onClick={() => void handleAvatarDelete()}>
                  {isDeletingAvatar ? t('account.deletingAvatar') : t('account.deleteAvatar')}
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default AccountSettings
