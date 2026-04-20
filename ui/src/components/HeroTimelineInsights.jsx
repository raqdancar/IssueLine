import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { backendBaseUrl } from '@/utils/backend'
import { useIssueStateMutation, useIssueStatesQuery, useStageReadMutation } from '@/hooks/useIssueStates'
import { Button } from '@/components/ui/button'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { buildPublicStorageUrl } from '@/lib/issueImages'

const COLLECTED_EDITION_IMAGE_BUCKET = import.meta.env.VITE_COLLECTED_EDITION_IMAGE_BUCKET ?? 'collected-edition-images'

const resolveStageName = (entry, t) => {
  const meta = entry?.metadata ?? {}
  return meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? t('timeline.uncategorizedStage')
}

const resolveStageSummary = (entry) => {
  const meta = entry?.metadata ?? {}
  return meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null
}

const resolveStageColor = (name) => {
  if (!name) return 'bg-slate-100 text-slate-600'
  if (/strange tales/i.test(name)) return 'bg-amber-50 text-amber-700'
  if (/sorcerer supreme/i.test(name)) return 'bg-indigo-50 text-indigo-700'
  if (/legacy/i.test(name)) return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-600'
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
        <p className="text-sm font-semibold text-slate-700">{t('timeline.issuesCountOfTotal', { count, total: total || '—' })}</p>
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

  const badgeClasses = isComplete
    ? 'inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'
    : `inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${resolveStageColor(stage.name)}`

  const progressPanelClasses = isComplete
    ? 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-100/60 px-3 py-2 text-xs text-emerald-700'
    : 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600'

  const progressTextClasses = isComplete ? 'font-semibold text-emerald-800' : 'font-semibold text-slate-700'

  return (
    <div className={containerClasses}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={isOpen}>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isComplete ? 'text-emerald-800' : 'text-slate-900'}`}>{stage.name}</p>
          <p className={`text-xs ${isComplete ? 'text-emerald-700' : 'text-slate-500'}`}>
            {stage.yearLabel} • {stage.issueCount} {t('timeline.indexIssues').toLowerCase()} • {progressLabel}
          </p>
        </div>
        <span className="inline-flex items-center gap-2">
          <StageMiniProgress readCount={stage.readCount} issueCount={stage.issueCount} isComplete={isComplete} t={t} />
          <span className={badgeClasses}>{isComplete ? t('timeline.stageComplete') : t('timeline.stage')}</span>
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
  const { isAuthenticated } = useSessionContext()
  const { statesByIssueId, canFetchStates, isFetching: issueStatesLoading } = useIssueStatesQuery(heroSlug, {
    enabled: Boolean(heroSlug),
  })
  const issueStateMutation = useIssueStateMutation(heroSlug)
  const stageReadMutation = useStageReadMutation(heroSlug)

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
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? `Request failed with status ${response.status}`)
        }
        const payload = await response.json()
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

  return (
    <section className="rounded-[32px] border border-slate-100 bg-linear-to-br from-white via-slate-50 to-white p-6 shadow-sm">
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
                  const visibleIssues = (edition.issues ?? []).slice(0, 8)
                  const hiddenIssuesCount = Math.max((edition.issues?.length ?? 0) - visibleIssues.length, 0)

                  return (
                    <article key={edition.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex gap-3">
                        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                          {coverImage ? (
                            <img src={coverImage} alt={edition.title ?? t('issueDetails.collected.placeholderTitle')} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-100 px-1 text-center">
                              <span className="body-xs text-slate-500">{t('timeline.noCover')}</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="body-sm font-semibold text-slate-900 break-words">{edition.title}</p>
                          {edition.subtitle ? <p className="body-xs text-slate-600 break-words">{edition.subtitle}</p> : null}
                          <p className="body-xs text-slate-500">
                            {edition.format ?? 'unknown'}{edition.publicationDate ? ` - ${edition.publicationDate}` : ''}
                          </p>
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
                              <span key={`${edition.id}-stage-${stage.key}`} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                {stage.name} ({stage.count})
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {visibleIssues.map((issue) => (
                          <span key={`${edition.id}-issue-${issue.heroIssueId ?? issue.gcdIssueId}`} className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                            #{issue.number ?? issue.gcdIssueId}
                          </span>
                        ))}
                        {hiddenIssuesCount > 0 ? (
                          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700">+{hiddenIssuesCount}</span>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('timeline.collectedCoverageEmpty')}</p>
            )}
          </div>
        </div>
      ) : state.status === 'loading' ? (
        <div className="mt-6 h-32 animate-pulse rounded-2xl bg-slate-100/70" />
      ) : null}
    </section>
  )
}

export default HeroTimelineInsights

