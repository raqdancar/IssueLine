import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import HeroTab from '@/components/HeroTab'
import Footer from '@/components/Footer'
import HeroDetail from '@/pages/HeroDetail'
import AccountSettings from '@/pages/AccountSettings'
import AuthDialog from '@/components/AuthDialog'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { SessionProvider } from '@/lib/sessionContext.jsx'

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
  const [formValues, setFormValues] = useState(initialFormValues)
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('sign-in')
  const [isAuthDialogOpen, setAuthDialogOpen] = useState(false)
  const [heroes, setHeroes] = useState([])
  const [heroesStatus, setHeroesStatus] = useState({ state: 'idle', message: '' })
  const [navAvatarUrl, setNavAvatarUrl] = useState(null)

  const loadHeroes = useCallback(async () => {
    if (!supabase) {
      setHeroes([])
      setHeroesStatus({
        state: 'idle',
        message: 'Configure Supabase to load heroes.',
      })
      return
    }

    setHeroesStatus({ state: 'loading', message: 'Loading heroes...' })

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

    const imagesByHero = (imagesResult.data ?? []).reduce((acc, image) => {
      if (!acc[image.hero_api_id]) {
        acc[image.hero_api_id] = []
      }
      acc[image.hero_api_id].push(image)
      return acc
    }, {})

    const enrichedHeroes = (heroesResult.data ?? []).map((hero) => ({
      ...hero,
      heroImages: imagesByHero[hero.api_id] ?? [],
    }))

    setHeroes(enrichedHeroes)
    setHeroesStatus({
      state: 'success',
      message: enrichedHeroes.length ? `Loaded ${enrichedHeroes.length} heroes.` : 'No heroes found.',
    })
  }, [supabase])

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

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (isMounted) {
          setSession(nextSession)
        }
      }
    )

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
      setStatus({ state: 'error', message: 'Email and password are required.' })
      return
    }

    setSaving(true)
    setStatus({ state: 'loading', message: 'Validating credentials…' })

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
        message: `Signed in as ${data.user.email}`,
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
      setStatus({ state: 'error', message: 'Email and password are required.' })
      return
    }

    if (formValues.password !== formValues.confirmPassword) {
      setStatus({ state: 'error', message: 'Passwords do not match.' })
      return
    }

    setSaving(true)
    setStatus({ state: 'loading', message: 'Creating account…' })

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
        message: 'Account created. Check your inbox to confirm your email.',
      })
      setFormValues(initialFormValues)
      setAuthMode('sign-in')
    }

    setSaving(false)
  }

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setStatus({ state: 'idle', message: 'Signed out.' })
  }

  const sessionContextValue = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session),
    }),
    [session],
  )

  return (
    <SessionProvider value={sessionContextValue}>
      <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-900/95 px-4 py-3 text-slate-50 shadow-md backdrop-blur">
        <h1 className="m-0 text-lg font-semibold tracking-wide">IssueLine</h1>
        <div className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <img
                src={navAvatarUrl || '/vite.svg'}
                alt="User avatar"
                className="h-8 w-8 rounded-full border border-white/20 bg-white/10 object-cover p-0.5"
                loading="lazy"
              />
              <span className="hidden text-slate-200 sm:inline">{session.user.email}</span>
              <Button asChild type="button" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
                <Link to="/account">Account</Link>
              </Button>
              <Button type="button" variant="secondary" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <span className="text-xs uppercase tracking-widest text-slate-400">
              No active session
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            onClick={() => {
              setAuthMode('sign-in')
              setAuthDialogOpen(true)
            }}
          >
            Sign in / Sign up
          </Button>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 xl:px-16 2xl:px-24">
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
              <AccountSettings
                onRequireSignIn={() => {
                  setAuthMode('sign-in')
                  setAuthDialogOpen(true)
                }}
              />
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
  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Hero visualizer</h2>
          <p className="mt-2 text-sm text-slate-600">
            {heroesStatus.state === 'success'
              ? `Showing ${heroes.length} curated heroes stored in Supabase.`
              : 'Connect to Supabase and seed your roster to visualize it here.'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadHeroes()}
          disabled={heroesStatus.state === 'loading'}
        >
          {heroesStatus.state === 'loading' ? 'Refreshing...' : 'Refresh heroes'}
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
          <p className="text-sm text-slate-500">Loading heroes...</p>
        ) : heroes.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {heroes.map((hero) => (
              <HeroTab key={hero.api_id} hero={hero} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No heroes found. Run <code>npm run seed:superheroes</code> to populate the cache.
          </p>
        )}
      </div>
    </section>
  )
}

function EnvironmentNotice() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow">
      <h2 className="text-lg font-semibold">Pending environment variables</h2>
      <p className="mt-2 text-sm">
        Copy <code>.env.example</code> to <code>.env</code> and add your <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> values.
      </p>
    </section>
  )
}

export default App


