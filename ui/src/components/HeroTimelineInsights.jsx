import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { backendBaseUrl } from '@/utils/backend'
import { useIssueStatesQuery, useStageReadMutation } from '@/hooks/useIssueStates'
import { Button } from '@/components/ui/button'

const resolveStageName = (entry) => {
  const meta = entry?.metadata ?? {}
  return (
    meta.stage_name ??
    meta.stageName ??
    meta.stage?.name ??
    meta.stage?.label ??
    'Uncategorized Stage'
  )
}

const resolveStageSummary = (entry) => {
  const meta = entry?.metadata ?? {}
  return (
    meta.stage_summary ??
    meta.stageSummary ??
    meta.stage?.short_summary ??
    meta.stage?.summary ??
    null
  )
}

const resolveStageColor = (name) => {
  if (!name) return 'bg-slate-100 text-slate-600'
  if (/strange tales/i.test(name)) return 'bg-amber-50 text-amber-700'
  if (/sorcerer supreme/i.test(name)) return 'bg-indigo-50 text-indigo-700'
  if (/legacy/i.test(name)) return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-600'
}

const resolveStageKey = (entry) => {
  const name = resolveStageName(entry)
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

const buildStageGroups = (entries, stateIndex = {}) => {
  const groups = new Map()
  entries.forEach((entry) => {
    const stageName = resolveStageName(entry)
    const stageKey = resolveStageKey(entry)
    if (!stageKey) return
    const timestamp = resolveEntryTimestamp(entry)
    const summary = resolveStageSummary(entry)
    const key = stageKey

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: stageName,
        summary: summary ?? null,
        issueCount: 0,
        issueIds: [],
        readCount: 0,
        startTimestamp: Number.POSITIVE_INFINITY,
        endTimestamp: Number.NEGATIVE_INFINITY,
      })
    }

    const group = groups.get(key)
    group.issueCount += 1
    if (summary && !group.summary) {
      group.summary = summary
    }
    const issueId = entry.id ?? entry.metadata?.issue_id ?? entry.metadata?.issueId ?? null
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
            : `${startYear} – ${endYear}`
          : startYear
            ? `${startYear}`
            : 'Year TBA'

      return {
        ...group,
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

const GaugeCard = ({ label, count, total, accentClass }) => {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0
  const normalized = Math.min(Math.max(percent, 0), 100)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - normalized / 100)

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-100 bg-white/80 p-4 text-center shadow-sm">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`${label} ${percent}%`}>
        <circle
          cx="70"
          cy="70"
          r={radius}
          strokeWidth="10"
          stroke="rgba(148, 163, 184, 0.25)"
          fill="none"
        />
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
        <text
          x="70"
          y="70"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-2xl font-black fill-slate-900"
        >
          {normalized}%
        </text>
      </svg>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-700">
          {count} / {total || '—'} issues
        </p>
      </div>
    </div>
  )
}

