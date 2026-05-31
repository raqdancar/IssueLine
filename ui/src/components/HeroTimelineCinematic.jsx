// Renderitza un component reutilitzable de la interfície d'IssueLine.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Clapperboard, ExternalLink, Flag, Layers3, Maximize2, Minimize2, Sparkles } from 'lucide-react'
import { resolveIssueCoverImage } from '@/lib/issueImages'
import { normalizeIntegerText } from '@/utils/numberFormatters'
import { compareTimelineEntries, resolveTimelineOrder } from '@/utils/timeline'
import TimelineStageTab from './timeline/TimelineStageTab'
import CoverFullscreenViewer from './CoverFullscreenViewer'
import TimelineIssueToolbar from './timeline/TimelineIssueToolbar'
import { TimelineLoadingSkeleton } from './timeline/TimelineLoadingSkeleton'
import { isSpecialTimelineEventEntry } from './timeline/utils'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import { useIssueStateMutation, useIssueStatesQuery } from '@/hooks/useIssueStates.js'
import { useHeroTimelineQuery } from '@/hooks/useHeroTimeline.js'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import {
  canUseFullscreen,
  exitDocumentFullscreen,
  isElementFullscreen,
  isTimelineFullscreenViewport,
  requestElementFullscreen,
} from '@/lib/fullscreen.js'
import { backendBaseUrl } from '@/utils/backend.js'

