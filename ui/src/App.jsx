import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
    ? new Date(value).toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'No disponible'

function App() {
  const [formValues, setFormValues] = useState(initialFormValues)
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState(null)
  const [isLoginOpen, setIsLoginOpen] = useState(false)

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
      console.warn('No se pudo registrar el acceso en login_audit', error.message)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!supabase) return

    if (!formValues.email.trim() || !formValues.password.trim()) {
      setStatus({ state: 'error', message: 'Correo y contraseña son obligatorios.' })
      return
    }

    setSaving(true)
    setStatus({ state: 'loading', message: 'Validando credenciales…' })

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
        message: `Sesión iniciada como ${data.user.email}`,
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
    setStatus({ state: 'idle', message: 'Sesión cerrada.' })
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
        <h1 className="m-0 text-lg font-semibold tracking-wide">IssueLine · Login</h1>
        <div className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <span className="hidden text-slate-200 sm:inline">{session.user.email}</span>
              <Button type="button" variant="secondary" onClick={handleSignOut}>
                Cerrar sesión
              </Button>
            </>
          ) : (
            <span className="text-xs uppercase tracking-widest text-slate-400">
              Sin sesión activa
            </span>
          )}
          <Popover open={isLoginOpen} onOpenChange={setIsLoginOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline">
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
                  <p className="font-semibold text-slate-800">Configura Supabase</p>
                  <p className="text-slate-600">
                    Completa <code>ui/.env</code> con <code>VITE_SUPABASE_URL</code> y{' '}
                    <code>VITE_SUPABASE_ANON_KEY</code> para habilitar el login.
                  </p>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Correo</Label>
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
                    <Label htmlFor="password">Contraseña</Label>
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
                    {saving ? 'Validando…' : 'Acceder'}
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

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Centro de control</h2>
          <p className="mt-2 text-sm text-slate-600">
            Usa el botón <strong>Login</strong> del header para autenticarte. Cada sesión se registra en
            Supabase y se refleja en la tarjeta del pie de página.
          </p>
          {status.message ? (
            <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${statusClasses[status.state]}`}>
              {status.message}
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Sin eventos recientes.</p>
          )}
        </section>

        {!isSupabaseConfigured && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow">
            <h2 className="text-lg font-semibold">Variables de entorno pendientes</h2>
            <p className="mt-2 text-sm">
              Copia <code>ui/.env.example</code> a <code>ui/.env</code> y añade tus credenciales
              <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.
            </p>
          </section>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-slate-900/5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 lg:flex-row">
          <article className="rounded-2xl bg-white p-6 shadow-lg lg:w-96">
            <h2 className="text-lg font-semibold">Sesión y auditoría</h2>
            {sessionDetails ? (
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Correo</p>
                  <p className="font-medium">{sessionDetails.email}</p>
                </div>
                <div>
                  <p className="text-slate-500">Confirmado el</p>
                  <p className="font-medium">{formatDateTime(sessionDetails.confirmedAt)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Último acceso</p>
                  <p className="font-medium">{formatDateTime(sessionDetails.lastSignIn)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Factores configurados</p>
                  <p className="font-medium">
                    {sessionDetails.factors.length > 0
                      ? sessionDetails.factors
                          .map((factor) => factor.friendly_name || factor.id)
                          .join(', ')
                      : 'Sin MFA'}
                  </p>
                </div>
                <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
                  Cada inicio de sesión exitoso se guarda en <code>login_audit</code>.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Todavía no hay una sesión activa. Crea usuarios desde Supabase Auth &gt; Users y usa el botón Login.
              </p>
            )}
          </article>
          <article className="flex flex-1 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 shadow-inner">
            <div>
              <p className="font-medium text-slate-800">Auditoría en tiempo real</p>
              <p className="mt-2">
                Consulta el historial en la tabla <code>login_audit</code> y amplíalo con más metadatos si necesitas
                trazabilidad adicional.
              </p>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="font-semibold text-slate-700">RLS activo</p>
                <p>Recuerda ajustar políticas para cada rol.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="font-semibold text-slate-700">Servicio</p>
                <p>Usa la service role key solo en servidores.</p>
              </div>
            </div>
          </article>
        </div>
      </footer>
    </div>
  )
}

export default App
