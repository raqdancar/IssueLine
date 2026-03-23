import { useCallback, useEffect, useMemo, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import HeroTab from '@/components/HeroTab'
import HeroDetail from '@/pages/HeroDetail'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'

const initialFormValues = {
  email: '',
  password: '',
}

const statusClasses = {
  idle: 'text-slate-500',
  loading: 'text-slate-500',
  error: 'text-red-600',
  success: 'text-emerald-600',
}

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not available'

function App() {
  const [formValues, setFormValues] = useState(initialFormValues)
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [heroes, setHeroes] = useState([])
  const [heroesStatus, setHeroesStatus] = useState({ state: 'idle', message: '' })

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

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!supabase) return

    if (!formValues.email.trim() || !formValues.password.trim()) {
      setStatus({ state: 'error', message: 'Email and password are required.' })
      return
    }

    setSaving(true)
    setStatus({ state: 'loading', message: 'Validando credenciales�' })

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
      setIsLoginOpen(false)
    }

    setSaving(false)
  }

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setStatus({ state: 'idle', message: 'Signed out.' })
  }

  const sessionDetails = useMemo(() => {
    if (!session) return null

    const { user } = session
    return {
      email: user.email,
      confirmedAt: user.email_confirmed_at,
      lastSignIn: user.last_sign_in_at,
      factors: user.factors ?? [],
    }
  }, [session])

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-900/95 px-4 py-3 text-slate-50 shadow-md backdrop-blur">
        <h1 className="m-0 text-lg font-semibold tracking-wide">IssueLine</h1>
        <div className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <span className="hidden text-slate-200 sm:inline">{session.user.email}</span>
              <Button type="button" variant="secondary" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <span className="text-xs uppercase tracking-widest text-slate-400">
              No active session
            </span>
          )}
          <Popover open={isLoginOpen} onOpenChange={setIsLoginOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              >
                Login
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 space-y-4"
              align="end"
              side="bottom"
              sideOffset={12}
            >
              {!isSupabaseConfigured ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-slate-800">Configure Supabase</p>
                  <p className="text-slate-600">
                    Fill out <code>.env</code> with <code>VITE_SUPABASE_URL</code> and{' '}
                    <code>VITE_SUPABASE_ANON_KEY</code> to enable sign in.
                  </p>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="ada@example.com"
                      value={formValues.email}
                      onChange={handleChange}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="********"
                      value={formValues.password}
                      onChange={handleChange}
                      autoComplete="current-password"
                    />
                  </div>
                  <Button className="w-full" type="submit" disabled={saving}>
                    {saving ? 'Validando�' : 'Sign in'}
                  </Button>
                  {status.message ? (
                    <p className={`text-sm ${statusClasses[status.state]}`} role="status">
                      {status.message}
                    </p>
                  ) : null}
                </form>
              )}
            </PopoverContent>
          </Popover>
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
        </Routes>

        {!isSupabaseConfigured && <EnvironmentNotice />}
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-slate-900/5">
        <div className="flex w-full flex-col gap-4 px-4 py-6 lg:flex-row lg:px-10 xl:px-16 2xl:px-24">
          <article className="rounded-2xl bg-white p-6 shadow-lg lg:w-96">
            <h2 className="text-lg font-semibold">Session &amp; audit</h2>
            {sessionDetails ? (
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium">{sessionDetails.email}</p>
                </div>
                <div>
                  <p className="text-slate-500">Confirmed on</p>
                  <p className="font-medium">{formatDateTime(sessionDetails.confirmedAt)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Last sign in</p>
                  <p className="font-medium">{formatDateTime(sessionDetails.lastSignIn)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Configured factors</p>
                  <p className="font-medium">
                    {sessionDetails.factors.length > 0
                      ? sessionDetails.factors
                          .map((factor) => factor.friendly_name || factor.id)
                          .join(', ')
                      : 'No MFA'}
                  </p>
                </div>
                <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
                  Every successful login is stored in <code>login_audit</code>.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                There is no active session yet. Create users under Supabase Auth &gt; Users and use the Login button.
              </p>
            )}
          </article>
          <article className="flex flex-1 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 shadow-inner">
            <div>
              <p className="font-medium text-slate-800">Real-time audit</p>
              <p className="mt-2">
                Review the history in the <code>login_audit</code> table and enrich it with extra metadata if you need
                more traceability.
              </p>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="font-semibold text-slate-700">RLS enabled</p>
                <p>Remember to adjust policies for each role.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="font-semibold text-slate-700">Service role</p>
                <p>Use the service role key only on servers.</p>
              </div>
            </div>
          </article>
        </div>
      </footer>
    </div>
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