function StageAccordionItem({ stage, isOpen, onToggle, canManageStates, onBulkRead, actionState }) {
  const isComplete = stage.issueCount > 0 && stage.readCount >= stage.issueCount
  const hasIssues = stage.issueIds.length > 0
  const buttonDisabled =
    !canManageStates || !hasIssues || isComplete || actionState?.loading || actionState?.disabled
  const buttonTitle = !canManageStates
    ? 'Sign in to track your collection.'
    : !hasIssues
      ? 'No trackable issues in this stage yet.'
      : isComplete
        ? 'All issues already marked as read.'
        : undefined
  const progressLabel =
    stage.issueCount > 0 ? `${stage.readCount} / ${stage.issueCount} read` : 'Read progress unavailable'

  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">{stage.name}</p>
          <p className="text-xs text-slate-500">
            {stage.yearLabel} ? {stage.issueCount} issues ? {progressLabel}
          </p>
        </div>
        <span className="inline-flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${resolveStageColor(stage.name)}`}>
            Stage
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>
      {isOpen ? (
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {stage.summary ? (
            <p>{stage.summary}</p>
          ) : (
            <p className="italic text-slate-400">No summary has been added for this stage yet.</p>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Years:</span> {stage.yearLabel}
            <span className="font-semibold text-slate-600">Issues tracked:</span> {stage.issueCount}
          </div>
          {canManageStates ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-700">
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
                {isComplete ? 'All read' : actionState?.loading ? 'Marking...' : 'Mark stage as read'}
              </Button>
            </div>
          ) : null}
          {actionState?.errorMessage ? (
            <p className="text-xs font-semibold text-rose-600">{actionState.errorMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function HeroTimelineInsights({ heroSlug, heroName }) {
  const apiBaseUrl = backendBaseUrl
  const [state, setState] = useState(() => ({
    status: !apiBaseUrl || !heroSlug ? 'disabled' : 'idle',
    entries: [],
    error: null,
  }))
  const [openStage, setOpenStage] = useState(null)
  const { statesByIssueId, canFetchStates, isFetching: issueStatesLoading } = useIssueStatesQuery(heroSlug, {
    enabled: Boolean(heroSlug),
  })
  const stageReadMutation = useStageReadMutation(heroSlug)

  useEffect(() => {
    if (!apiBaseUrl || !heroSlug) {
      setState({ status: 'disabled', entries: [], error: null })
      return undefined
    }

    const controller = new AbortController()
    setState({ status: 'loading', entries: [], error: null })

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
        setState({ status: 'success', entries: payload.entries ?? [], error: null })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({ status: 'error', entries: [], error: error.message || 'Unable to load timeline overview.' })
      }
    }

    void loadEntries()
    return () => controller.abort()
  }, [apiBaseUrl, heroSlug])

  const totalIssues = state.entries.length
  const stageGroups = useMemo(
    () => buildStageGroups(state.entries, statesByIssueId ?? {}),
    [state.entries, statesByIssueId],
  )
  const issueStatesArray = useMemo(() => Object.values(statesByIssueId ?? {}), [statesByIssueId])
  const haveItCount = issueStatesArray.filter((state) => state.haveIt).length
  const readItCount = issueStatesArray.filter((state) => state.readIt).length

  const timelineRange = useMemo(() => {
    if (!state.entries.length) return { label: 'Timeline TBA' }
    const timestamps = state.entries
      .map((entry) => resolveEntryTimestamp(entry))
      .filter((value) => typeof value === 'number' && !Number.isNaN(value))
    if (!timestamps.length) return { label: 'Timeline TBA' }
    const start = new Date(Math.min(...timestamps)).getUTCFullYear()
    const end = new Date(Math.max(...timestamps)).getUTCFullYear()
    return {
      startYear: start,
      endYear: end,
      label: start === end ? `${start}` : `${start ?? ''} – ${end ?? ''}`,
    }
  }, [state.entries])

  if (!heroSlug) {
    return null
  }

  if (state.status === 'disabled') {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
        Configure <code>VITE_BACKEND_URL</code> to view publishing insights for this hero.
      </div>
    )
  }

  const stageActionKey = stageReadMutation.variables?.stageKey ?? null
  const buildActionState = (stageKey) => ({
    loading: stageReadMutation.isPending && stageActionKey === stageKey,
    disabled: stageReadMutation.isPending && stageActionKey !== null && stageActionKey !== stageKey,
    errorMessage:
      stageReadMutation.isError && stageActionKey === stageKey
        ? stageReadMutation.error?.message ?? 'Unable to mark this stage as read.'
        : null,
  })

  const handleStageBulkRead = (stage) => {
    if (!stage?.key || !stage.issueIds?.length) {
      return
    }
    stageReadMutation.mutate({ stageKey: stage.key, issueIds: stage.issueIds })
  }

  return (
    <section className="rounded-[32px] border border-slate-100 bg-gradient-to-br from-white via-slate-50 to-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow text-indigo-500">Publishing resume</p>
          <h3 className="title-md text-slate-900">
            {heroName ? `${heroName}'s recorded saga` : 'Recorded hero saga'}
          </h3>
          <p className="text-sm text-slate-600">
            {state.status === 'loading'
              ? 'Loading timeline overview...'
              : state.status === 'error'
                ? state.error
                : `We have ${totalIssues} logged issues spanning ${timelineRange.label}. Explore every stage to understand the full reading order.`}
          </p>
        </div>
        {state.status === 'success' ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-center text-white shadow-inner shadow-slate-900/20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Coverage</p>
            <p className="text-xl font-black tracking-wide">{timelineRange.label}</p>
            <p className="text-xs text-white/70">{totalIssues} tracked issues</p>
          </div>
        ) : null}
      </div>
      {state.status === 'success' ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr,0.9fr]">
          <div className="space-y-3">
            {stageGroups.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm text-slate-500">
                Stage metadata has not been added yet. Entries will appear here once stages are tagged.
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
                />
              ))
            )}
          </div>
          <div className="space-y-4 rounded-3xl border border-slate-100 bg-white/60 p-4 shadow-inner">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Collection progress</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <GaugeCard label="Have it" count={haveItCount} total={totalIssues} accentClass="text-emerald-500" />
              <GaugeCard label="Read it" count={readItCount} total={totalIssues} accentClass="text-indigo-500" />
            </div>
            {!canFetchStates ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Sign in to track what you own and have finished reading.
              </p>
            ) : issueStatesLoading ? (
              <p className="text-xs text-slate-500">Syncing your collection...</p>
            ) : null}
          </div>
        </div>
      ) : state.status === 'loading' ? (
        <div className="mt-6 h-32 animate-pulse rounded-2xl bg-slate-100/70" />
      ) : null}
    </section>
  )
}

export default HeroTimelineInsights
