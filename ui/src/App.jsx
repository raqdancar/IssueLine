// Compose the main frontend application shell and route views.
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Route, Routes, useMatch } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import AppHeader from '@/components/AppHeader'
import HeroTab from '@/components/HeroTab'
import Footer from '@/components/Footer'
import AuthDialog from '@/components/AuthDialog'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { SessionProvider } from '@/lib/sessionContext.jsx'
import { resolveHeroThemeStyle } from '@/lib/heroThemes'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { useHeroesCatalog } from '@/hooks/useHeroesCatalog.js'
import { useSupabaseSession } from '@/hooks/useSupabaseSession.js'
import { useAuthActions } from '@/hooks/useAuthActions.js'

const HeroDetail = lazy(() => import('@/pages/HeroDetail'))
const AccountSettings = lazy(() => import('@/pages/AccountSettings'))

const statusClasses = {
  idle: 'text-slate-500',
  loading: 'text-slate-500',
  error: 'text-red-600',
  success: 'text-emerald-600',
}

const formatSlugTitle = (slug) =>
  decodeURIComponent(slug)
    .split('-')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')

function App() {
  const { t, locale, setLocale } = useI18n()
  const [authMode, setAuthMode] = useState('sign-in')
  const [isAuthDialogOpen, setAuthDialogOpen] = useState(false)
  const { session, navAvatarUrl } = useSupabaseSession()
  const { heroes, heroesStatus, loadHeroes } = useHeroesCatalog({ t })
  const heroRouteMatch = useMatch('/heroes/:slug')
  const heroSlug = heroRouteMatch?.params?.slug ?? null
  const isAccountRoute = Boolean(useMatch('/account'))
  const handleSignedIn = useCallback(() => {
    setAuthDialogOpen(false)
    setAuthMode('sign-in')
  }, [])
  const handleSignUpSuccess = useCallback(() => {
    setAuthMode('sign-in')
  }, [])
  const { formValues, status, saving, handleChange, handleSignIn, handleSignUp, handleSignOut } = useAuthActions({
    t,
    onSignedIn: handleSignedIn,
    onSignUpSuccess: handleSignUpSuccess,
  })

  const openAuthDialog = useCallback(() => {
    setAuthMode('sign-in')
    setAuthDialogOpen(true)
  }, [])

  const handleLanguageSelect = useCallback(
    (nextLocale) => {
      setLocale(nextLocale)
    },
    [setLocale],
  )

  const sessionContextValue = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session),
    }),
    [session],
  )
  const shellThemeStyle = useMemo(() => resolveHeroThemeStyle(heroSlug), [heroSlug])
  const heroTitle = heroSlug ? formatSlugTitle(heroSlug) : null
  const documentTitle = useMemo(() => {
    const appName = t('common.appName')
    if (heroTitle) return `${appName} | ${heroTitle}`
    if (isAccountRoute) return `${appName} | ${t('common.account')}`
    return `${appName} | ${t('app.heroVisualizer')}`
  }, [heroTitle, isAccountRoute, t])
  const routeFallback = <p className="body-sm text-slate-500">{t('common.loading')}</p>

  useEffect(() => {
    document.title = documentTitle
  }, [documentTitle])

  return (
    <SessionProvider value={sessionContextValue}>
      <div
        style={shellThemeStyle}
        className="theme-shell flex min-h-screen flex-col overflow-x-hidden bg-slate-100 text-slate-900"
      >
        <AppHeader
          session={session}
          navAvatarUrl={navAvatarUrl}
          onOpenAuthDialog={openAuthDialog}
          onSignOut={handleSignOut}
          onSelectLanguage={handleLanguageSelect}
          currentLocale={locale}
          languageLabel={locale.toUpperCase()}
        />

        <main className="flex w-full flex-1 flex-col gap-6 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-10 xl:px-16 2xl:px-24">
          <Routes>
            <Route
              path="/"
              element={
                <HeroDashboard
                  heroes={heroes}
                  heroesStatus={heroesStatus}
                  loadHeroes={loadHeroes}
                  status={status}
                />
              }
            />
            <Route
              path="/heroes/:slug"
              element={
                <Suspense fallback={routeFallback}>
                  <HeroDetail />
                </Suspense>
              }
            />
            <Route
              path="/account"
              element={
                <Suspense fallback={routeFallback}>
                  <AccountSettings onRequireSignIn={openAuthDialog} />
                </Suspense>
              }
            />
          </Routes>

          {!isSupabaseConfigured && <EnvironmentNotice />}
        </main>

        <Footer />
      </div>
      <AuthDialog
        open={isAuthDialogOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={() => setAuthDialogOpen(false)}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        formValues={formValues}
        onChange={handleChange}
        status={status}
        saving={saving}
        isConfigured={isSupabaseConfigured}
      />
    </SessionProvider>
  )
}

function HeroDashboard({ heroes, heroesStatus, loadHeroes, status }) {
  const { t } = useI18n()

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('app.heroVisualizer')}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {heroesStatus.state === 'success'
              ? t('app.showingCuratedHeroes', { count: heroes.length })
              : t('app.connectSupabaseAndSeed')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadHeroes()}
          disabled={heroesStatus.state === 'loading'}
        >
          {heroesStatus.state === 'loading' ? t('app.refreshing') : t('app.refreshHeroes')}
        </Button>
      </div>
      {status.message ? (
        <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${statusClasses[status.state]}`}>
          {status.message}
        </p>
      ) : null}
      <div className="mt-6">
        {heroesStatus.state === 'error' ? (
          <p className="text-sm text-red-600">{heroesStatus.message}</p>
        ) : heroesStatus.state === 'loading' ? (
          <p className="text-sm text-slate-500">{t('app.loadingHeroes')}</p>
        ) : heroes.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {heroes.map((hero) => (
              <HeroTab key={hero.api_id} hero={hero} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('app.noHeroesSeedHint')}</p>
        )}
      </div>
    </section>
  )
}

function EnvironmentNotice() {
  const { t } = useI18n()

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow">
      <h2 className="text-lg font-semibold">{t('app.pendingEnvVars')}</h2>
      <p className="mt-2 text-sm">{t('app.envVarsHint')}</p>
    </section>
  )
}

export default App
