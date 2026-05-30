// Renderitza un component reutilitzable de la interfície d'IssueLine.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minimize2 } from 'lucide-react'
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
import { canUseFullscreen, exitDocumentFullscreen, isElementFullscreen, requestElementFullscreen } from '@/lib/fullscreen.js'
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
      setIsFullscreen(isElementFullscreen(element, document))
      setFullscreenEnabled(canUseFullscreen(element))
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
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
      className={`relative mt-4 border bg-slate-900 p-6 text-slate-100 shadow-2xl transition ${
        isFullscreen
          ? 'h-screen min-h-screen overflow-y-auto rounded-none border-slate-700/60 bg-[radial-gradient(circle_at_15%_0%,rgba(129,140,248,0.2),transparent_36%),radial-gradient(circle_at_88%_8%,rgba(56,189,248,0.16),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.98)_40%,rgba(2,6,23,0.98)_100%)]'
          : 'overflow-hidden rounded-3xl border-slate-900/10'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-linear-to-b from-transparent via-indigo-500 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.35),transparent_55%)]" />
      </div>
      {isFullscreen ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-10 top-12 h-36 w-36 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute right-8 top-24 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-36 bg-linear-to-b from-indigo-200/10 via-sky-200/5 to-transparent" />
        </div>
      ) : null}
      <div className="relative flex flex-wrap items-baseline justify-between gap-3">
        <div>
          {isFullscreen ? (
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.35em] text-indigo-200">{t('timeline.showcaseMode')}</p>
          ) : null}
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{t('timeline.cinematicTimeline')}</p>
          {timelineLogoSrc && logoVisible ? (
            <img
              src={timelineLogoSrc}
              alt={timelineLogoAlt ?? heroName}
              className="mt-1 h-12 w-auto max-w-full object-contain sm:h-16 sm:max-w-90"
              loading="lazy"
              onError={() => setLogoVisible(false)}
            />
          ) : (
            <h3 className="title-sm text-white">{heroName}</h3>
          )}
          <p className="body-xs text-slate-400">{t('timeline.groupedByYear')}</p>
        </div>
        <div className="flex flex-col items-end gap-3 text-xs text-slate-300 sm:flex-row sm:items-center">
          {fullscreenEnabled ? (
            <button
              type="button"
              onClick={handleToggleFullscreen}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? t('timeline.exitFullscreen') : t('timeline.enterFullscreen')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {isFullscreen ? t('timeline.exitFullscreen') : t('timeline.enterFullscreen')}
            </button>
          ) : null}
          <div className="flex items-center gap-2">
            {hasCanonicalTimelineOrder ? (
              <div className="inline-flex rounded-full border border-white/20 bg-white/5 p-0.5">
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
                        isActive ? 'bg-indigo-200 text-slate-950 shadow' : 'text-slate-200 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t('timeline.sort')}</span>
            <div className="inline-flex rounded-full border border-white/20 bg-white/5 p-0.5">
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
      <div className="relative mt-6 space-y-6">
        {status === 'loading' ? (
          <TimelineLoadingSkeleton variant="dark" showNavigator={false} cardCount={5} />
        ) : status === 'error' ? (
          <p className="body-sm text-rose-300">{error}</p>
        ) : groupedEntries.length === 0 ? (
          <p className="body-sm text-slate-300">{t('timeline.noIssuesLogged')}</p>
        ) : (
          groupedEntries.map(({ year, entries: yearEntries }) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="h-px flex-1 bg-slate-700/60" />
                <span className="text-sm font-semibold tracking-widest text-slate-200">{year}</span>
                <div className="h-px flex-1 bg-slate-700/60" />
              </div>
              <div className="space-y-4">
                {yearEntries.map((entry) => {
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
                  return (
                    <article
                      key={entry.id ?? `${issueLabel}-${entry.issue_date}`}
                      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-black/30 backdrop-blur transition duration-300 hover:border-white/30 hover:bg-white/10"
                    >
                      <div className="flex">
                        {stageName ? <TimelineStageTab label={stageName} variant="dark" /> : null}
                        <div className="flex-1 p-4">
                          <div className="flex flex-1 flex-col gap-4 md:flex-row">
                            <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 md:w-40">
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
                                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                      loading="lazy"
                                    />
                                  </button>
                                ) : (
                                  <div className="flex h-full w-full flex-col items-center justify-center bg-linear-to-b from-slate-800/70 to-slate-900 text-center text-slate-400">
                                    <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">
                                      {t('timeline.coverTbd')}
                                    </span>
                                    <span className="text-[11px] text-slate-500">{t('timeline.addOneInSupabase')}</span>
                                  </div>
                                )}
                              </div>
                              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-transparent" />
                              <p className="absolute bottom-2 left-2 text-xs font-semibold text-slate-100">{issueLabel}</p>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-200">
                                <span className="rounded-full border border-indigo-400/40 px-2 py-0.5">
                                  {meta.series_name ?? meta.seriesName ?? t('timeline.issueFallback')}
                                </span>
                                {meta.number ? <span>{t('timeline.noPrefix', { number: meta.number })}</span> : null}
                                {meta.volume ? <span>{t('timeline.volume')} {meta.volume}</span> : null}
                              </div>
                              <h4 className="text-base font-semibold leading-tight text-slate-50 sm:text-lg">{entry.headline}</h4>
                              {entry.summary ? <p className="text-sm leading-relaxed text-slate-100/90">{entry.summary}</p> : null}
                              {stageSummary ? (
                                <p className="text-xs text-emerald-100/80">{stageSummary}</p>
                              ) : null}
                              <dl className="grid gap-2 text-xs text-slate-100 sm:grid-cols-2">
                                  <div>
                                  <dt className="font-semibold text-slate-100">{t('timeline.release')}</dt>
                                  <dd className="font-semibold text-amber-100">{formatDate(entry.issue_date, locale, t)}</dd>
                                </div>
                                {meta.price ? (
                                  <div>
                                    <dt className="font-semibold text-slate-100">{t('timeline.price')}</dt>
                                    <dd className="font-semibold text-amber-100">{meta.price}</dd>
                                  </div>
                                ) : null}
                                {pageCount ? (
                                  <div>
                                    <dt className="font-semibold text-slate-100">{t('timeline.pages')}</dt>
                                    <dd className="font-semibold text-amber-100">{pageCount}</dd>
                                  </div>
                                ) : null}
                                {meta.rating ? (
                                  <div>
                                    <dt className="font-semibold text-slate-100">{t('timeline.rating')}</dt>
                                    <dd className="font-semibold text-amber-100">{meta.rating}</dd>
                                  </div>
                                ) : null}
                              </dl>
                              {entry.source_url && !isSpecialEvent ? (
                                <a
                                  href={entry.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-200 hover:text-white"
                                >
                                  {t('timeline.viewIssue')}
                                </a>
                              ) : null}
                            </div>
                          </div>
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
                  )
                })}
              </div>
            </div>
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




