import { useCallback, useEffect, useMemo, useState } from 'react'
import { Route, Routes, useMatch } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import AppHeader from '@/components/AppHeader'
import HeroTab from '@/components/HeroTab'
import Footer from '@/components/Footer'
import HeroDetail from '@/pages/HeroDetail'
import AccountSettings from '@/pages/AccountSettings'
import AuthDialog from '@/components/AuthDialog'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { SessionProvider } from '@/lib/sessionContext.jsx'
import { resolveHeroThemeStyle } from '@/lib/heroThemes'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const initialFormValues = {
  email: '',
  password: '',
  confirmPassword: '',
}

const statusClasses = {
  idle: 'text-slate-500',
  loading: 'text-slate-500',
  error: 'text-red-600',
  success: 'text-emerald-600',
}

function App() {
  const { t, locale, setLocale } = useI18n()
  const [formValues, setFormValues] = useState(initialFormValues)
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('sign-in')
  const [isAuthDialogOpen, setAuthDialogOpen] = useState(false)
  const [heroes, setHeroes] = useState([])
  const [heroesStatus, setHeroesStatus] = useState({ state: 'idle', message: '' })
  const [navAvatarUrl, setNavAvatarUrl] = useState(null)
  const heroRouteMatch = useMatch('/heroes/:slug')

  const loadHeroes = useCallback(async () => {
    if (!supabase) {
      setHeroes([])
      setHeroesStatus({
        state: 'idle',
        message: t('app.configureSupabaseToLoadHeroes'),
      })
      return
    }

    setHeroesStatus({ state: 'loading', message: t('app.loadingHeroes') })

    const [heroesResult, imagesResult] = await Promise.all([
      supabase.from('superheroes').select('*').order('name', { ascending: true }),
      supabase
        .from('hero_images')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ])

    if (heroesResult.error) {
      setHeroesStatus({ state: 'error', message: heroesResult.error.message })
      return
    }

    if (imagesResult.error) {
      setHeroesStatus({ state: 'error', message: imagesResult.error.message })
      return
    }

    const heroRows = heroesResult.data ?? []
    const heroApiIds = heroRows.map((hero) => hero.api_id).filter(Boolean)
    let heroesWithIssues = new Set()
    const heroCoverageById = new Map()

    const collectedEditionsCountByHeroId = new Map()

    if (heroApiIds.length) {
      const [timelineResult, collectedEditionsResult] = await Promise.all([
        supabase
          .from('hero_timelines')
          .select('hero_api_id, issue_date')
          .in('hero_api_id', heroApiIds),
        supabase
          .from('collected_editions')
          .select('hero_api_id')
          .in('hero_api_id', heroApiIds),
      ])

      if (timelineResult.error) {
        setHeroesStatus({ state: 'error', message: timelineResult.error.message })
        return
      }

      const rows = timelineResult.data ?? []
      heroesWithIssues = new Set(rows.map((row) => row.hero_api_id))

      rows.forEach((row) => {
        if (!row?.hero_api_id) return
        const current = heroCoverageById.get(row.hero_api_id) ?? {
          count: 0,
          startYear: null,
          endYear: null,
        }

        current.count += 1
        const parsedDate = row.issue_date ? new Date(row.issue_date) : null
        if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
          const year = parsedDate.getUTCFullYear()
          if (current.startYear === null || year < current.startYear) {
            current.startYear = year
          }
          if (current.endYear === null || year > current.endYear) {
            current.endYear = year
          }
        }

        heroCoverageById.set(row.hero_api_id, current)
      })

      if (collectedEditionsResult.error) {
        console.warn('Failed to load collected editions count for hero dashboard', collectedEditionsResult.error.message)
      } else {
        for (const row of collectedEditionsResult.data ?? []) {
          if (!row?.hero_api_id) continue
          const currentCount = collectedEditionsCountByHeroId.get(row.hero_api_id) ?? 0
          collectedEditionsCountByHeroId.set(row.hero_api_id, currentCount + 1)
        }
      }
    }

    const imagesByHero = (imagesResult.data ?? []).reduce((acc, image) => {
      if (!acc[image.hero_api_id]) {
        acc[image.hero_api_id] = []
      }
      acc[image.hero_api_id].push(image)
      return acc
    }, {})

    const enrichedHeroes = heroRows.map((hero) => ({
      ...hero,
      heroImages: imagesByHero[hero.api_id] ?? [],
      hasTimelineIssues: heroesWithIssues.has(hero.api_id),
      timelineCoverage: heroCoverageById.get(hero.api_id) ?? { count: 0, startYear: null, endYear: null },
      collectedEditionsCount: collectedEditionsCountByHeroId.get(hero.api_id) ?? 0,
    }))

    setHeroes(enrichedHeroes)
    setHeroesStatus({
      state: 'success',
      message: enrichedHeroes.length
        ? t('app.loadedHeroes', { count: enrichedHeroes.length })
        : t('app.noHeroesFound'),
    })
  }, [t])

  useEffect(() => {
    void loadHeroes()
  }, [loadHeroes])

  useEffect(() => {
    if (!supabase) return undefined

    let isMounted = true

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (isMounted) {
        setSession(data.session ?? null)
      }
    }

    void syncSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession)
      }
    })

    return () => {
      isMounted = false
      authListener?.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) {
      setNavAvatarUrl(null)
      return
    }

    const avatarPath = session.user.user_metadata?.avatar_path
    const avatarBucket =
      session.user.user_metadata?.avatar_bucket || import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || 'avatars'

    if (!avatarPath) {
      setNavAvatarUrl(null)
      return
    }

    let active = true

    const loadAvatar = async () => {
      const { data, error } = await supabase.storage.from(avatarBucket).createSignedUrl(avatarPath, 60 * 60 * 24)
      if (!active) return
      if (error) {
        setNavAvatarUrl(null)
        return
      }
      setNavAvatarUrl(data?.signedUrl ?? null)
    }

    void loadAvatar()

    return () => {
      active = false
    }
  }, [session])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormValues((previous) => ({ ...previous, [name]: value }))
  }

  const recordLoginAudit = async (user) => {
    const payload = {
      user_id: user.id,
      email: user.email,
      source: 'web_app',
      metadata: { last_sign_in: user.last_sign_in_at },
    }

    const { error } = await supabase.from('login_audit').insert([payload])

    if (error) {
      console.warn('Failed to record the access in login_audit', error.message)
    }
  }

  const handleSignIn = async () => {
    if (!supabase) return

    if (!formValues.email.trim() || !formValues.password.trim()) {
      setStatus({ state: 'error', message: t('app.emailPasswordRequired') })
      return
    }

    setSaving(true)
    setStatus({ state: 'loading', message: t('app.validatingCredentials') })

    const credentials = {
      email: formValues.email.trim().toLowerCase(),
      password: formValues.password,
    }

    const { data, error } = await supabase.auth.signInWithPassword(credentials)

    if (error) {
      setStatus({ state: 'error', message: error.message })
      setSaving(false)
      return
    }

    if (data.user) {
      setStatus({
        state: 'success',
        message: t('app.signedInAs', { email: data.user.email }),
      })
      setFormValues(initialFormValues)
      await recordLoginAudit(data.user)
      setAuthDialogOpen(false)
      setAuthMode('sign-in')
    }

    setSaving(false)
  }

  const handleSignUp = async () => {
    if (!supabase) return

    if (!formValues.email.trim() || !formValues.password.trim()) {
      setStatus({ state: 'error', message: t('app.emailPasswordRequired') })
      return
    }

    if (formValues.password !== formValues.confirmPassword) {
      setStatus({ state: 'error', message: t('app.passwordsDoNotMatch') })
      return
    }

    setSaving(true)
    setStatus({ state: 'loading', message: t('app.creatingAccount') })

    const credentials = {
      email: formValues.email.trim().toLowerCase(),
      password: formValues.password,
    }

    const { data, error } = await supabase.auth.signUp(credentials)

    if (error) {
      setStatus({ state: 'error', message: error.message })
      setSaving(false)
      return
    }

    if (data?.user) {
      setStatus({
        state: 'success',
        message: t('app.accountCreatedCheckInbox'),
      })
      setFormValues(initialFormValues)
      setAuthMode('sign-in')
    }

    setSaving(false)
  }

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setStatus({ state: 'idle', message: t('app.signedOut') })
  }

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
  const shellThemeStyle = useMemo(
    () => resolveHeroThemeStyle(heroRouteMatch?.params?.slug),
    [heroRouteMatch?.params?.slug],
  )

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
            <Route path="/heroes/:slug" element={<HeroDetail />} />
            <Route
              path="/account"
              element={
                <AccountSettings onRequireSignIn={openAuthDialog} />
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
