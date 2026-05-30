// Renderitza una seccio visual de la pagina inicial d'IssueLine.
import { BookOpenCheck, Compass, LibraryBig, SearchCheck } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import SectionHeading from './SectionHeading'

const steps = [
  { key: 'track', icon: LibraryBig },
  { key: 'read', icon: BookOpenCheck },
  { key: 'missing', icon: SearchCheck },
  { key: 'history', icon: Compass },
]

function HowItWorksSection() {
  const { t } = useI18n()

  return (
    <section id="about" className="bg-slate-50 px-4 py-18 sm:px-6 lg:px-10 lg:py-24 xl:px-16 2xl:px-24">
      <div className="mx-auto w-full max-w-400">
        <SectionHeading
          eyebrow={t('home.how.eyebrow')}
          title={t('home.how.title')}
          description={t('home.how.description')}
          align="center"
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <article key={step.key} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200">
                <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-950 text-white">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-red-700">0{index + 1}</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{t(`home.how.steps.${step.key}.title`)}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{t(`home.how.steps.${step.key}.body`)}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default HowItWorksSection
