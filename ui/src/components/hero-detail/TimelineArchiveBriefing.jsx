// Renderitza blocs visuals de la pagina de detall d'un personatge.
import { BookOpenCheck, CalendarRange, Layers3, LibraryBig } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  buildStageGroups,
  resolveEntryTimestamp,
  resolveIssueQuickLabel,
  resolveTimelineRange,
} from '@/components/timeline/timelineInsightsViewModel'
import { isSpecialTimelineEventEntry } from '@/components/timeline/utils'
import { resolveIssueCoverImage } from '@/lib/issueImages'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import RandomCoverFan from '@/components/hero-detail/RandomCoverFan'

const formatterCache = new Map()

const getNumberFormatter = (locale) => {
  if (!formatterCache.has(locale)) {
    formatterCache.set(locale, new Intl.NumberFormat(locale))
  }
  return formatterCache.get(locale)
}

const formatIssueDate = (value, locale, t) => {
  if (!value) return t('timeline.dateTba')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

const getSortedEntries = (entries) =>
  [...entries].sort((a, b) => {
    const aTimestamp = resolveEntryTimestamp(a)
    const bTimestamp = resolveEntryTimestamp(b)
    const safeA = typeof aTimestamp === 'number' ? aTimestamp : Number.POSITIVE_INFINITY
    const safeB = typeof bTimestamp === 'number' ? bTimestamp : Number.POSITIVE_INFINITY
    return safeA - safeB
  })

function TimelineArchiveBriefing({
  heroName,
  status,
  errorMessage,
  entries = [],
  collectedEditions = [],
  statesByIssueId = {},
  isAuthenticated = false,
}) {
  const { t, locale } = useI18n()
  const numberFormatter = getNumberFormatter(locale)

  const briefingEntries = useMemo(() => entries.filter((entry) => !isSpecialTimelineEventEntry(entry)), [entries])
  const sortedEntries = useMemo(() => getSortedEntries(briefingEntries), [briefingEntries])
  const stageGroups = useMemo(
    () => buildStageGroups(briefingEntries, statesByIssueId, t, locale),
    [briefingEntries, statesByIssueId, t, locale],
  )
  const timelineRange = useMemo(() => resolveTimelineRange(briefingEntries, t), [briefingEntries, t])
  const coverImages = useMemo(() => {
    const covers = briefingEntries.map((entry) => resolveIssueCoverImage(entry?.metadata ?? {}, null)).filter(Boolean)
    return Array.from(new Set(covers))
  }, [briefingEntries])

  const firstEntry = sortedEntries[0] ?? null
  const latestEntry = sortedEntries[sortedEntries.length - 1] ?? null
  const ownedCount = briefingEntries.filter((entry) => entry?.id && statesByIssueId?.[entry.id]?.haveIt).length
  const readCount = briefingEntries.filter((entry) => entry?.id && statesByIssueId?.[entry.id]?.readIt).length
  const totalIssues = briefingEntries.length
  const readPercent = totalIssues > 0 ? Math.round((readCount / totalIssues) * 100) : 0
  const ownedPercent = totalIssues > 0 ? Math.round((ownedCount / totalIssues) * 100) : 0
  const routeStages = stageGroups
  const [activeRouteIndex, setActiveRouteIndex] = useState(0)
  const activeRouteStage = routeStages[activeRouteIndex] ?? routeStages[0] ?? null

  if (status === 'disabled') {
    return (
      <section className="border-y border-slate-100 py-5 text-sm text-slate-500">
        {t('heroDetail.archiveBackendDisabled')}
      </section>
    )
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="border-y border-slate-100 py-5">
        <div className="h-4 w-36 rounded-full bg-slate-100" />
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-20 rounded-2xl bg-slate-100/80" />
          ))}
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="border-y border-slate-100 py-5 text-sm text-rose-600">
        {errorMessage ?? t('heroDetail.archiveLoadError')}
      </section>
    )
  }

  if (!totalIssues) {
    return (
      <section className="border-y border-slate-100 py-5 text-sm text-slate-500">
        {t('heroDetail.archiveEmpty')}
      </section>
    )
  }

  const metrics = [
    {
      key: 'years',
      label: t('heroDetail.archiveYears'),
      value: timelineRange.label,
      Icon: CalendarRange,
      tone: 'text-indigo-700 bg-indigo-50 border-indigo-100',
    },
    {
      key: 'issues',
      label: t('heroDetail.archiveIssues'),
      value: numberFormatter.format(totalIssues),
      Icon: BookOpenCheck,
      tone: 'text-slate-700 bg-slate-50 border-slate-100',
    },
    {
      key: 'stages',
      label: t('heroDetail.archiveStages'),
      value: numberFormatter.format(stageGroups.length),
      Icon: Layers3,
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    },
    {
      key: 'collected',
      label: t('heroDetail.archiveCollected'),
      value: numberFormatter.format(collectedEditions.length),
      Icon: LibraryBig,
      tone: 'text-amber-700 bg-amber-50 border-amber-100',
    },
  ]

  return (
    <section className="relative overflow-hidden border-y border-slate-100 py-5">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(180deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" aria-hidden="true" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.9fr)]">
        <div className="min-w-0">
          <p className="eyebrow text-slate-400">{t('heroDetail.archiveEyebrow')}</p>
          <h3 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{t('heroDetail.archiveTitle')}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {t('heroDetail.archiveSummary', {
              heroName,
              issueCount: numberFormatter.format(totalIssues),
              stageCount: numberFormatter.format(stageGroups.length),
            })}
          </p>

          <div className="mt-4">
            <RandomCoverFan covers={coverImages} emptyLabel={t('heroDetail.archiveNoCovers')} />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ key, label, value, Icon, tone }) => (
              <div key={key} className={`min-w-0 rounded-2xl border px-3 py-3 ${tone}`}>
                <dt className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </dt>
                <dd className="mt-2 text-xl font-black leading-none">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-slate-100 bg-white/75 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{t('heroDetail.archiveFirst')}</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900">{resolveIssueQuickLabel(firstEntry, t)}</p>
              <p className="text-xs text-slate-500">{formatIssueDate(firstEntry?.issue_date, locale, t)}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-slate-100 bg-white/75 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{t('heroDetail.archiveLatest')}</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900">{resolveIssueQuickLabel(latestEntry, t)}</p>
              <p className="text-xs text-slate-500">{formatIssueDate(latestEntry?.issue_date, locale, t)}</p>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-white/75 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
                <span>{t('heroDetail.archiveReadProgress')}</span>
                <span>{readPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${readPercent}%` }} />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
                <span>{t('heroDetail.archiveOwnedProgress')}</span>
                <span>{ownedPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ownedPercent}%` }} />
              </div>
            </div>
          ) : null}

          {routeStages.length ? (
            <div className="relative z-10 overflow-hidden rounded-2xl border border-primary/35 bg-white/75 px-4 py-4 shadow-sm">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:24px_24px]" aria-hidden="true" />
              <div className="relative flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">{t('heroDetail.archiveRoute')}</p>
                <span className="rounded-full border border-primary/35 bg-background/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {numberFormatter.format(routeStages.length)}
                </span>
              </div>
              <div className="editorial-route-scroll relative mt-5 overflow-x-auto pb-4">
                <ol className="relative flex min-w-max items-start gap-4 pr-2">
                  <span className="pointer-events-none absolute left-0 right-0 top-5 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent" aria-hidden="true" />
                  {routeStages.map((stage, index) => (
                    <li key={stage.key} className="relative z-10 w-34 shrink-0">
                      <button
                        type="button"
                        onMouseEnter={() => setActiveRouteIndex(index)}
                        onFocus={() => setActiveRouteIndex(index)}
                        onClick={() => setActiveRouteIndex(index)}
                        aria-pressed={activeRouteIndex === index}
                        className={`group flex w-full flex-col items-center gap-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                          activeRouteIndex === index ? 'text-slate-950' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span
                          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border text-xs font-black shadow-sm transition ${
                            activeRouteIndex === index
                              ? 'border-slate-950 bg-slate-950 text-amber-200 shadow-primary/30'
                              : 'border-primary/50 bg-background text-foreground group-hover:border-primary group-hover:bg-primary/15'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="block w-full text-[11px] font-black uppercase tracking-[0.16em]">
                          {stage.yearLabel}
                        </span>
                        <span className="block w-full text-xs font-bold leading-snug break-words">
                          {stage.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
              {activeRouteStage ? (
                <div className="relative mt-4 grid overflow-hidden rounded-xl border border-slate-950/80 bg-slate-950 text-amber-50 shadow-sm sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <div className="min-w-0 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
                      {activeRouteStage.yearLabel}
                    </p>
                    <h4 className="mt-1 text-base font-black leading-snug break-words">{activeRouteStage.name}</h4>
                    <p className="mt-3 max-h-24 overflow-y-auto pr-1 text-sm leading-6 text-amber-100/90">
                      {activeRouteStage.summary ?? t('timeline.noStageSummary')}
                    </p>
                  </div>
                  <aside className="flex min-h-24 flex-row items-center justify-between gap-3 border-t border-amber-300/20 bg-amber-300/10 px-4 py-3 sm:flex-col sm:items-center sm:justify-center sm:border-l sm:border-t-0">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
                      {t('timeline.issuesTracked')}
                    </span>
                    <span className="text-3xl font-medium leading-none text-amber-100/95 sm:text-4xl">
                      {numberFormatter.format(activeRouteStage.issueCount)}
                    </span>
                  </aside>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default TimelineArchiveBriefing
