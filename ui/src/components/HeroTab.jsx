import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const alignmentColors = {
  good: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  neutral: 'text-amber-600 bg-amber-50 border-amber-100',
  bad: 'text-rose-600 bg-rose-50 border-rose-100',
}

const fallbackImage =
  'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=400&q=60'

const statLabels = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat']

function HeroTab({ hero }) {
  const { t } = useI18n()
  const alignment = hero.alignment?.toLowerCase()
  const badgeClasses = alignmentColors[alignment] ?? 'text-slate-600 bg-slate-100 border-slate-200'
  const heroImages = hero.heroImages ?? []
  const primaryImage = heroImages[0]
  const imageSrc = primaryImage?.public_url ?? hero.images?.md ?? hero.images?.sm ?? fallbackImage
  const imageAlt = primaryImage?.alt ?? hero.name
  const displayName = hero.full_name || hero.biography?.['full-name'] || hero.name
  const stats = hero.powerstats ?? {}
  const hasTimelineIssues = Boolean(hero.hasTimelineIssues)
  const timelineCoverage = hero.timelineCoverage ?? { count: 0, startYear: null, endYear: null }
  const coverageYearLabel =
    timelineCoverage.startYear && timelineCoverage.endYear
      ? timelineCoverage.startYear === timelineCoverage.endYear
        ? `${timelineCoverage.startYear}`
        : `${timelineCoverage.startYear} - ${timelineCoverage.endYear}`
      : timelineCoverage.startYear
        ? `${timelineCoverage.startYear}`
        : t('timeline.yearTba')

  const detailHref = hero.slug && hasTimelineIssues ? `/heroes/${hero.slug}` : null

  const portrait = (
    <img
      src={imageSrc}
      alt={imageAlt}
      className={cn(
        'h-28 w-28 rounded-xl object-cover shadow transition duration-200',
        hasTimelineIssues ? 'hover:scale-[1.02]' : 'cursor-not-allowed grayscale-[65%] opacity-80'
      )}
      loading="lazy"
    />
  )

  return (
    <article
      aria-disabled={!hasTimelineIssues}
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200',
        hasTimelineIssues
          ? 'hover:-translate-y-1 hover:shadow-lg focus-within:-translate-y-1 focus-within:shadow-lg'
          : 'border-slate-200 bg-slate-100/70 text-slate-500'
      )}
    >
      <div className="flex items-start gap-4">
        {detailHref ? (
          <Link to={detailHref} aria-label={t('heroTab.viewDetailsFor', { name: hero.name })} className="inline-block focus:outline-none">
            {portrait}
          </Link>
        ) : (
          <div title={t('heroTab.noIssuesTooltip')}>{portrait}</div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-balance title-sm">{hero.name}</h3>
            {alignment ? (
              <span
                className={cn(
                  'eyebrow rounded-full border px-2.5 py-0.5 tracking-normal',
                  badgeClasses
                )}
              >
                {alignment}
              </span>
            ) : null}
            {!hasTimelineIssues ? (
              <span className="eyebrow rounded-full border border-slate-300 bg-slate-200 px-2 py-0.5 text-slate-600">
                {t('heroTab.noIssuesBadge')}
              </span>
            ) : null}
          </div>
          {displayName && displayName !== hero.name ? (
            <p className="body-xs text-slate-500">{t('heroTab.aka', { name: displayName })}</p>
          ) : null}
          <p className="eyebrow mt-2">{hero.publisher ?? t('heroTab.independent')}</p>
        </div>
        {hasTimelineIssues ? (
          <div className="shrink-0 rounded-3xl border border-indigo-900/50 bg-linear-to-br from-indigo-950 via-indigo-900 to-indigo-800 px-4 py-3 text-center text-white shadow-inner">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">{t('timeline.coverage')}</p>
            <p className="text-2xl font-black leading-none tracking-wide">{coverageYearLabel}</p>
            <p className="mt-1 text-xs text-white/75">{t('timeline.trackedIssues', { count: timelineCoverage.count ?? 0 })}</p>
          </div>
        ) : null}
      </div>

      {heroImages.length > 1 ? (
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {heroImages.slice(1, 4).map((image) => (
            <span
              key={image.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2 py-0.5"
            >
              <span className="title-xs text-slate-700">{image.variant}</span>
              <span className="body-xs text-slate-400">{Math.round((image.size_bytes ?? 0) / 1024)} KB</span>
            </span>
          ))}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-3">
        {statLabels.map((label) => (
          <div
            key={label}
            className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 shadow-inner"
          >
            <dt className="eyebrow text-slate-400">{t(`heroDetail.stats.${label}`)}</dt>
            <dd className="title-xs text-slate-800">
              {Number.isFinite(Number(stats[label]))
                ? Number(stats[label])
                : (stats[label] ?? t('heroTab.noStatValue'))}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export default HeroTab
