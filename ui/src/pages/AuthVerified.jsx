// Render the confirmation landing screen after Supabase email verification.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MailCheck, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const parseAuthRedirectError = () => {
  if (typeof window === 'undefined') return null

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const error = searchParams.get('error') ?? hashParams.get('error')
  const description =
    searchParams.get('error_description') ??
    hashParams.get('error_description') ??
    searchParams.get('error_code') ??
    hashParams.get('error_code')

  if (!error && !description) return null
  return description || error
}

function AuthVerified({ onSignInClick }) {
  const { t } = useI18n()
  const authError = useMemo(() => parseAuthRedirectError(), [])
  const hasError = Boolean(authError)
  const Icon = hasError ? ShieldAlert : CheckCircle2

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 items-center py-8">
      <div className="w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
        <div className="border-b border-slate-100 bg-linear-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white sm:px-8">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${hasError ? 'bg-rose-500/20 text-rose-100' : 'bg-emerald-400/20 text-emerald-100'}`}>
              <Icon className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/60">
                {t('authVerified.eyebrow')}
              </p>
              <h2 className="text-2xl font-black leading-tight">
                {hasError ? t('authVerified.errorTitle') : t('authVerified.title')}
              </h2>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-7 sm:px-8">
          <div className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <MailCheck className={`mt-0.5 h-5 w-5 shrink-0 ${hasError ? 'text-rose-600' : 'text-emerald-600'}`} aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {hasError ? t('authVerified.errorSubtitle') : t('authVerified.subtitle')}
              </p>
              <p className="text-sm leading-6 text-slate-600">
                {hasError ? authError : t('authVerified.body')}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={onSignInClick} className="sm:w-auto">
              {t('authVerified.signInCta')}
            </Button>
            <Button asChild variant="outline" className="sm:w-auto">
              <Link to="/">{t('authVerified.homeCta')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AuthVerified
