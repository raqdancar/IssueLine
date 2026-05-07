// Render stage/collection insight panels and progress actions for a hero timeline.
import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, Info, Loader2 } from 'lucide-react'
import { backendBaseUrl } from '@/utils/backend'
import { useIssueStateMutation, useIssueStatesQuery, useStageReadMutation } from '@/hooks/useIssueStates'
import { Button } from '@/components/ui/button'
import IssueDetailsDialog from '@/components/issue-details/IssueDetailsDialog'
import StageDetailDialog from '@/components/stage-details/StageDetailDialog'
import { TimelineInsightsSkeleton } from '@/components/timeline/TimelineLoadingSkeleton'
import PrintLanguageBadge from '@/components/PrintLanguageBadge'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { buildPublicStorageUrl, resolveIssueCoverImage } from '@/lib/issueImages'
import { parseJsonResponse } from '@/lib/httpClient.js'

const COLLECTED_EDITION_IMAGE_BUCKET = import.meta.env.VITE_COLLECTED_EDITION_IMAGE_BUCKET ?? 'collected-edition-images'

const resolveStageName = (entry, t) => {
  const meta = entry?.metadata ?? {}
  return meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? t('timeline.uncategorizedStage')
}

const resolveStageSummary = (entry) => {
  const meta = entry?.metadata ?? {}
  return meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null
}

const resolveStageKey = (entry) => {
  const meta = entry?.metadata ?? {}
  const name = meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? null
  if (!name) return null
  const normalized = name.trim().toLowerCase()
  return normalized || null
}

const resolveEntryTimestamp = (entry) => {
  const meta = entry?.metadata ?? {}
  const candidates = [
    entry?.issue_date,
    meta.issueDate,
    meta.publication_date,
    meta.publicationDate,
    meta.key_date,
    meta.keyDate,
    meta.on_sale_date,
    meta.onSaleDate,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const parsed = new Date(candidate)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime()
    }
  }

  return null
}

