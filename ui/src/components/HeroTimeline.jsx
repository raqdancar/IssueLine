import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import TimelineIssueCard from './TimelineIssueCard'
import { getEntryDomId, getIssueKey, getStageKey, resolveMonthBucket } from '../utils/timeline'
import { backendBaseUrl } from '@/utils/backend.js'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import { useIssueStateMutation, useIssueStatesQuery } from '@/hooks/useIssueStates.js'

const severityVariants = {
  info: {
    dot: 'border-slate-300 bg-white',
    panel: 'border-slate-200 bg-white',
    title: 'text-slate-900',
  },
  success: {
    dot: 'border-emerald-300 bg-emerald-50',
    panel: 'border-emerald-100 bg-emerald-50/60',
    title: 'text-emerald-900',
  },
  warning: {
    dot: 'border-amber-400 bg-amber-50',
    panel: 'border-amber-200 bg-amber-50/60',
    title: 'text-amber-900',
  },
  critical: {
    dot: 'border-rose-400 bg-rose-50',
    panel: 'border-rose-200 bg-rose-50/60',
    title: 'text-rose-900',
  },
}
const timelineSortOptions = [
  { label: 'Newest first', value: 'desc' },
  { label: 'Oldest first', value: 'asc' },
]

const indexModeOptions = [
  { label: 'Months', value: 'month' },
  { label: 'Stages', value: 'stage' },
  { label: 'Issues', value: 'issue' },
]

const hasSpecialIssueCode = (entry) => {
  const code =
    entry?.issue_code ??
    entry?.metadata?.issue_code ??
    entry?.metadata?.issueCode ??
    ''
  return typeof code === 'string' && code.toLowerCase().includes('special')
}

