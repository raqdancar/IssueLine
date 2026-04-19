import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Languages, Menu, X } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function AppHeader({
  session,
  navAvatarUrl,
  onOpenAuthDialog,
  onSignOut,
  onOpenLanguageMenu,
  languageLabel = 'ES',
}) {
  const { t } = useI18n()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [session])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-900/95 px-4 py-3 text-slate-50 shadow-md backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <h1 className="m-0 shrink-0 text-lg font-semibold tracking-wide">
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="rounded-sm text-slate-50 transition hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {t('common.appName')}
          </Link>
        </h1>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 p-2 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 md:hidden"
          aria-label={isMobileMenuOpen ? t('header.closeMenu') : t('header.openMenu')}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-app-menu"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
        </button>

        <div className="hidden items-center justify-end gap-2 text-sm md:flex">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            aria-label={t('header.chooseLanguage')}
            onClick={onOpenLanguageMenu}
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            {languageLabel}
          </Button>
          {session ? (
            <>
              <img
                src={navAvatarUrl || '/vite.svg'}
                alt="User avatar"
                className="h-8 w-8 rounded-full border border-white/20 bg-white/10 object-cover p-0.5"
                loading="lazy"
              />
              <span className="hidden text-slate-200 sm:inline">{session.user.email}</span>
              <Button
                asChild
                type="button"
                size="sm"
                variant="outline"
                className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/account" onClick={closeMobileMenu}>{t('common.account')}</Link>
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={onSignOut}>
                {t('common.signOut')}
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs uppercase tracking-widest text-slate-400">{t('header.noActiveSession')}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                onClick={onOpenAuthDialog}
              >
                {t('header.signInSignUp')}
              </Button>
            </>
          )}
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div
          id="mobile-app-menu"
          className="mt-3 space-y-2 rounded-2xl border border-white/15 bg-slate-900/95 p-3 shadow-lg md:hidden"
        >
          {session ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <img
                  src={navAvatarUrl || '/vite.svg'}
                  alt="User avatar"
                  className="h-7 w-7 rounded-full border border-white/20 bg-white/10 object-cover p-0.5"
                  loading="lazy"
                />
                <span className="truncate text-sm text-slate-200">{session.user.email}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full justify-start border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                aria-label={t('header.chooseLanguage')}
                onClick={() => {
                  onOpenLanguageMenu?.()
                  closeMobileMenu()
                }}
              >
                <Languages className="h-4 w-4" aria-hidden="true" />
                {languageLabel}
              </Button>
              <Button
                asChild
                type="button"
                size="sm"
                variant="outline"
                className="w-full justify-start border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/account" onClick={closeMobileMenu}>{t('common.account')}</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full justify-start"
                onClick={() => {
                  onSignOut?.()
                  closeMobileMenu()
                }}
              >
                {t('common.signOut')}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full justify-start border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                aria-label={t('header.chooseLanguage')}
                onClick={() => {
                  onOpenLanguageMenu?.()
                  closeMobileMenu()
                }}
              >
                <Languages className="h-4 w-4" aria-hidden="true" />
                {languageLabel}
              </Button>
              <p className="text-xs uppercase tracking-widest text-slate-400">{t('header.noActiveSession')}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full justify-start border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                onClick={() => {
                  onOpenAuthDialog?.()
                  closeMobileMenu()
                }}
              >
                {t('header.signInSignUp')}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </header>
  )
}

export default AppHeader
