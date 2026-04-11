import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const modeLabels = {
  'sign-in': 'Sign in',
  'sign-up': 'Create account',
}

function AuthDialog({
  open,
  mode = 'sign-in',
  onModeChange,
  onClose,
  onSignIn,
  onSignUp,
  formValues,
  onChange,
  status,
  saving,
  isConfigured,
}) {
  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!isConfigured) return
    if (mode === 'sign-in') {
      onSignIn?.()
    } else {
      onSignUp?.()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4 py-8">
      <div className="relative w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/25">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close dialog</span>
        </button>
        <div className="space-y-1 pr-10">
          <p className="eyebrow text-indigo-500">Account access</p>
          <h2 className="title-md">Sign in or create an account</h2>
          <p className="text-sm text-slate-600">
            Use your Supabase credentials to sync reading progress across the IssueLine roster.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          {['sign-in', 'sign-up'].map((value) => {
            const isActive = mode === value
            return (
              <button
                type="button"
                key={value}
                onClick={() => onModeChange?.(value)}
                className={`flex-1 rounded-full px-3 py-1 transition ${isActive ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
                aria-pressed={isActive}
              >
                {modeLabels[value]}
              </button>
            )
          })}
        </div>
        <div className="mt-4">
          {!isConfigured ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Supabase is not configured.</p>
              <p className="mt-1">
                Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file
                to enable authentication.
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  placeholder="ada@example.com"
                  value={formValues.email}
                  onChange={onChange}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  placeholder="********"
                  value={formValues.password}
                  onChange={onChange}
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                />
              </div>
              {mode === 'sign-up' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-confirm">Confirm password</Label>
                  <Input
                    id="auth-confirm"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    value={formValues.confirmPassword}
                    onChange={onChange}
                    autoComplete="new-password"
                  />
                </div>
              ) : null}
              <Button className="w-full" type="submit" disabled={saving}>
                {saving ? (mode === 'sign-in' ? 'Signing in…' : 'Creating account…') : modeLabels[mode]}
              </Button>
              {status.message ? (
                <p className={`text-sm ${status.state === 'error' ? 'text-red-600' : status.state === 'success' ? 'text-emerald-600' : 'text-slate-500'}`} role="status">
                  {status.message}
                </p>
              ) : null}
              {mode === 'sign-up' ? (
                <p className="text-xs text-slate-500">
                  Accounts require email confirmation unless disabled in Supabase Auth settings.
                </p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthDialog
