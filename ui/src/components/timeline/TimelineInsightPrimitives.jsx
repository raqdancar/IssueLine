// Construeix peces visuals i derivacions de la cronologia d'issues.
import { useEffect, useMemo, useRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ALL_FILTER_VALUE } from '@/components/timeline/timelineInsightsViewModel'

export function CollectedFilterSelect({ label, value, allLabel, options, onChange }) {
  const selectedLabel = value === ALL_FILTER_VALUE ? allLabel : options.find((option) => option.value === value)?.label ?? allLabel
  const normalizedOptions = [{ value: ALL_FILTER_VALUE, label: allLabel }, ...options]

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-white px-4 text-left text-sm font-semibold text-red-800 shadow-sm shadow-amber-100/60 transition hover:border-amber-400 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50"
          >
            <span className="min-w-0 truncate">{selectedLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] rounded-2xl border border-amber-200 bg-white/98 p-1.5 shadow-xl shadow-slate-900/12"
        >
          <div className="max-h-72 overflow-y-auto">
            {normalizedOptions.map((option) => {
              const selected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(option.value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    selected ? 'bg-red-50 text-red-800' : 'text-slate-700 hover:bg-amber-50 hover:text-red-800'
                  }`}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" /> : null}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export const AutoScrollIssueStrip = ({ editionId, issues = [] }) => {
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const isInteractingRef = useRef(false)
  const resumeTimeoutRef = useRef(null)
  const dragStateRef = useRef({ active: false, pointerId: null, startX: 0, startScrollLeft: 0 })
  const normalizedIssues = useMemo(() => issues.filter(Boolean), [issues])
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
      if (!isInteractingRef.current && Number.isFinite(loopWidth) && loopWidth > viewport.clientWidth) {
        viewport.scrollLeft += speedPixelsPerSecond * deltaSeconds
        if (viewport.scrollLeft >= loopWidth) viewport.scrollLeft -= loopWidth
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
      if (frameId !== null) window.cancelAnimationFrame(frameId)
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
    if (resumeTimeoutRef.current) window.clearTimeout(resumeTimeoutRef.current)
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
    viewport.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX)
  }

  const finishPointerDrag = (event, delayMs = 900) => {
    const viewport = viewportRef.current
    const drag = dragStateRef.current
    if (!drag.active) return
    if (event && drag.pointerId !== event.pointerId) return
    const pointerId = drag.pointerId
    dragStateRef.current = { active: false, pointerId: null, startX: 0, startScrollLeft: 0 }
    if (pointerId != null) viewport?.releasePointerCapture?.(pointerId)
    resumeAutoScroll(delayMs)
  }

  return (
    <div className="relative mt-3 min-w-0 max-w-full">
      <div
        ref={viewportRef}
        className="no-scrollbar max-w-full cursor-grab select-none active:cursor-grabbing overflow-x-auto rounded-xl border border-slate-200/80 bg-linear-to-r from-slate-50 via-white to-slate-50 px-2.5 py-2"
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
        <div ref={trackRef} className="inline-flex min-w-max max-w-none gap-2 pr-4">
          {repeatedIssues.map((issue, index) => {
            const issueKey = issue.heroIssueId ?? issue.gcdIssueId ?? issue.number ?? index
            const isDuplicatedToken = normalizedIssues.length > 1 && index >= normalizedIssues.length
            const isSequenceEnd = normalizedIssues.length > 0 && (index + 1) % normalizedIssues.length === 0
            return (
              <div key={`${editionId}-issue-${issueKey}-${isDuplicatedToken ? 'dup' : 'src'}-${index}`} className="inline-flex items-center gap-2 shrink-0">
                <span className="shrink-0 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm" aria-hidden={isDuplicatedToken}>
                  #{issue.number ?? issue.gcdIssueId}
                </span>
                {isSequenceEnd ? <span className="h-2.5 w-2.5 rounded-full bg-primary/40 ring-2 ring-card shadow-[0_0_0_1px_rgba(15,23,42,0.08)]" aria-hidden="true" /> : null}
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

export const GaugeCard = ({ label, count, total, accentClass, t }) => {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0
  const normalized = Math.min(Math.max(percent, 0), 100)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - normalized / 100)

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3 text-left shadow-sm md:flex-col md:justify-start md:text-center lg:rounded-3xl lg:p-4">
      <div className="min-w-0 md:order-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 sm:tracking-[0.22em] lg:tracking-[0.3em]">{label}</p>
        <p className="text-sm font-semibold text-slate-700">{t('timeline.issuesCountOfTotal', { count, total: total || '\u2014' })}</p>
      </div>
      <svg className="h-24 w-24 shrink-0 md:order-1 md:h-28 md:w-28 lg:h-[140px] lg:w-[140px]" viewBox="0 0 140 140" role="img" aria-label={t('timeline.percentReadTitle', { percent: normalized })}>
        <circle cx="70" cy="70" r={radius} strokeWidth="10" stroke="rgba(148, 163, 184, 0.25)" fill="none" />
        <circle cx="70" cy="70" r={radius} strokeWidth="10" strokeLinecap="round" stroke="currentColor" className={`transition-all duration-700 ${accentClass}`} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={dashOffset} />
        <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-black fill-slate-900">{normalized}%</text>
      </svg>
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
        <circle cx="14" cy="14" r={radius} strokeWidth="3" strokeLinecap="round" stroke="currentColor" className={`transition-all duration-500 ${arcClass}`} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={dashOffset} />
      </svg>
    </div>
  )
}

export function StageAccordionItem({
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
  const buttonTitle = !canManageStates ? t('timeline.signInToTrackCollection') : !hasIssues ? t('timeline.noTrackableIssues') : isComplete ? t('timeline.allIssuesRead') : undefined
  const progressLabel = stage.issueCount > 0 ? t('timeline.issuesCountOfTotal', { count: stage.readCount, total: stage.issueCount }) : t('timeline.readProgressUnavailable')
  const containerClasses = isComplete ? 'rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm ring-1 ring-emerald-100' : 'rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm'
  const progressPanelClasses = isComplete ? 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-100/60 px-3 py-2 text-xs text-emerald-700' : 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600'
  const progressTextClasses = isComplete ? 'font-semibold text-emerald-800' : 'font-semibold text-slate-700'

  return (
    <div className={containerClasses}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={isOpen}>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isComplete ? 'text-emerald-800' : 'text-slate-900'}`}>{stage.name}</p>
          <p className={`text-xs ${isComplete ? 'text-emerald-700' : 'text-slate-500'}`}>{stage.yearLabel} {'\u2022'} {stage.issueCount} {t('timeline.indexIssues').toLowerCase()} {'\u2022'} {progressLabel}</p>
        </div>
        <span className="inline-flex items-center gap-2">
          <StageMiniProgress readCount={stage.readCount} issueCount={stage.issueCount} isComplete={isComplete} t={t} />
          {isComplete ? <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t('timeline.stageComplete')}</span> : null}
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {isOpen ? (
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {stage.summary ? <p className={isComplete ? 'rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-800 shadow-sm' : undefined}>{stage.summary}</p> : <p className="italic text-slate-400">{t('timeline.noStageSummary')}</p>}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">{t('timeline.years')}</span> {stage.yearLabel}
            <span className="font-semibold text-slate-600">{t('timeline.issuesTracked')}</span> {stage.issueCount}
          </div>
          {stage.issueItems.length ? <div><Button type="button" size="sm" variant="outline" onClick={() => onOpenStageDetail?.(stage)}>{t('timeline.viewStageDetails')}</Button></div> : null}
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
                        <button type="button" disabled={disableButtons} onClick={() => onIssueToggle?.(issue.issueId, 'haveIt', !hasIt)} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${hasIt ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'} ${disableButtons ? 'cursor-not-allowed opacity-50' : ''}`}>{t('timeline.haveIt')}</button>
                        <button type="button" disabled={disableButtons} onClick={() => onIssueToggle?.(issue.issueId, 'readIt', !readIt)} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${readIt ? 'border-sky-300 bg-sky-100 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800'} ${disableButtons ? 'cursor-not-allowed opacity-50' : ''}`}>{t('timeline.readIt')}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="px-2 pb-1 text-xs italic text-slate-400">{t('timeline.noIssueItemsQuickActions')}</p>}
            {!canManageStates ? <p className="px-2 pt-2 text-xs text-slate-500">{t('timeline.signInEnableQuickActions')}</p> : null}
          </div>
          {canManageStates ? (
            <div className={progressPanelClasses}>
              <div className={progressTextClasses}>{progressLabel}{stage.issueCount > 0 ? ` (${Math.round((stage.readCount / stage.issueCount) * 100)}%)` : ''}</div>
              <Button type="button" size="sm" variant="outline" disabled={buttonDisabled} aria-busy={actionState?.loading ? 'true' : undefined} title={buttonTitle} onClick={onBulkRead}>
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
