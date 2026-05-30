// Renderitza una pagina principal de l'aplicacio.
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function StoragePolicy() {
  const { t } = useI18n()
  const storageItems = [
    t('privacy.storageItemAuth'),
    t('privacy.storageItemLocale'),
    t('privacy.storageItemNotice'),
  ]

  return (
    <section className="mx-auto w-full max-w-4xl rounded-[32px] border border-slate-100 bg-white/90 p-6 text-slate-700 shadow-xl shadow-slate-200/70 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="space-y-3">
          <p className="eyebrow text-slate-500">{t('privacy.eyebrow')}</p>
          <h2 className="title-md text-slate-900">{t('privacy.title')}</h2>
          <p className="body-sm">{t('privacy.intro')}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        <article className="rounded-2xl border border-slate-900 bg-slate-950 p-5 text-white">
          <h3 className="text-sm font-black">{t('privacy.personalDataTitle')}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-200">{t('privacy.personalDataBody')}</p>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <h3 className="text-sm font-black text-slate-900">{t('privacy.storageTitle')}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            {storageItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5">
          <h3 className="text-sm font-black text-slate-900">{t('privacy.noTrackingTitle')}</h3>
          <p className="mt-2 body-sm">{t('privacy.noTrackingBody')}</p>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5">
          <h3 className="text-sm font-black text-slate-900">{t('privacy.manageTitle')}</h3>
          <p className="mt-2 body-sm">{t('privacy.manageBody')}</p>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/">{t('privacy.backHome')}</Link>
        </Button>
      </div>
    </section>
  )
}

export default StoragePolicy
