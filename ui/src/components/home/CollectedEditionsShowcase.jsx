import { ArrowRight, BookMarked } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import SectionHeading from './SectionHeading'
import { collectedEditionItems } from './homeData'

function CollectedEditionsShowcase() {
  const { t } = useI18n()

  return (
    <section id="collected-editions" className="overflow-hidden bg-slate-50 px-4 py-18 sm:px-6 lg:px-10 lg:py-24 xl:px-16 2xl:px-24">
      <div className="mx-auto grid w-full max-w-400 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <SectionHeading
          eyebrow={t('home.editions.eyebrow')}
          title={t('home.editions.title')}
          description={t('home.editions.description')}
        />

        <div className="relative min-h-[26rem] rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80">
          <div className="absolute inset-x-6 bottom-16 h-4 rounded-full bg-slate-900/10 blur-md" aria-hidden="true" />
          <div className="flex h-80 items-end justify-center gap-3 sm:gap-5">
            {collectedEditionItems.map((item, index) => (
              <article
                key={item.key}
                className={`${item.width} group relative flex h-64 flex-col justify-between overflow-hidden rounded-md border border-slate-900/10 bg-linear-to-br ${item.tone} p-4 text-white shadow-2xl shadow-slate-400/40 transition duration-300 hover:-translate-y-3 sm:h-72`}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{t('common.appName')}</span>
                <div>
                  <BookMarked className="h-7 w-7 text-white/80" aria-hidden="true" />
                  <h3 className="mt-3 text-lg font-black uppercase leading-none drop-shadow">{t(`home.editions.items.${item.key}.title`)}</h3>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">
                  {t(`home.editions.items.${item.key}.meta`)}
                </p>
                <span
                  className="absolute inset-y-0 left-3 w-px bg-white/30"
                  style={{ opacity: index % 2 ? 0.5 : 0.3 }}
                  aria-hidden="true"
                />
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-600">{t('home.editions.note')}</p>
            <a
              href="#timeline-preview"
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {t('home.editions.cta')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CollectedEditionsShowcase
