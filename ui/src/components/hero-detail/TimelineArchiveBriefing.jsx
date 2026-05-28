// Render a compact, data-led archive snapshot for a character detail page.
import { BookOpenCheck, CalendarRange, Layers3, LibraryBig } from 'lucide-react'
import { useMemo } from 'react'
import {
  buildStageGroups,
  resolveEntryTimestamp,
  resolveIssueQuickLabel,
  resolveTimelineRange,
} from '@/components/timeline/timelineInsightsViewModel'
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

  const sortedEntries = useMemo(() => getSortedEntries(entries), [entries])
  const stageGroups = useMemo(() => buildStageGroups(entries, statesByIssueId, t, locale), [entries, statesByIssueId, t, locale])
  const timelineRange = useMemo(() => resolveTimelineRange(entries, t), [entries, t])
  const coverImages = useMemo(() => {
    const covers = entries.map((entry) => resolveIssueCoverImage(entry?.metadata ?? {}, null)).filter(Boolean)
    return Array.from(new Set(covers))
  }, [entries])

  const firstEntry = sortedEntries[0] ?? null
  const latestEntry = sortedEntries[sortedEntries.length - 1] ?? null
  const issueStates = Object.values(statesByIssueId ?? {})
  const ownedCount = issueStates.filter((state) => state.haveIt).length
  const readCount = issueStates.filter((state) => state.readIt).length
  const totalIssues = entries.length
  const readPercent = totalIssues > 0 ? Math.round((readCount / totalIssues) * 100) : 0
  const ownedPercent = totalIssues > 0 ? Math.round((ownedCount / totalIssues) * 100) : 0

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

  const routeStages = stageGroups.slice(0, 5)

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
            <div className="rounded-2xl border border-slate-100 bg-white/75 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{t('heroDetail.archiveRoute')}</p>
              <ol className="mt-3 flex flex-wrap items-center gap-2">
                {routeStages.map((stage, index) => (
                  <li key={stage.key} className="flex min-w-0 items-center gap-2">
                    {index > 0 ? <span className="h-px w-5 bg-slate-200" aria-hidden="true" /> : null}
                    <span className="max-w-44 truncate rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                      {stage.name}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default TimelineArchiveBriefing