const formatIssueDate = (value, locale, t) => {
  if (!value) return t('timeline.dateTba')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

const resolveIssueQuickLabel = (entry, t) => {
  const meta = entry?.metadata ?? {}
  const issueLabel = meta.issueLabel ?? entry.issue_code ?? null
  if (issueLabel) return issueLabel
  const number = meta.number
  if (number) return t('timeline.issueLabel', { number })
  return entry?.headline ?? t('timeline.issueFallback')
}

const buildStageGroups = (entries, stateIndex = {}, t, locale) => {
  const groups = new Map()

  entries.forEach((entry) => {
    const stageName = resolveStageName(entry, t)
    const stageKey = resolveStageKey(entry)
    if (!stageKey) return

    const timestamp = resolveEntryTimestamp(entry)
    const summary = resolveStageSummary(entry)

    if (!groups.has(stageKey)) {
      groups.set(stageKey, {
        key: stageKey,
        name: stageName,
        summary: summary ?? null,
        issueCount: 0,
        issueIds: [],
        issueItems: [],
        readCount: 0,
        startTimestamp: Number.POSITIVE_INFINITY,
        endTimestamp: Number.NEGATIVE_INFINITY,
      })
    }

    const group = groups.get(stageKey)
    group.issueCount += 1

    if (summary && !group.summary) {
      group.summary = summary
    }

    const issueId = entry.id ?? entry.metadata?.issue_id ?? entry.metadata?.issueId ?? null
    const issueTimestamp = typeof timestamp === 'number' ? timestamp : Number.POSITIVE_INFINITY

    // Keep quick-action rows lightweight but sortable by real timeline order.
    group.issueItems.push({
      key: `${issueId ?? 'unknown'}-${entry.issue_code ?? entry.headline ?? group.issueCount}`,
      issueId,
      label: resolveIssueQuickLabel(entry, t),
      dateLabel: formatIssueDate(entry.issue_date, locale, t),
      timestamp: issueTimestamp,
    })

    if (issueId) {
      group.issueIds.push(issueId)
      if (stateIndex[issueId]?.readIt) {
        group.readCount += 1
      }
    }

    if (typeof timestamp === 'number') {
      group.startTimestamp = Math.min(group.startTimestamp, timestamp)
      group.endTimestamp = Math.max(group.endTimestamp, timestamp)
    }
  })

  return Array.from(groups.values())
    .map((group) => {
      const hasStart = Number.isFinite(group.startTimestamp)
      const hasEnd = Number.isFinite(group.endTimestamp)
      const startYear = hasStart ? new Date(group.startTimestamp).getUTCFullYear() : null
      const endYear = hasEnd ? new Date(group.endTimestamp).getUTCFullYear() : null
      const yearLabel =
        startYear && endYear
          ? startYear === endYear
            ? `${startYear}`
            : `${startYear} - ${endYear}`
          : startYear
            ? `${startYear}`
            : t('timeline.yearTba')

      return {
        ...group,
        // Render issue chips in deterministic chronological order.
        issueItems: [...group.issueItems].sort((a, b) => a.timestamp - b.timestamp),
        startYear,
        endYear,
        yearLabel,
      }
    })
    .sort((a, b) => {
      const aValue = Number.isFinite(a.startTimestamp) ? a.startTimestamp : Number.POSITIVE_INFINITY
      const bValue = Number.isFinite(b.startTimestamp) ? b.startTimestamp : Number.POSITIVE_INFINITY
      return aValue - bValue
    })
}

const resolveCollectedCoverImage = (value) => buildPublicStorageUrl(value, COLLECTED_EDITION_IMAGE_BUCKET)

const buildStageCoverageMap = (stages = []) =>
  stages.reduce((acc, stage) => {
    if (!stage?.key) return acc
    acc[stage.key] = stage.count ?? 0
    return acc
  }, {})


const AutoScrollIssueStrip = ({ editionId, issues = [] }) => {
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const isInteractingRef = useRef(false)
  const resumeTimeoutRef = useRef(null)
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
  })

  const normalizedIssues = useMemo(() => issues.filter(Boolean), [issues])
  // Duplicate sequence to create a seamless marquee loop.
  const repeatedIssues = normalizedIssues.length > 1 ? [...normalizedIssues, ...normalizedIssues] : normalizedIssues

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track || normalizedIssues.length <= 1) return
    if (typeof window === 'undefined') return

    const speedPixelsPerSecond = 24
    let frameId = null
    let lastFrameTime = performance.now()

    const tick = (frameTime) => {
      const deltaSeconds = (frameTime - lastFrameTime) / 1000
      lastFrameTime = frameTime

      const loopWidth = track.scrollWidth / 2
      // Pause movement while the user is dragging or hovering the strip.
      if (!isInteractingRef.current && Number.isFinite(loopWidth) && loopWidth > viewport.clientWidth) {
        viewport.scrollLeft += speedPixelsPerSecond * deltaSeconds
        if (viewport.scrollLeft >= loopWidth) {
          viewport.scrollLeft -= loopWidth
        }
      } else if (Number.isFinite(loopWidth) && loopWidth <= viewport.clientWidth && viewport.scrollLeft !== 0) {
        viewport.scrollLeft = 0
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => {
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current)
        resumeTimeoutRef.current = null
      }
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [normalizedIssues])

  const pauseAutoScroll = () => {
    isInteractingRef.current = true
    if (resumeTimeoutRef.current && typeof window !== 'undefined') {
      window.clearTimeout(resumeTimeoutRef.current)
      resumeTimeoutRef.current = null
    }
  }

  const resumeAutoScroll = (delayMs = 0) => {
    if (typeof window === 'undefined') return
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current)
    }
    resumeTimeoutRef.current = window.setTimeout(() => {
      isInteractingRef.current = false
      resumeTimeoutRef.current = null
    }, delayMs)
  }

  const handlePointerDown = (event) => {
    const viewport = viewportRef.current
    if (!viewport) return

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
    }
    pauseAutoScroll()
    viewport.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event) => {
    const viewport = viewportRef.current
    const drag = dragStateRef.current
    if (!viewport || !drag.active || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    viewport.scrollLeft = drag.startScrollLeft - deltaX
  }

  const finishPointerDrag = (event, delayMs = 900) => {
    const viewport = viewportRef.current
    const drag = dragStateRef.current
    if (!drag.active) return
    if (event && drag.pointerId !== event.pointerId) return

    const pointerId = drag.pointerId
    dragStateRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
    }
    if (pointerId != null) {
      viewport?.releasePointerCapture?.(pointerId)
    }
    resumeAutoScroll(delayMs)
  }

  return (
    <div className="relative mt-3">
      <div
        ref={viewportRef}
        className="no-scrollbar cursor-grab select-none active:cursor-grabbing overflow-x-auto rounded-xl border border-slate-200/80 bg-linear-to-r from-slate-50 via-white to-slate-50 px-2.5 py-2"
        style={{ touchAction: 'pan-x' }}
        onMouseEnter={pauseAutoScroll}
        onMouseLeave={() => resumeAutoScroll(350)}
        onTouchStart={pauseAutoScroll}
        onTouchEnd={() => resumeAutoScroll(1200)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPointerDrag(event, 900)}
        onPointerCancel={(event) => finishPointerDrag(event, 900)}
        onPointerLeave={() => finishPointerDrag(null, 350)}
        onLostPointerCapture={() => finishPointerDrag(null, 350)}
        onFocus={pauseAutoScroll}
        onBlur={() => resumeAutoScroll(350)}
      >
        <div ref={trackRef} className="inline-flex min-w-max gap-2 pr-4">
          {repeatedIssues.map((issue, index) => {
            const issueKey = issue.heroIssueId ?? issue.gcdIssueId ?? issue.number ?? index
            const isDuplicatedToken = normalizedIssues.length > 1 && index >= normalizedIssues.length
            const isSequenceEnd =
              normalizedIssues.length > 0 && (index + 1) % normalizedIssues.length === 0
            return (
              <div key={`${editionId}-issue-${issueKey}-${isDuplicatedToken ? 'dup' : 'src'}-${index}`} className="inline-flex items-center gap-2 shrink-0">
                <span
                  className="shrink-0 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm"
                  aria-hidden={isDuplicatedToken}
                >
                  #{issue.number ?? issue.gcdIssueId}
                </span>
                {isSequenceEnd ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-primary/40 ring-2 ring-card shadow-[0_0_0_1px_rgba(15,23,42,0.08)]"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-xl bg-linear-to-r from-slate-50/95 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-xl bg-linear-to-l from-slate-50/95 to-transparent" />
    </div>
  )
}

const GaugeCard = ({ label, count, total, accentClass, t }) => {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0
  const normalized = Math.min(Math.max(percent, 0), 100)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - normalized / 100)

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-100 bg-white/80 p-4 text-center shadow-sm">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={t('timeline.percentReadTitle', { percent: normalized })}>
        <circle cx="70" cy="70" r={radius} strokeWidth="10" stroke="rgba(148, 163, 184, 0.25)" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          className={`transition-all duration-700 ${accentClass}`}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-black fill-slate-900">
          {normalized}%
        </text>
      </svg>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-700">{t('timeline.issuesCountOfTotal', { count, total: total || '\u2014' })}</p>
      </div>
    </div>
  )
}

const StageMiniProgress = ({ readCount, issueCount, isComplete, t }) => {
  const percent = issueCount > 0 ? Math.round((readCount / issueCount) * 100) : 0
  const normalized = Math.min(Math.max(percent, 0), 100)
  const radius = 11
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - normalized / 100)
  const trackColor = isComplete ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.28)'
  const arcClass = isComplete ? 'text-emerald-500' : 'text-indigo-500'

  return (
    <div className="flex h-8 w-8 items-center justify-center" title={t('timeline.percentReadTitle', { percent: normalized })} aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={radius} strokeWidth="3" stroke={trackColor} fill="none" />
        <circle
          cx="14"
          cy="14"
          r={radius}
          strokeWidth="3"
          strokeLinecap="round"
          stroke="currentColor"
          className={`transition-all duration-500 ${arcClass}`}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
      </svg>
    </div>
  )
}

