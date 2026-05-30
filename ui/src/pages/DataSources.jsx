// Renderitza una pagina principal de l'aplicacio.
import { Link } from 'react-router-dom'
import { BookOpenCheck, ExternalLink, Image as ImageIcon, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const externalLinkClasses =
  'inline-flex items-center gap-1 font-semibold text-indigo-700 underline-offset-4 transition hover:text-indigo-900 hover:underline'

function DataSources() {
  const { t } = useI18n()

  const notes = [
    {
      icon: BookOpenCheck,
      title: t('dataSources.gcdTitle'),
      body: t('dataSources.gcdBody'),
    },
    {
      icon: ImageIcon,
      title: t('dataSources.coversTitle'),
      body: t('dataSources.coversBody'),
    },
    {
      icon: Scale,
      title: t('dataSources.independentTitle'),
      body: t('dataSources.independentBody'),
    },
  ]

  return (
    <section className="mx-auto w-full max-w-4xl rounded-[32px] border border-slate-100 bg-white/90 p-6 text-slate-700 shadow-xl shadow-slate-200/70 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <Scale className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="space-y-3">
          <p className="eyebrow text-slate-500">{t('dataSources.eyebrow')}</p>
          <h2 className="title-md text-slate-900">{t('dataSources.title')}</h2>
          <p className="body-sm">{t('dataSources.intro')}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        {notes.map((note) => {
          const Icon = note.icon
          return (
            <article key={note.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{note.title}</h3>
                  <p className="mt-2 body-sm">{note.body}</p>
                </div>
              </div>
            </article>
          )
        })}

        <article className="rounded-2xl border border-slate-900 bg-slate-950 p-5 text-white">
          <h3 className="text-sm font-black">{t('dataSources.linksTitle')}</h3>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <a className={externalLinkClasses} href="https://www.comics.org/" target="_blank" rel="noreferrer noopener">
                {t('dataSources.gcdLink')}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a
                className={externalLinkClasses}
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer noopener"
              >
                {t('dataSources.ccLink')}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex w-fit rounded bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <img
                src="https://licensebuttons.net/l/by-sa/4.0/88x31.png"
                alt={t('dataSources.ccBadgeAlt')}
                width="88"
                height="31"
                loading="lazy"
              />
            </a>
          </div>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/">{t('dataSources.backHome')}</Link>
        </Button>
      </div>
    </section>
  )
}

export default DataSources