function HeroTimeline({ slug, heroName, fallbackImage }) {
  const apiBaseUrl = backendBaseUrl
  const [sortDirection, setSortDirection] = useState('desc')
  const [indexMode, setIndexMode] = useState('month')
  const [activeAnchor, setActiveAnchor] = useState(null)
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(true)
  const [{ status, entries, error }, setState] = useState({
    status: apiBaseUrl ? 'idle' : 'disabled',
    entries: [],
    error: null,
  })
  const { isAuthenticated } = useSessionContext()
  const issueStatesQuery = useIssueStatesQuery(slug, {
    enabled: status === 'success' && Boolean(apiBaseUrl) && isAuthenticated,
  })
  const issueStateMutation = useIssueStateMutation(slug)
  const issueStatesById = issueStatesQuery.statesByIssueId ?? {}
  const canUseIssueStateActions = Boolean(apiBaseUrl)
  const pendingIssueId = issueStateMutation.isPending ? issueStateMutation.variables?.issueId : null
  const issueStateDisabledReason = !isAuthenticated
    ? 'Sign in to track your collection.'
    : issueStatesQuery.isFetching
      ? 'Syncing your issue states...'
      : issueStatesQuery.isError
        ? 'Issue state sync is unavailable right now.'
        : undefined

  useEffect(() => {
    if (!apiBaseUrl || !slug) return undefined

    const controller = new AbortController()
    setState((previous) => ({ ...previous, status: 'loading', error: null }))

    const loadTimeline = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/hero-timelines/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? `Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        setState({ status: 'success', entries: payload.entries ?? [], error: null })
      } catch (fetchError) {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          entries: [],
          error: fetchError.message || 'Unable to load timeline data.',
        })
      }
    }

    void loadTimeline()

    return () => controller.abort()
  }, [apiBaseUrl, slug])

  const severityLookup = useMemo(() => severityVariants, [])
  const orderedEntries = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...entries].sort((a, b) => {
      const aDate = new Date(a.issue_date ?? 0).getTime()
      const bDate = new Date(b.issue_date ?? 0).getTime()
      const safeADate = Number.isNaN(aDate) ? 0 : aDate
      const safeBDate = Number.isNaN(bDate) ? 0 : bDate
      if (safeADate === safeBDate) return 0
      return direction * (safeADate - safeBDate)
    })
  }, [entries, sortDirection])

  const monthAnchors = useMemo(() => {
    const orderedKeys = []
    const groups = new Map()

    orderedEntries.forEach((entry, index) => {
      const bucket = resolveMonthBucket(entry)
      if (!groups.has(bucket.key)) {
        orderedKeys.push(bucket.key)
        groups.set(bucket.key, {
          ...bucket,
          count: 0,
          targetId: getEntryDomId(entry, index),
        })
      }
      const group = groups.get(bucket.key)
      group.count += 1
    })

    return orderedKeys.map((key) => groups.get(key))
  }, [orderedEntries])

  const stageAnchors = useMemo(() => {
    const orderedKeys = []
    const groups = new Map()
    orderedEntries.forEach((entry, index) => {
      const stage = getStageKey(entry)
      if (!stage) return
      if (!groups.has(stage.key)) {
        orderedKeys.push(stage.key)
        groups.set(stage.key, {
          key: stage.key,
          label: stage.label,
          summary:
            entry.metadata?.stage_summary ??
            entry.metadata?.stageSummary ??
            entry.metadata?.stage?.short_summary ??
            entry.metadata?.stage?.summary ??
            null,
          count: 0,
          targetId: getEntryDomId(entry, index),
        })
      }
      groups.get(stage.key).count += 1
    })
    return orderedKeys.map((key) => groups.get(key))
  }, [orderedEntries])

  const issueAnchors = useMemo(() => {
    const orderedKeys = []
    const groups = new Map()
    orderedEntries.forEach((entry, index) => {
      const issue = getIssueKey(entry)
      if (!issue) return
      if (!groups.has(issue.key)) {
        orderedKeys.push(issue.key)
        groups.set(issue.key, {
          key: issue.key,
          label: issue.label,
          count: 0,
          targetId: getEntryDomId(entry, index),
        })
      }
      groups.get(issue.key).count += 1
    })
    return orderedKeys.map((key) => groups.get(key))
  }, [orderedEntries])

  const anchorLookup = useMemo(() => {
    return {
      month: monthAnchors,
      stage: stageAnchors,
      issue: issueAnchors,
    }
  }, [monthAnchors, stageAnchors, issueAnchors])

  const availableAnchors = anchorLookup[indexMode] ?? []

  useEffect(() => {
    if (!availableAnchors.length) {
      setActiveAnchor(null)
      return
    }
    setActiveAnchor((current) => {
      if (current && availableAnchors.some((anchor) => anchor.key === current)) {
        return current
      }
      return availableAnchors[0]?.key ?? null
    })
  }, [availableAnchors])

  const handleAnchorClick = (anchor) => {
    setActiveAnchor(anchor.key)
    if (typeof document === 'undefined') return
    const target = document.getElementById(anchor.targetId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleIssueStateToggle = useCallback(
    (issueId, field, nextValue) => {
      if (!issueId || !isAuthenticated || !apiBaseUrl) return
      issueStateMutation.mutate({ issueId, patch: { [field]: nextValue } })
    },
    [apiBaseUrl, isAuthenticated, issueStateMutation],
  )

  const navigatorHasContent =
    monthAnchors.length > 0 || stageAnchors.length > 0 || issueAnchors.length > 0
  const canShowNavigator = navigatorHasContent

  if (!slug) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 body-xs text-slate-500">
        Missing hero slug. Timeline data cannot be requested yet.
      </div>
    )
  }

  if (!apiBaseUrl) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 body-xs text-amber-800">
        Set <code>VITE_BACKEND_URL</code> in your environment to enable hero timelines.
      </div>
    )
  }

  return (
    <section className="mt-8 w-full rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="title-xs">{heroName} timeline</p>
          <p className="body-xs text-slate-500">Events sync from the IssueLine backend.</p>
          {!isAuthenticated ? (
            <p className="body-xs text-slate-400">Sign in to track which issues you own or have read.</p>
          ) : null}
          {issueStatesQuery.isError ? (
            <p className="body-xs text-rose-500">Unable to sync your issue states. Please try again.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="body-xs text-slate-500">Sort by date:</span>
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
            {timelineSortOptions.map((option) => {
              const isActive = sortDirection === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSortDirection(option.value)}
                  className={`rounded-full px-3 py-1 body-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}

          </div>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {status === 'loading' ? (
          <p className="body-sm text-slate-500">Loading timeline...</p>
        ) : status === 'error' ? (
          <p className="body-sm text-rose-600">{error}</p>
        ) : orderedEntries.length === 0 ? (
          <p className="body-sm text-slate-500">No issues have been logged for this hero yet.</p>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            {canShowNavigator && isNavigatorVisible ? (
              <aside className="w-full rounded-3xl border border-slate-100/80 bg-gradient-to-b from-white/95 via-slate-50/90 to-slate-100/60 p-4 shadow-xl shadow-slate-200/70 ring-1 ring-white/60 backdrop-blur lg:sticky lg:top-6 lg:max-h-[80vh] lg:max-w-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="body-xs font-semibold uppercase tracking-wide text-slate-500">Jump to</p>
                  <button
                    type="button"
                    onClick={() => setIsNavigatorVisible((value) => !value)}
                    className="rounded-full border border-slate-200 bg-white p-1 text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    aria-label={isNavigatorVisible ? 'Hide timeline index' : 'Show timeline index'}
                  >
                    {isNavigatorVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-3 inline-flex w-full rounded-full border border-slate-200 bg-white/80 p-0.5 shadow-inner">
                  {indexModeOptions.map((option) => {
                    const isActive = indexMode === option.value
                    const hasAnchors = (anchorLookup[option.value] ?? []).length > 0
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!hasAnchors}
                        onClick={() => setIndexMode(option.value)}
                        className={`flex-1 rounded-full px-3 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/40'
                            : hasAnchors
                              ? 'text-slate-600 hover:text-slate-900'
                              : 'cursor-not-allowed text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {(anchorLookup[indexMode] ?? []).length ? (
                    anchorLookup[indexMode].map((anchor) => {
                      const isActive = activeAnchor === anchor.key
                      const countBadgeClasses = isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-slate-100 text-slate-500'
                      return (
                        <button
                          key={anchor.key}
                          type="button"
                          aria-current={isActive ? 'true' : undefined}
                          onClick={() => handleAnchorClick(anchor)}
                          className={`group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                            isActive
                              ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900/40 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex-1 pr-2">
                            <span>{anchor.label}</span>
                            {indexMode === 'stage' && anchor.summary ? (
                              <p className="mt-1 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-400">
                                {anchor.summary}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${countBadgeClasses}`}
                          >
                            {anchor.count}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <p className="text-[11px] text-slate-400">No anchors for this view.</p>
                  )}
                </div>
              </aside>
            ) : null}
            <div className="flex-1">
              {canShowNavigator && !isNavigatorVisible ? (
                <div className="mb-3 flex justify-start">
                  <button
                    type="button"
                    onClick={() => setIsNavigatorVisible(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <Eye className="h-4 w-4" />
                    Show timeline index
                  </button>
                </div>
              ) : null}
              <ol className="space-y-4">
                {orderedEntries.map((entry, index) => {
                  const hideIssueStateActions = hasSpecialIssueCode(entry)
                  return (
                    <TimelineIssueCard
                      key={entry.id ?? `${entry.issue_code ?? 'issue'}-${index}`}
                      entry={entry}
                      index={index}
                      totalEntries={orderedEntries.length}
                      severityLookup={severityLookup}
                      fallbackImage={fallbackImage}
                      issueState={entry.id ? issueStatesById[entry.id] : undefined}
                      showIssueStateActions={Boolean(entry.id && canUseIssueStateActions && !hideIssueStateActions)}
                      issueStateDisabled={!isAuthenticated || issueStatesQuery.isFetching || issueStatesQuery.isError}
                      issueStateDisabledReason={issueStateDisabledReason}
                      issueStatePending={pendingIssueId === entry.id}
                      onIssueStateToggle={(field, nextValue) =>
                        entry.id ? handleIssueStateToggle(entry.id, field, nextValue) : undefined
                    }
                  />
                  )
                })}
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default HeroTimeline