function StageAccordionItem({
  stage,
  isOpen,
  onToggle,
  onOpenStageDetail,
  canManageStates,
  onBulkRead,
  actionState,
  issueStatesByIssueId,
  pendingIssueId,
  onIssueToggle,
  issueActionError,
  t,
}) {
  const isComplete = stage.issueCount > 0 && stage.readCount >= stage.issueCount
  const hasIssues = stage.issueIds.length > 0
  const buttonDisabled = !canManageStates || !hasIssues || isComplete || actionState?.loading || actionState?.disabled
  const buttonTitle = !canManageStates
    ? t('timeline.signInToTrackCollection')
    : !hasIssues
      ? t('timeline.noTrackableIssues')
      : isComplete
        ? t('timeline.allIssuesRead')
        : undefined

  const progressLabel =
    stage.issueCount > 0
      ? t('timeline.issuesCountOfTotal', { count: stage.readCount, total: stage.issueCount })
      : t('timeline.readProgressUnavailable')

  const containerClasses = isComplete
    ? 'rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm ring-1 ring-emerald-100'
    : 'rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm'

  const progressPanelClasses = isComplete
    ? 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-100/60 px-3 py-2 text-xs text-emerald-700'
    : 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600'

  const progressTextClasses = isComplete ? 'font-semibold text-emerald-800' : 'font-semibold text-slate-700'
  const completeBadgeClass = 'inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'

  return (
    <div className={containerClasses}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={isOpen}>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isComplete ? 'text-emerald-800' : 'text-slate-900'}`}>{stage.name}</p>
          <p className={`text-xs ${isComplete ? 'text-emerald-700' : 'text-slate-500'}`}>
            {stage.yearLabel} {'\u2022'} {stage.issueCount} {t('timeline.indexIssues').toLowerCase()} {'\u2022'} {progressLabel}
          </p>
        </div>
        <span className="inline-flex items-center gap-2">
          <StageMiniProgress readCount={stage.readCount} issueCount={stage.issueCount} isComplete={isComplete} t={t} />
          {isComplete ? <span className={completeBadgeClass}>{t('timeline.stageComplete')}</span> : null}
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {isOpen ? (
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {stage.summary ? (
            <p className={isComplete ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-800 shadow-sm' : undefined}>{stage.summary}</p>
          ) : (
            <p className="italic text-slate-400">{t('timeline.noStageSummary')}</p>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">{t('timeline.years')}</span> {stage.yearLabel}
            <span className="font-semibold text-slate-600">{t('timeline.issuesTracked')}</span> {stage.issueCount}
          </div>
          {stage.issueItems.length ? (
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenStageDetail?.(stage)}>
                {t('timeline.viewStageDetails')}
              </Button>
            </div>
          ) : null}
          <div className="rounded-2xl border border-slate-100 bg-white/80 p-2">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('timeline.stageIssues')}</p>
            {stage.issueItems.length ? (
              <div className="space-y-1">
                {stage.issueItems.map((issue) => {
                  const issueState = issue.issueId ? issueStatesByIssueId[issue.issueId] : null
                  const hasIt = Boolean(issueState?.haveIt)
                  const readIt = Boolean(issueState?.readIt)
                  const isPending = pendingIssueId != null && issue.issueId === pendingIssueId
                  const disableButtons = !canManageStates || !issue.issueId || (pendingIssueId != null && !isPending)

                  return (
                    <div key={issue.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{issue.label}</p>
                        <p className="text-[11px] text-slate-500">{issue.dateLabel}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={disableButtons}
                          onClick={() => onIssueToggle?.(issue.issueId, 'haveIt', !hasIt)}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                            hasIt
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                          } ${disableButtons ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          {t('timeline.haveIt')}
                        </button>
                        <button
                          type="button"
                          disabled={disableButtons}
                          onClick={() => onIssueToggle?.(issue.issueId, 'readIt', !readIt)}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                            readIt
                              ? 'border-sky-300 bg-sky-100 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'
                          } ${disableButtons ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          {t('timeline.readIt')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="px-2 pb-1 text-xs italic text-slate-400">{t('timeline.noIssueItemsQuickActions')}</p>
            )}
            {!canManageStates ? <p className="px-2 pt-2 text-xs text-slate-500">{t('timeline.signInEnableQuickActions')}</p> : null}
          </div>
          {canManageStates ? (
            <div className={progressPanelClasses}>
              <div className={progressTextClasses}>
                {progressLabel}
                {stage.issueCount > 0 ? ` (${Math.round((stage.readCount / stage.issueCount) * 100)}%)` : ''}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={buttonDisabled}
                aria-busy={actionState?.loading ? 'true' : undefined}
                title={buttonTitle}
                onClick={onBulkRead}
              >
                {isComplete ? t('timeline.allRead') : actionState?.loading ? t('timeline.marking') : t('timeline.markStageAsRead')}
              </Button>
            </div>
          ) : null}
          {issueActionError ? <p className="text-xs font-semibold text-rose-600">{issueActionError}</p> : null}
          {actionState?.errorMessage ? <p className="text-xs font-semibold text-rose-600">{actionState.errorMessage}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function HeroTimelineInsights({ heroSlug, heroName }) {
  const { t, locale } = useI18n()
  const apiBaseUrl = backendBaseUrl
  const [state, setState] = useState(() => ({
    status: !apiBaseUrl || !heroSlug ? 'disabled' : 'idle',
    entries: [],
    collectedEditions: [],
    error: null,
  }))
  const [openStage, setOpenStage] = useState(null)
  const [insightTab, setInsightTab] = useState('progress')
  const [editionActionState, setEditionActionState] = useState({ pendingEditionId: null, error: null })
  const [selectedStageKey, setSelectedStageKey] = useState(null)
  const [selectedStageIssueId, setSelectedStageIssueId] = useState(null)
  const { isAuthenticated } = useSessionContext()
  const { statesByIssueId, canFetchStates, isFetching: issueStatesLoading } = useIssueStatesQuery(heroSlug, {
    enabled: Boolean(heroSlug),
  })
  const issueStateMutation = useIssueStateMutation(heroSlug)
  const stageReadMutation = useStageReadMutation(heroSlug)

  // Fetch timeline entries plus collected-edition coverage for insights tabs.
  useEffect(() => {
    if (!apiBaseUrl || !heroSlug) {
      setState({ status: 'disabled', entries: [], collectedEditions: [], error: null })
      return undefined
    }

    const controller = new AbortController()
    setState({ status: 'loading', entries: [], collectedEditions: [], error: null })

    const loadEntries = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/hero-timelines/${encodeURIComponent(heroSlug)}`, {
          signal: controller.signal,
        })
        const payload = await parseJsonResponse(response)
        setState({
          status: 'success',
          entries: payload.entries ?? [],
          collectedEditions: payload.collectedEditionsOverview ?? [],
          error: null,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({ status: 'error', entries: [], collectedEditions: [], error: error.message || t('timeline.loadingOverview') })
      }
    }

    void loadEntries()
    return () => controller.abort()
  }, [apiBaseUrl, heroSlug, t])

  const totalIssues = state.entries.length
  const collectedEditions = state.collectedEditions ?? []
  const stageGroups = useMemo(
    () => buildStageGroups(state.entries, statesByIssueId ?? {}, t, locale),
    [state.entries, statesByIssueId, t, locale],
  )
  const stageCoverageOrder = useMemo(
    () => stageGroups.map((stage) => ({ key: stage.key, name: stage.name })),
    [stageGroups],
  )
  const stageTimelineIssuesByKey = useMemo(() => {
    const index = new Map()

    state.entries.forEach((entry) => {
      const stageKey = resolveStageKey(entry)
      if (!stageKey) return

      const metadata = entry?.metadata ?? {}
      const issueId = entry?.id ?? metadata.issue_id ?? metadata.issueId ?? null
      if (!issueId) return

      if (!index.has(stageKey)) {
        index.set(stageKey, [])
      }

      const issueNumber = metadata.number ?? entry.issue_code ?? null
      const issueTimestamp = resolveEntryTimestamp(entry)

      index.get(stageKey).push({
        key: `${stageKey}-${issueId}`,
        issueId,
        issueLabel: resolveIssueQuickLabel(entry, t),
        issueNumber,
        publishedAt:
          entry.issue_date ??
          metadata.publication_date ??
          metadata.publicationDate ??
          metadata.key_date ??
          metadata.keyDate ??
          null,
        timestamp: typeof issueTimestamp === 'number' ? issueTimestamp : Number.POSITIVE_INFINITY,
        coverImage: resolveIssueCoverImage(metadata, null),
      })
    })

    for (const [key, issues] of index.entries()) {
      // Stable sort prevents reshuffling when two issues share the same date.
      const sorted = [...issues].sort((a, b) => {
        if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
        const aNumber = Number.parseFloat(String(a.issueNumber ?? ''))
        const bNumber = Number.parseFloat(String(b.issueNumber ?? ''))
        const safeA = Number.isFinite(aNumber) ? aNumber : Number.POSITIVE_INFINITY
        const safeB = Number.isFinite(bNumber) ? bNumber : Number.POSITIVE_INFINITY
        return safeA - safeB
      })
      index.set(key, sorted)
    }

    return index
  }, [state.entries, t])

  const selectedStage = useMemo(
    () => stageGroups.find((stage) => stage.key === selectedStageKey) ?? null,
    [stageGroups, selectedStageKey],
  )
  const selectedStageIssues = useMemo(
    () => (selectedStageKey ? stageTimelineIssuesByKey.get(selectedStageKey) ?? [] : []),
    [selectedStageKey, stageTimelineIssuesByKey],
  )
  const issueStatesArray = useMemo(() => Object.values(statesByIssueId ?? {}), [statesByIssueId])
  const haveItCount = issueStatesArray.filter((item) => item.haveIt).length
  const readItCount = issueStatesArray.filter((item) => item.readIt).length

  const timelineRange = useMemo(() => {
    if (!state.entries.length) return { label: t('timeline.yearTba') }
    const timestamps = state.entries
      .map((entry) => resolveEntryTimestamp(entry))
      .filter((value) => typeof value === 'number' && !Number.isNaN(value))
    if (!timestamps.length) return { label: t('timeline.yearTba') }

    const start = new Date(Math.min(...timestamps)).getUTCFullYear()
    const end = new Date(Math.max(...timestamps)).getUTCFullYear()
    return {
      startYear: start,
      endYear: end,
      label: start === end ? `${start}` : `${start} - ${end}`,
    }
  }, [state.entries, t])

  if (!heroSlug) {
    return null
  }

  if (state.status === 'disabled') {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
        {t('timeline.configureBackendForInsights')}
      </div>
    )
  }

  const stageActionKey = stageReadMutation.variables?.stageKey ?? null
  const pendingIssueId = issueStateMutation.isPending ? issueStateMutation.variables?.issueId ?? null : null
  const buildActionState = (stageKey) => ({
    loading: stageReadMutation.isPending && stageActionKey === stageKey,
    disabled: stageReadMutation.isPending && stageActionKey !== null && stageActionKey !== stageKey,
    errorMessage:
      stageReadMutation.isError && stageActionKey === stageKey
        ? stageReadMutation.error?.message ?? t('timeline.unableMarkStageRead')
        : null,
  })

  const issueActionError = issueStateMutation.isError
    ? issueStateMutation.error?.message ?? t('timeline.unableUpdateIssueState')
    : null

  const handleStageBulkRead = (stage) => {
    if (!stage?.key || !stage.issueIds?.length) {
      return
    }
    stageReadMutation.mutate({ stageKey: stage.key, issueIds: stage.issueIds })
  }

  const handleIssueToggle = (issueId, field, nextValue) => {
    if (!issueId || !canFetchStates) return
    issueStateMutation.mutate({ issueId, patch: { [field]: nextValue } })
  }

  const handleOpenStageDetail = (stage) => {
    if (!stage?.key) return
    setSelectedStageKey(stage.key)
  }

  const handleCloseStageDetail = () => {
    setSelectedStageKey(null)
    setSelectedStageIssueId(null)
  }

  const handleOpenIssueDetail = (issue) => {
    if (!issue?.issueId) return
    setSelectedStageIssueId(issue.issueId)
  }

  const handleCloseIssueDetail = () => {
    setSelectedStageIssueId(null)
  }

  const getCollectedEditionTimelineIssueIds = (edition) =>
    Array.from(new Set((edition?.issues ?? []).map((issue) => issue?.timelineIssueId).filter(Boolean)))

  const isCollectedEditionOwned = (edition) => {
    const editionId = String(edition?.id ?? '')
    if (!editionId) return false

    const issueIds = getCollectedEditionTimelineIssueIds(edition)
    if (!issueIds.length) return false

    return issueIds.every((issueId) => {
      const issueState = statesByIssueId?.[issueId]
      const selectedEditionIds = Array.isArray(issueState?.collectedEditionIds) ? issueState.collectedEditionIds.map(String) : []
      return Boolean(issueState?.haveIt) && selectedEditionIds.includes(editionId)
    })
  }

  const handleCollectedEditionToggle = async (edition) => {
    if (!canFetchStates || !edition?.id) return

    const editionId = String(edition.id)
    const issueIds = getCollectedEditionTimelineIssueIds(edition)
    if (!issueIds.length) return

    const currentlyOwned = isCollectedEditionOwned(edition)
    setEditionActionState({ pendingEditionId: editionId, error: null })

    try {
      if (!currentlyOwned) {
        // Attach ownership to one seed issue; backend sync expands state as needed.
        await issueStateMutation.mutateAsync({
          issueId: issueIds[0],
          patch: { haveIt: true, collectedEditionIds: [editionId] },
        })
      } else {
        // Remove this edition id from every linked issue in the overview.
        for (const issueId of issueIds) {
          const issueState = statesByIssueId?.[issueId] ?? null
          if (!issueState?.haveIt && !Array.isArray(issueState?.collectedEditionIds)) continue

          const selectedEditionIds = Array.isArray(issueState?.collectedEditionIds) ? issueState.collectedEditionIds.map(String) : []
          const nextCollectedEditionIds = selectedEditionIds.filter((id) => id !== editionId)

          if (selectedEditionIds.length === nextCollectedEditionIds.length) continue

          if (nextCollectedEditionIds.length) {
            await issueStateMutation.mutateAsync({
              issueId,
              patch: { haveIt: true, collectedEditionIds: nextCollectedEditionIds },
            })
          } else {
            await issueStateMutation.mutateAsync({
              issueId,
              patch: { haveIt: false, collectedEditionIds: [] },
            })
          }
        }
      }
      setEditionActionState({ pendingEditionId: null, error: null })
    } catch (error) {
      setEditionActionState({
        pendingEditionId: null,
        error: error?.message ?? t('timeline.unableUpdateIssueState'),
      })
    }
  }

  return (
    <section className="overflow-x-hidden rounded-[32px] border border-slate-100 bg-linear-to-br from-white via-slate-50 to-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow text-indigo-500">{t('timeline.publishingResume')}</p>
          <h3 className="title-md text-slate-900">
            {heroName ? t('timeline.recordedSaga', { heroName }) : t('timeline.recordedSagaFallback')}
          </h3>
          <p className="text-sm text-slate-600">
            {state.status === 'loading'
              ? t('timeline.loadingOverview')
              : state.status === 'error'
                ? state.error
                : t('timeline.overviewSentence', { totalIssues, rangeLabel: timelineRange.label })}
          </p>
        </div>
        {state.status === 'success' ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-center text-white shadow-inner shadow-slate-900/20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">{t('timeline.coverage')}</p>
            <p className="text-xl font-black tracking-wide">{timelineRange.label}</p>
            <p className="text-xs text-white/70">{t('timeline.trackedIssues', { count: totalIssues })}</p>
          </div>
        ) : null}
      </div>

      {state.status === 'success' ? (
        <div className="mt-6 space-y-6">
          <div className="w-full overflow-x-auto">
            <div role="tablist" aria-label={t('timeline.publishingResume')} className="inline-flex min-w-full items-end gap-2 border-b border-border/80">
              <button
                type="button"
                role="tab"
                aria-selected={insightTab === 'progress'}
                className={`-mb-px rounded-t-xl border-x border-t border-b px-4 py-2 text-sm font-semibold transition ${
                  insightTab === 'progress'
                    ? 'border-primary/70 border-b-card bg-card text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                }`}
                onClick={() => setInsightTab('progress')}
              >
                {t('timeline.collectionProgress')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={insightTab === 'collected'}
                className={`-mb-px rounded-t-xl border-x border-t border-b px-4 py-2 text-sm font-semibold transition ${
                  insightTab === 'collected'
                    ? 'border-primary/70 border-b-card bg-card text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                }`}
                onClick={() => setInsightTab('collected')}
              >
                {t('timeline.collectedEditionsTab')}
              </button>
            </div>
          </div>

          {insightTab === 'progress' ? (
            <>
              <div className="space-y-4 rounded-3xl border border-slate-100 bg-white/60 p-4 shadow-inner">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">{t('timeline.collectionProgress')}</p>
                {isAuthenticated ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <GaugeCard label={t('timeline.haveIt')} count={haveItCount} total={totalIssues} accentClass="text-emerald-500" t={t} />
                    <GaugeCard label={t('timeline.readIt')} count={readItCount} total={totalIssues} accentClass="text-indigo-500" t={t} />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{t('timeline.signInForCharts')}</p>
                )}

                {!canFetchStates && isAuthenticated ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {t('timeline.signInToTrackOwnedRead')}
                  </p>
                ) : issueStatesLoading ? (
                  <p className="text-xs text-slate-500">{t('timeline.syncingCollection')}</p>
                ) : null}
              </div>

              <div className="space-y-3">
                {stageGroups.length === 0 ? (
                  <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm text-slate-500">
                    {t('timeline.stageMetadataMissing')}
                  </div>
                ) : (
                  stageGroups.map((stage) => (
                    <StageAccordionItem
                      key={stage.key}
                      stage={stage}
                      isOpen={openStage === stage.key}
                      onToggle={() => setOpenStage((current) => (current === stage.key ? null : stage.key))}
                      onOpenStageDetail={handleOpenStageDetail}
                      canManageStates={canFetchStates}
                      onBulkRead={() => handleStageBulkRead(stage)}
                      actionState={buildActionState(stage.key)}
                      issueStatesByIssueId={statesByIssueId}
                      pendingIssueId={pendingIssueId}
                      onIssueToggle={handleIssueToggle}
                      issueActionError={issueActionError}
                      t={t}
                    />
                  ))
                )}
              </div>
            </>
          ) : null}

          {insightTab === 'collected' ? (
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">{t('timeline.collectedCoverageTitle')}</p>
                <p className="text-xs text-slate-500">{t('timeline.collectedCoverageSubtitle')}</p>
              </div>
              {collectedEditions.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {collectedEditions.map((edition) => {
                    const coverImage = resolveCollectedCoverImage(edition.coverImageUrl)
                    const stageCoverage = buildStageCoverageMap(edition.stages)
                    const coveredStageCount = edition.stages?.length ?? 0
                    const editionId = String(edition.id)
                    const editionTimelineIssueIds = getCollectedEditionTimelineIssueIds(edition)
                    const isEditionOwned = isCollectedEditionOwned(edition)
                    const isEditionActionPending = editionActionState.pendingEditionId === editionId
                    const editionActionDisabled = !canFetchStates || isEditionActionPending || !editionTimelineIssueIds.length

                    return (
                      <article key={edition.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex gap-3">
                          <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                            {coverImage ? (
                              <img
                                src={coverImage}
                                alt={edition.title ? `${edition.title} cover` : 'Collected edition cover'}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-100 px-1 text-center">
                                <span className="body-xs text-slate-500">{t('timeline.noCover')}</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <p className="min-w-0 body-sm font-semibold break-words text-slate-900">{edition.title}</p>
                              <button
                                type="button"
                                aria-pressed={isEditionOwned}
                                aria-label={t('timeline.addToCollection')}
                                aria-busy={isEditionActionPending ? 'true' : undefined}
                                disabled={editionActionDisabled}
                                title={
                                  !canFetchStates
                                    ? t('timeline.signInToTrackOwnedRead')
                                    : isEditionActionPending
                                      ? t('timeline.savingUpdate')
                                      : t('timeline.addToCollection')
                                }
                                onClick={() => void handleCollectedEditionToggle(edition)}
                                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                                  isEditionOwned
                                    ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900/30 hover:text-slate-900'
                                } ${editionActionDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
                              >
                                {isEditionActionPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                            {edition.subtitle ? <p className="body-xs break-words text-slate-600">{edition.subtitle}</p> : null}
                            <div className="body-xs flex flex-wrap items-center gap-1.5 text-slate-500">
                              <span>{edition.format ?? 'unknown'}</span>
                              <PrintLanguageBadge value={edition.printLanguage ?? edition.print_language} />
                              {edition.publicationDate ? <span>{edition.publicationDate}</span> : null}
                            </div>
                            <p className="body-xs text-slate-500">
                              {t('timeline.collectedIssuesCount', { count: edition.issueCount ?? 0 })}
                              {' - '}
                              {t('timeline.collectedStagesCount', { count: coveredStageCount })}
                            </p>
                          </div>
                        </div>

                        {stageCoverageOrder.length ? (
                          <div className="mt-3 space-y-2">
                            <div className="flex gap-1">
                              {stageCoverageOrder.map((stage) => {
                                const count = stageCoverage[stage.key] ?? 0
                                return (
                                  <div
                                    key={`${edition.id}-${stage.key}`}
                                    className={`h-2 flex-1 rounded-full ${count > 0 ? 'bg-indigo-500' : 'bg-slate-200'}`}
                                    title={`${stage.name}: ${count} ${t('timeline.indexIssues').toLowerCase()}`}
                                  />
                                )
                              })}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(edition.stages ?? []).map((stage) => (
                                <span
                                  key={`${edition.id}-stage-${stage.key}`}
                                  className="inline-flex max-w-full rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold leading-tight whitespace-normal break-words text-indigo-700"
                                >
                                  {stage.name} ({stage.count})
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <AutoScrollIssueStrip editionId={edition.id} issues={edition.issues ?? []} />
                      </article>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t('timeline.collectedCoverageEmpty')}</p>
              )}
              {editionActionState.error ? <p className="text-xs font-semibold text-rose-600">{editionActionState.error}</p> : null}
            </div>
          ) : null}
        </div>
      ) : state.status === 'loading' ? (
        <TimelineInsightsSkeleton />
      ) : null}
      <StageDetailDialog
        open={Boolean(selectedStage)}
        onClose={handleCloseStageDetail}
        stage={selectedStage}
        issues={selectedStageIssues}
        onIssueSelect={handleOpenIssueDetail}
      />
      <IssueDetailsDialog
        open={Boolean(selectedStageIssueId)}
        heroSlug={heroSlug}
        issueId={selectedStageIssueId}
        fallbackImage={null}
        issueState={selectedStageIssueId ? statesByIssueId?.[selectedStageIssueId] : null}
        canUseIssueStateActions={canFetchStates}
        issueStatePending={pendingIssueId === selectedStageIssueId}
        issueStateDisabled={!canFetchStates}
        issueStateDisabledReason={canFetchStates ? undefined : t('timeline.signInToTrackCollection')}
        onIssueStateToggle={(field, nextValue) =>
          selectedStageIssueId ? handleIssueToggle(selectedStageIssueId, field, nextValue) : undefined
        }
        onClose={handleCloseIssueDetail}
      />
    </section>
  )
}

export default HeroTimelineInsights