const formatDate = (value, locale, t) => {
  if (!value) return t('timeline.dateTba')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

const resolveYear = (entry) => {
  if (entry.issue_date) {
    const date = new Date(entry.issue_date)
    if (!Number.isNaN(date.getTime())) {
      return String(date.getUTCFullYear())
    }
  }
  const keyDate = entry.metadata?.keyDate || entry.metadata?.key_date
  if (keyDate) {
    const yearMatch = /(\d{4})/.exec(keyDate)
    if (yearMatch) {
      return yearMatch[1]
    }
  }
  return 'Unknown'
}

const groupEntriesByYear = (entries, direction = 'desc', orderMode = 'publication') => {
  const hasCanonicalTimelineOrder = entries.some((entry) => resolveTimelineOrder(entry) !== null)

  if (hasCanonicalTimelineOrder && orderMode === 'canonical') {
    return [
      {
        year: 'Canonical order',
        entries: [...entries].sort((a, b) => compareTimelineEntries(a, b, 'asc', { useTimelineOrder: true })),
      },
    ]
  }

  const groups = new Map()
  for (const entry of entries) {
    const year = resolveYear(entry)
    if (!groups.has(year)) {
      groups.set(year, [])
    }
    groups.get(year).push(entry)
  }

  const directionValue = direction === 'asc' ? 1 : -1
  const sorter = (a, b) => {
    if (a[0] === 'Unknown') return 1
    if (b[0] === 'Unknown') return -1
    return directionValue * (Number(a[0]) - Number(b[0]))
  }

  const getIssueTime = (entry) => {
    const timestamp = new Date(entry.issue_date ?? 0).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  return Array.from(groups.entries())
    .sort(sorter)
    .map(([year, yearEntries]) => ({
      year,
      // Keep issue order consistent with selected global sort direction.
      entries: [...yearEntries].sort((a, b) => {
        const result = getIssueTime(a) - getIssueTime(b)
        if (result === 0) return 0
        return directionValue * result
      }),
    }))
}

function HeroTimelineCinematic({ slug, heroName, fallbackImage, timelineLogoSrc = null, timelineLogoAlt = null }) {
  const { t, locale } = useI18n()
  const sectionRef = useRef(null)
  const [logoVisible, setLogoVisible] = useState(Boolean(timelineLogoSrc))
  const [sortDirection, setSortDirection] = useState('desc')
  const [timelineOrderMode, setTimelineOrderMode] = useState('canonical')
  const [coverViewer, setCoverViewer] = useState({ open: false, src: null, alt: '' })
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false)
  const { isAuthenticated } = useSessionContext()
  const timelineQuery = useHeroTimelineQuery(slug)
  const { status, entries } = timelineQuery
  const error = timelineQuery.errorMessage || t('timeline.loadingTimeline')
  const issueStatesQuery = useIssueStatesQuery(slug, {
    enabled: status === 'success' && Boolean(backendBaseUrl) && isAuthenticated,
  })
  const issueStateMutation = useIssueStateMutation(slug)
  const issueStatesById = issueStatesQuery.statesByIssueId ?? {}
  const pendingIssueId = issueStateMutation.isPending ? issueStateMutation.variables?.issueId ?? null : null

  // Hide broken logo assets and fall back to hero name text.
  useEffect(() => {
    setLogoVisible(Boolean(timelineLogoSrc))
  }, [timelineLogoSrc])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncViewport = () => {
      setIsMobileViewport(window.matchMedia('(max-width: 767px)').matches)
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!isMobileViewport) {
      setShowBackToTop(false)
      return undefined
    }

    const onScroll = () => {
      const rect = sectionRef.current?.getBoundingClientRect()
      if (!rect) {
        setShowBackToTop(false)
        return
      }

      const isPastTimelineStart = rect.top <= -48
      const isBeforeTimelineEnd = rect.bottom >= window.innerHeight * 0.45
      // Show floating return button only inside the timeline viewport.
      setShowBackToTop(isPastTimelineStart && isBeforeTimelineEnd)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [isMobileViewport])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const syncFullscreenState = () => {
      const element = sectionRef.current
      const isElementActive = isElementFullscreen(element, document)
      const isAllowedViewport = isTimelineFullscreenViewport(window)
      setIsFullscreen(isElementActive)
      setFullscreenEnabled(isAllowedViewport && canUseFullscreen(element))
      if (isElementActive && !isAllowedViewport) {
        void exitDocumentFullscreen(document)
      }
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)
    window.addEventListener('resize', syncFullscreenState)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
      window.removeEventListener('resize', syncFullscreenState)
    }
  }, [])

  const openCoverViewer = (src, alt) => {
    if (!src || typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 767px)').matches) return
    setCoverViewer({ open: true, src, alt: alt ?? t('common.issueCover') })
  }

  const handleIssueStateToggle = (issueId, field, nextValue) => {
    if (!issueId || !isAuthenticated || !backendBaseUrl) return
    issueStateMutation.mutate({ issueId, patch: { [field]: nextValue } })
  }
  const handleToggleFullscreen = async () => {
    const element = sectionRef.current
    if (!element) return

    if (isElementFullscreen(element, document)) {
      await exitDocumentFullscreen(document)
      return
    }
    if (!isTimelineFullscreenViewport(window)) return
    await requestElementFullscreen(element)
  }
  const shouldShowBackToTop = isMobileViewport && showBackToTop

  const hasCanonicalTimelineOrder = useMemo(
    () => entries.some((entry) => resolveTimelineOrder(entry) !== null),
    [entries],
  )
  const groupedEntries = useMemo(
    () => groupEntriesByYear(entries, sortDirection, timelineOrderMode),
    [entries, sortDirection, timelineOrderMode],
  )
  const cinematicStats = useMemo(() => {
    const timelineYears = entries
      .map((entry) => resolveYear(entry))
      .filter((year) => year !== 'Unknown')
      .map(Number)
      .filter(Number.isFinite)
    const uniqueYears = Array.from(new Set(timelineYears)).sort((a, b) => a - b)

    return {
      eventCount: entries.filter(isSpecialTimelineEventEntry).length,
      issueCount: entries.filter((entry) => !isSpecialTimelineEventEntry(entry)).length,
      yearRange: uniqueYears.length
        ? uniqueYears.length === 1
          ? String(uniqueYears[0])
          : `${uniqueYears[0]} - ${uniqueYears.at(-1)}`
        : t('timeline.dateTba'),
    }
  }, [entries, t])

  if (!slug) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 body-xs text-slate-500">
        {t('timeline.missingHeroSlug')}
      </div>
    )
  }

  if (!backendBaseUrl) {
    return (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 body-xs text-amber-800">
        {t('timeline.configureBackendForTimeline')}
      </div>
    )
  }

  return (
    <section
      ref={sectionRef}
      className={`cinematic-timeline-shell relative isolate mt-4 min-w-0 max-w-full border p-3 text-slate-100 shadow-2xl transition sm:p-6 lg:p-8 ${
        isFullscreen
          ? 'h-screen min-h-screen overflow-y-auto rounded-none border-white/15'
          : 'overflow-hidden rounded-[2rem] border-white/10'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {fallbackImage ? (
          <img
            src={fallbackImage}
            alt=""
            className="cinematic-timeline-portrait absolute -right-16 top-0 h-[34rem] w-[24rem] object-cover opacity-20 mix-blend-screen sm:right-0 sm:w-[32rem]"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.94)_48%,rgba(2,6,23,0.88)_100%)]" />
        <div className="cinematic-timeline-aurora absolute -left-20 top-16 h-72 w-72 rounded-full bg-primary/35 blur-3xl" />
        <div className="cinematic-timeline-aurora absolute right-0 top-80 h-80 w-80 rounded-full bg-accent/20 blur-3xl [animation-delay:-7s]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:34px_34px]" />
      </div>
      <header className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-950/55 p-4 shadow-2xl shadow-black/35 ring-1 ring-white/5 backdrop-blur-md sm:p-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent/80 to-transparent" />
        </div>
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-accent">
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
              <span>{t('timeline.cinematicTimeline')}</span>
              {isFullscreen ? <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1">{t('timeline.showcaseMode')}</span> : null}
            </div>
            {timelineLogoSrc && logoVisible ? (
              <img
                src={timelineLogoSrc}
                alt={timelineLogoAlt ?? heroName}
                className="mt-3 h-14 w-auto max-w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)] sm:h-20 sm:max-w-xl"
                loading="lazy"
                onError={() => setLogoVisible(false)}
              />
            ) : (
              <h3 className="mt-3 text-2xl font-black uppercase tracking-[0.08em] text-white sm:text-4xl">{heroName}</h3>
            )}
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{t('timeline.groupedByYear')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-slate-100">
                <CalendarDays className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {cinematicStats.yearRange}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-slate-100">
                <Layers3 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {t('timeline.trackedIssues', { count: cinematicStats.issueCount })}
              </span>
              {cinematicStats.eventCount ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('timeline.specialEventMarker')}: {cinematicStats.eventCount}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex max-w-full flex-col items-start gap-3 text-xs text-slate-300 xl:items-end">
            {fullscreenEnabled ? (
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? t('timeline.exitFullscreen') : t('timeline.enterFullscreen')}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent transition hover:-translate-y-0.5 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {isFullscreen ? t('timeline.exitFullscreen') : t('timeline.enterFullscreen')}
              </button>
            ) : null}
            <div className="flex max-w-full flex-wrap items-center gap-2">
              {hasCanonicalTimelineOrder ? (
                <div className="inline-flex max-w-full rounded-full border border-white/20 bg-white/5 p-0.5">
                  {[
                    { label: t('timeline.canonicalOrder'), value: 'canonical' },
                    { label: t('timeline.publicationOrder'), value: 'publication' },
                  ].map((option) => {
                    const isActive = timelineOrderMode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setTimelineOrderMode(option.value)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                          isActive ? 'bg-accent text-accent-foreground shadow' : 'text-slate-200 hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{t('timeline.sort')}</span>
              <div className="inline-flex max-w-full rounded-full border border-white/20 bg-white/5 p-0.5">
                {[{ label: t('timeline.newestFirst'), value: 'desc' }, { label: t('timeline.oldestFirst'), value: 'asc' }].map((option) => {
                  const isActive = sortDirection === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setSortDirection(option.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                        isActive ? 'bg-white text-slate-900 shadow' : 'text-slate-200 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="relative mt-8 space-y-10 sm:mt-10">
        {status === 'loading' ? (
          <TimelineLoadingSkeleton variant="dark" showNavigator={false} cardCount={5} />
        ) : status === 'error' ? (
          <p className="body-sm text-rose-300">{error}</p>
        ) : groupedEntries.length === 0 ? (
          <p className="body-sm text-slate-300">{t('timeline.noIssuesLogged')}</p>
        ) : (
          groupedEntries.map(({ year, entries: yearEntries }) => (
            <section key={year} className="relative">
              <header className="relative z-10 mx-auto mb-6 flex max-w-3xl items-center gap-3 text-slate-300">
                <div className="h-px flex-1 bg-linear-to-r from-transparent to-accent/55" />
                <div className="rounded-2xl border border-accent/35 bg-slate-950/80 px-4 py-2 text-center shadow-xl shadow-black/25 ring-1 ring-white/5 backdrop-blur">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-accent">
                    {t('timeline.publicationYear')}
                  </p>
                  <h3 className="mt-0.5 text-xl font-black tracking-[0.18em] text-white">{year}</h3>
                </div>
                <div className="h-px flex-1 bg-linear-to-l from-transparent to-accent/55" />
              </header>
              <div className="relative grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] lg:gap-y-6">
                <div className="cinematic-timeline-spine absolute bottom-0 left-[1.15rem] top-0 w-px lg:left-1/2 lg:-translate-x-1/2" aria-hidden="true" />
                {yearEntries.map((entry, entryIndex) => {
                  const meta = entry.metadata ?? {}
                  const issueLabel = meta.issueLabel ?? entry.issue_code ?? entry.headline
                  const issueId = entry.id ?? null
                  const issueState = issueId ? issueStatesById[issueId] : undefined
                  const isSpecialEvent = isSpecialTimelineEventEntry(entry)
                  const showIssueToolbar = isAuthenticated && Boolean(issueId) && !isSpecialEvent
                  const coverImage = resolveIssueCoverImage(meta, fallbackImage)
                  const stageName =
                    meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? null
                  const stageSummary =
                    meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null
                  const pageCount = normalizeIntegerText(meta.page_count ?? meta.pageCount ?? null)
                  const entryKey = entry.id ?? `${issueLabel}-${entry.issue_date}`
                  const entrySide = entryIndex % 2 === 0 ? 'left' : 'right'

                  if (isSpecialEvent) {
                    return (
                      <div key={entryKey} className="relative min-w-0 pl-11 lg:col-span-3 lg:pl-0">
                        <span className="absolute left-[0.72rem] top-7 h-3.5 w-3.5 rounded-full border-2 border-amber-100 bg-amber-400 shadow-[0_0_0_5px_rgba(251,191,36,0.14),0_0_22px_rgba(251,191,36,0.75)] lg:left-1/2 lg:-translate-x-1/2" aria-hidden="true" />
                        <article className="relative mx-auto max-w-4xl overflow-hidden rounded-[1.5rem] border border-amber-300/35 bg-[linear-gradient(135deg,rgba(120,53,15,0.86),rgba(69,26,3,0.92))] p-4 shadow-2xl shadow-amber-950/45 ring-1 ring-amber-100/10 backdrop-blur sm:p-5">
                          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-amber-300/15 blur-3xl" aria-hidden="true" />
                          <div className="relative flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200/35 bg-amber-300/15 text-amber-100 shadow-lg shadow-amber-950/30">
                              <Flag className="h-4.5 w-4.5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
                                <span>{t('timeline.specialEventMarker')}</span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/25 bg-black/15 px-2 py-1 text-amber-100">
                                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                                  {formatDate(entry.issue_date, locale, t)}
                                </span>
                              </div>
                              <h4 className="mt-2 break-words text-lg font-black uppercase tracking-[0.06em] text-amber-50 [overflow-wrap:anywhere]">{entry.headline ?? t('timeline.specialEventFallbackTitle')}</h4>
                              {entry.summary ? <p className="mt-2 text-sm leading-relaxed text-amber-50/85">{entry.summary}</p> : null}
                            </div>
                          </div>
                        </article>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={entryKey}
                      className={`cinematic-entry cinematic-entry-${entrySide} relative min-w-0 pl-11 lg:pl-0 ${
                        entrySide === 'left' ? 'lg:col-start-1' : 'lg:col-start-3'
                      }`}
                    >
                      <span className="absolute left-[0.78rem] top-8 h-3 w-3 rounded-full border-2 border-slate-950 bg-accent shadow-[0_0_0_4px_rgba(255,255,255,0.08),0_0_18px_rgba(255,255,255,0.35)] lg:hidden" aria-hidden="true" />
                      <article className="cinematic-entry-card group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.4rem] border border-white/12 bg-slate-950/72 shadow-2xl shadow-black/35 ring-1 ring-white/5 backdrop-blur-md">
                        <div className="h-px bg-linear-to-r from-transparent via-accent/80 to-transparent" aria-hidden="true" />
                        <div className="min-w-0 flex-1 p-3 sm:p-4">
                          {stageName ? <TimelineStageTab label={stageName} variant="dark" layout="inline" /> : null}
                          <div className="mt-3 flex min-w-0 gap-3">
                            <div className="relative w-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-900/60 shadow-xl shadow-black/45 sm:w-24">
                              <div className="aspect-2/3 w-full">
                                {coverImage ? (
                                  <button
                                    type="button"
                                    className="h-full w-full cursor-zoom-in md:cursor-default"
                                    onClick={() => openCoverViewer(coverImage, issueLabel ?? t('common.issueCover'))}
                                    aria-label={t('timeline.openCoverMobile')}
                                  >
                                    <img
                                      src={coverImage}
                                      alt={issueLabel ?? t('common.issueCover')}
                                      className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                                      loading="lazy"
                                    />
                                  </button>
                                ) : (
                                  <div className="flex h-full w-full flex-col items-center justify-center bg-linear-to-b from-slate-800/70 to-slate-900 text-center text-slate-400">
                                    <span className="px-1 text-[9px] font-semibold uppercase tracking-[0.16em]">
                                      {t('timeline.coverTbd')}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-transparent to-transparent" />
                              <p className="absolute inset-x-1.5 bottom-1.5 truncate text-[10px] font-semibold text-slate-100">{issueLabel}</p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-accent">
                                <span className="max-w-full break-words rounded-full border border-accent/30 bg-accent/10 px-2 py-1 [overflow-wrap:anywhere]">
                                  {meta.series_name ?? meta.seriesName ?? t('timeline.issueFallback')}
                                </span>
                                {meta.number ? <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-slate-200">{t('timeline.noPrefix', { number: meta.number })}</span> : null}
                              </div>
                              <h4 className="mt-2 break-words text-base font-black leading-tight text-white [overflow-wrap:anywhere] sm:text-lg">{entry.headline ?? issueLabel}</h4>
                              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-100">
                                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                                {formatDate(entry.issue_date, locale, t)}
                              </p>
                            </div>
                          </div>
                          {entry.summary ? <p className="mt-3 text-sm leading-relaxed text-slate-100/88">{entry.summary}</p> : null}
                          {stageSummary ? (
                            <p className="mt-3 border-l-2 border-emerald-300/45 pl-3 text-xs leading-relaxed text-emerald-100/80">{stageSummary}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                            <dl className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-300">
                              {meta.volume ? (
                                <div>
                                  <dt className="font-bold uppercase tracking-[0.12em] text-slate-500">{t('timeline.volume')}</dt>
                                  <dd className="font-semibold text-slate-100">{meta.volume}</dd>
                                </div>
                              ) : null}
                                {meta.price ? (
                                  <div>
                                  <dt className="font-bold uppercase tracking-[0.12em] text-slate-500">{t('timeline.price')}</dt>
                                  <dd className="font-semibold text-slate-100">{meta.price}</dd>
                                  </div>
                                ) : null}
                                {pageCount ? (
                                  <div>
                                  <dt className="font-bold uppercase tracking-[0.12em] text-slate-500">{t('timeline.pages')}</dt>
                                  <dd className="font-semibold text-slate-100">{pageCount}</dd>
                                  </div>
                                ) : null}
                                {meta.rating ? (
                                  <div>
                                  <dt className="font-bold uppercase tracking-[0.12em] text-slate-500">{t('timeline.rating')}</dt>
                                  <dd className="font-semibold text-slate-100">{meta.rating}</dd>
                                  </div>
                                ) : null}
                            </dl>
                            {entry.source_url ? (
                                <a
                                  href={entry.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition hover:text-white"
                                >
                                  {t('timeline.viewIssue')}
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </a>
                              ) : null}
                          </div>
                        </div>
                        {showIssueToolbar ? (
                          <TimelineIssueToolbar
                            issueState={issueState}
                            pending={pendingIssueId === issueId}
                            onToggle={(field, nextValue) => handleIssueStateToggle(issueId, field, nextValue)}
                            variant="dark"
                            className="rounded-none border-x-0 border-b-0"
                          />
                        ) : null}
                      </article>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
      <CoverFullscreenViewer
        open={coverViewer.open}
        src={coverViewer.src}
        alt={coverViewer.alt}
        onClose={() => setCoverViewer({ open: false, src: null, alt: '' })}
      />
      {shouldShowBackToTop && typeof document !== 'undefined'
        ? createPortal(
            <button
              type="button"
              onClick={() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              aria-label="Back to top"
              className="fixed bottom-4 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white/95 shadow-lg shadow-black/35 backdrop-blur transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:hidden"
            >
              <img src="/timeline-ui/back-to-filters.png" alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
            </button>,
            document.body,
          )
        : null}
    </section>
  )
}

export default HeroTimelineCinematic




