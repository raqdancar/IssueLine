// Renderitza una seccio visual de la pagina inicial d'IssueLine.
import { Check, Library, ListChecks, Radar, Rows3 } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import SectionHeading from './SectionHeading'

const collectorItems = [
  { key: 'missing', icon: Radar },
  { key: 'runs', icon: Rows3 },
  { key: 'progress', icon: ListChecks },
  { key: 'continuity', icon: Library },
]

function CollectorsSection() {
  const { t } = useI18n()

  return (
    <section className="bg-white px-4 py-18 sm:px-6 lg:px-10 lg:py-24 xl:px-16 2xl:px-24">
      <div className="mx-auto grid w-full max-w-400 gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
        <div>
          <SectionHeading
            eyebrow={t('home.collectors.eyebrow')}
            title={t('home.collectors.title')}
            description={t('home.collectors.description')}
          />
          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold leading-7 text-slate-700">{t('home.collectors.quote')}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {collectorItems.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.key} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-xl hover:shadow-red-100/70">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-red-50 text-red-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <Check className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-black text-slate-950">{t(`home.collectors.items.${item.key}.title`)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{t(`home.collectors.items.${item.key}.body`)}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default CollectorsSection
