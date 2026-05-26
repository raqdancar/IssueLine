// Compose the main frontend application shell and route views.
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom'
import AppHeader from '@/components/AppHeader'
import Footer from '@/components/Footer'
import AuthDialog from '@/components/AuthDialog'
import StorageNotice from '@/components/StorageNotice'
import { isSupabaseConfigured } from '@/lib/supabaseClient'
import { SessionProvider } from '@/lib/sessionContext.jsx'
import { resolveHeroThemeStyle } from '@/lib/heroThemes'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { useHeroesCatalog } from '@/hooks/useHeroesCatalog.js'
import { useSupabaseSession } from '@/hooks/useSupabaseSession.js'
import { useAuthActions } from '@/hooks/useAuthActions.js'

const HomePage = lazy(() => import('@/pages/HomePage'))
const HeroDetail = lazy(() => import('@/pages/HeroDetail'))
const AccountSettings = lazy(() => import('@/pages/AccountSettings'))
const AuthVerified = lazy(() => import('@/pages/AuthVerified'))
const StoragePolicy = lazy(() => import('@/pages/StoragePolicy'))

const formatSlugTitle = (slug) =>
  decodeURIComponent(slug)
    .split('-')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')

function App() {
  const { t, locale, setLocale } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [authMode, setAuthMode] = useState('sign-in')
  const [isAuthDialogOpen, setAuthDialogOpen] = useState(false)
  const { session, navAvatarUrl } = useSupabaseSession()
  const { heroes, heroesStatus } = useHeroesCatalog({ t })
  const heroRouteMatch = useMatch('/heroes/:slug')
  const heroSlug = heroRouteMatch?.params?.slug ?? null
  const isAccountRoute = Boolean(useMatch('/account'))
  const isAuthVerifiedRoute = Boolean(useMatch('/auth/verified'))
  const isPrivacyRoute = Boolean(useMatch('/privacy'))
  const isHomeRoute = Boolean(useMatch({ path: '/', end: true }))
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
    if (isAuthVerifiedRoute) return `${appName} | ${t('authVerified.title')}`
    if (isPrivacyRoute) return `${appName} | ${t('privacy.title')}`
    return `${appName} | ${t('app.heroVisualizer')}`
  }, [heroTitle, isAccountRoute, isAuthVerifiedRoute, isPrivacyRoute, t])
  const routeFallback = <p className="body-sm text-slate-500">{t('common.loading')}</p>

  useEffect(() => {
    document.title = documentTitle
  }, [documentTitle])

  useEffect(() => {
    if (location.pathname !== '/' || !location.hash) return

    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''))
    const hasSupabaseAuthHash =
      hashParams.has('access_token') ||
      hashParams.has('refresh_token') ||
      hashParams.has('error') ||
      hashParams.has('error_description')

    if (hasSupabaseAuthHash) {
      navigate(
        {
          pathname: '/auth/verified',
          hash: location.hash,
        },
        { replace: true },
      )
    }
  }, [location.hash, location.pathname, navigate])

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

        <main
          className={
            isHomeRoute
              ? 'flex w-full flex-1 flex-col overflow-x-hidden'
              : 'flex w-full min-w-0 flex-1 flex-col gap-6 overflow-x-hidden px-3 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-16 2xl:px-24'
          }
        >
          <Routes>
            <Route
              path="/"
              element={
                <Suspense fallback={routeFallback}>
                  <HomePage heroes={heroes} heroesStatus={heroesStatus} authStatus={status} />
                </Suspense>
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
            <Route
              path="/auth/verified"
              element={
                <Suspense fallback={routeFallback}>
                  <AuthVerified onSignInClick={openAuthDialog} />
                </Suspense>
              }
            />
            <Route
              path="/privacy"
              element={
                <Suspense fallback={routeFallback}>
                  <StoragePolicy />
                </Suspense>
              }
            />
          </Routes>

          {!isSupabaseConfigured && (
            <div className={isHomeRoute ? 'px-4 pb-10 sm:px-6 lg:px-10 xl:px-16 2xl:px-24' : ''}>
              <EnvironmentNotice />
            </div>
          )}
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
      <StorageNotice />
    </SessionProvider>
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
