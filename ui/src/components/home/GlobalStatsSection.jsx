// Renderitza una seccio visual de la pagina inicial d'IssueLine.
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { buildGlobalStats } from './homeData'

function GlobalStatsSection({ heroes, heroesStatus }) {
  const { t } = useI18n()
  const stats = buildGlobalStats(heroes, t)
  const isPending = heroesStatus?.state !== 'success'

  return (
    <section className="bg-slate-950 px-4 py-14 text-white sm:px-6 lg:px-10 xl:px-16 2xl:px-24">
      <div className="mx-auto grid w-full max-w-400 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-white/15 bg-white/10 p-6 shadow-xl shadow-slate-950/30">
            <p className="text-4xl font-black leading-none text-white sm:text-5xl">
              {isPending ? <span className="text-slate-500">--</span> : stat.value.toLocaleString()}
            </p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-slate-300">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default GlobalStatsSection
