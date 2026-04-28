import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TimelineHeader from './timeline/TimelineHeader'
import TimelineNavigatorPanel from './timeline/TimelineNavigatorPanel'
import TimelineNavigatorToggle from './timeline/TimelineNavigatorToggle'
import TimelineList from './timeline/TimelineList'
import CoverFullscreenViewer from './CoverFullscreenViewer'
import IssueDetailsDialog from './issue-details/IssueDetailsDialog'
import IssueOwnershipFormatDialog from './issue-details/IssueOwnershipFormatDialog'
import { isAnnualIssueEntry } from './timeline/utils'
import { getEntryDomId, getIssueKey, getStageKey, resolveMonthBucket, resolveYearBucket } from '../utils/timeline'
import { backendBaseUrl } from '@/utils/backend.js'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import { useIssueStateMutation, useIssueStatesQuery } from '@/hooks/useIssueStates.js'
import { fetchIssueDetails } from '@/lib/issueDetailsApi.js'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import {
  COMPACT_DENSITY_THRESHOLD,
  MAX_ZOOM_LEVEL,
  MICRO_DENSITY_THRESHOLD,
  MIN_ZOOM_LEVEL,
  ZOOM_STEP,
  indexModeOptions,
  severityVariants,
  timelineIssueFilterOptions,
  timelineSortOptions,
} from './timeline/constants'

function HeroTimeline({ slug, heroName, fallbackImage }) {
  const { t } = useI18n()
  const apiBaseUrl = backendBaseUrl
  const [sortDirection, setSortDirection] = useState('desc')
  const [indexMode, setIndexMode] = useState('month')
  const [issueFilter, setIssueFilter] = useState('all')
  const [activeAnchor, setActiveAnchor] = useState(null)
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [highlightedEntryDomId, setHighlightedEntryDomId] = useState(null)
  const [coverViewer, setCoverViewer] = useState({ open: false, src: null, alt: '' })
  const [selectedIssueId, setSelectedIssueId] = useState(null)
  const [ownershipDialogState, setOwnershipDialogState] = useState({
    open: false,
    loading: false,
    saving: false,
    issueId: null,
    issueTitle: null,
    editions: [],
    selectedEditionIds: [],
    error: null,
  })
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
  const canUseIssueStateActions = Boolean(apiBaseUrl) && isAuthenticated
  const pendingIssueId = issueStateMutation.isPending ? issueStateMutation.variables?.issueId : null
  const isSyncingIssueStates = issueStatesQuery.isFetching
  const issueStateDisabledReason = !isAuthenticated
    ? t('timeline.signInToTrackCollection')
    : issueStatesQuery.isError
      ? t('timeline.issueStateSyncUnavailable')
      : undefined
  const issueStateDisabled = !isAuthenticated || issueStatesQuery.isError
  const [flashState, setFlashState] = useState({ id: null, token: 0 })
  const flashTimeoutRef = useRef(null)

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
          error: fetchError.message || t('timeline.loadingTimeline'),
        })
      }
    }

    void loadTimeline()

    return () => controller.abort()
  }, [apiBaseUrl, slug])

  useEffect(() => {
    setIssueFilter('all')
    setSelectedIssueId(null)
  }, [slug])

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
  const filteredEntries = useMemo(() => {
    if (issueFilter === 'annuals') {
      return orderedEntries.filter((entry) => isAnnualIssueEntry(entry))
    }
    return orderedEntries
  }, [issueFilter, orderedEntries])

  const monthAnchors = useMemo(() => {
    const orderedKeys = []
    const groups = new Map()

    filteredEntries.forEach((entry, index) => {
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
  }, [filteredEntries])

  const stageAnchors = useMemo(() => {
    const orderedKeys = []
    const groups = new Map()
    filteredEntries.forEach((entry, index) => {
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
  }, [filteredEntries])

  const yearAnchors = useMemo(() => {
    const orderedKeys = []
    const groups = new Map()
    filteredEntries.forEach((entry, index) => {
      const bucket = resolveYearBucket(entry)
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
  }, [filteredEntries])

  const issueAnchors = useMemo(() => {
    const orderedKeys = []
    const groups = new Map()
    filteredEntries.forEach((entry, index) => {
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
  }, [filteredEntries])

  const anchorLookup = useMemo(() => {
    return {
      month: monthAnchors,
      year: yearAnchors,
      stage: stageAnchors,
      issue: issueAnchors,
    }
  }, [monthAnchors, yearAnchors, stageAnchors, issueAnchors])

  const triggerFlash = useCallback((entryDomId) => {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = null
    }
    if (!entryDomId) {
      setFlashState({ id: null, token: 0 })
      return
    }
    const token = Date.now()
    setFlashState({ id: entryDomId, token })
    flashTimeoutRef.current = setTimeout(() => {
      setFlashState((current) => (current.token === token ? { id: null, token: 0 } : current))
      flashTimeoutRef.current = null
    }, 1200)
  }, [])

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current)
      }
    }
  }, [])

  const availableAnchors = anchorLookup[indexMode] ?? []

  useEffect(() => {
    if (!availableAnchors.length) {
      setActiveAnchor(null)
      setHighlightedEntryDomId(null)
      triggerFlash(null)
      return
    }
    setActiveAnchor((current) => {
      if (current && availableAnchors.some((anchor) => anchor.key === current)) {
        return current
      }
      return availableAnchors[0]?.key ?? null
    })
    setHighlightedEntryDomId((current) => {
      if (current && availableAnchors.some((anchor) => anchor.targetId === current)) {
        return current
      }
      return availableAnchors[0]?.targetId ?? null
    })
  }, [availableAnchors, triggerFlash])

  const handleAnchorClick = (anchor) => {
    setActiveAnchor(anchor.key)
    if (anchor.targetId) {
      setHighlightedEntryDomId(anchor.targetId)
      triggerFlash(anchor.targetId)
    }
    if (typeof document === 'undefined') return
    const target = document.getElementById(anchor.targetId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const closeOwnershipDialog = useCallback((options = {}) => {
    const force = Boolean(options?.force)
    setOwnershipDialogState((current) =>
      current.saving && !force
        ? current
        : {
            open: false,
            loading: false,
            saving: false,
            issueId: null,
            issueTitle: null,
            editions: [],
            selectedEditionIds: [],
            error: null,
          }
    )
  }, [])

  const openOwnershipDialog = useCallback(
    async (issueId) => {
      if (!issueId || !apiBaseUrl || !slug) return
      setOwnershipDialogState({
        open: true,
        loading: true,
        saving: false,
        issueId,
        issueTitle: null,
        editions: [],
        selectedEditionIds: issueStatesById?.[issueId]?.collectedEditionIds ?? [],
        error: null,
      })

      try {
        const payload = await fetchIssueDetails({ heroSlug: slug, issueId })
        const detailIssue = payload?.issue ?? null
        const fallbackEntry = entries.find((entry) => entry.id === issueId)
        const issueTitle =
          detailIssue?.headline ??
          detailIssue?.issue?.title ??
          fallbackEntry?.headline ??
          fallbackEntry?.issue_code ??
          null

        setOwnershipDialogState((current) => ({
          ...current,
          loading: false,
          issueTitle,
          editions: payload?.collectedEditions ?? [],
          selectedEditionIds: current.selectedEditionIds ?? [],
        }))
      } catch (error) {
        setOwnershipDialogState((current) => ({
          ...current,
          loading: false,
          error: error?.message ?? t('issueDetails.ownershipDialog.loadError'),
        }))
      }
    },
    [apiBaseUrl, entries, issueStatesById, slug, t],
  )

  const toggleOwnershipEdition = useCallback((editionId, checked) => {
    if (!editionId) return
    setOwnershipDialogState((current) => {
      const selectedSet = new Set(current.selectedEditionIds ?? [])
      if (checked) {
        selectedSet.add(editionId)
      } else {
        selectedSet.delete(editionId)
      }
      return {
        ...current,
        selectedEditionIds: Array.from(selectedSet),
      }
    })
  }, [])

  const confirmOwnershipDialog = useCallback(async () => {
    const issueId = ownershipDialogState.issueId
    if (!issueId || !isAuthenticated || !apiBaseUrl) return

    setOwnershipDialogState((current) => ({ ...current, saving: true, error: null }))
    try {
      await issueStateMutation.mutateAsync({
        issueId,
        patch: {
          haveIt: true,
          collectedEditionIds: ownershipDialogState.selectedEditionIds ?? [],
        },
      })
      closeOwnershipDialog({ force: true })
    } catch (error) {
      setOwnershipDialogState((current) => ({
        ...current,
        saving: false,
        error: error?.message ?? t('timeline.unableUpdateIssueState'),
      }))
    }
  }, [
    apiBaseUrl,
    closeOwnershipDialog,
    isAuthenticated,
    issueStateMutation,
    ownershipDialogState.issueId,
    ownershipDialogState.selectedEditionIds,
    t,
  ])

  const handleIssueStateToggle = useCallback(
    (issueId, field, nextValue) => {
      if (!issueId || !isAuthenticated || !apiBaseUrl) return
      if (field === 'haveIt' && nextValue) {
        void openOwnershipDialog(issueId)
        return
      }
      const patch = field === 'haveIt' && !nextValue ? { haveIt: false, collectedEditionIds: [] } : { [field]: nextValue }
      issueStateMutation.mutate({ issueId, patch })
    },
    [apiBaseUrl, isAuthenticated, issueStateMutation, openOwnershipDialog],
  )

  const adjustZoomLevel = (delta) => {
    setZoomLevel((current) => {
      const next = Number((current + delta).toFixed(2))
      if (next < MIN_ZOOM_LEVEL) return MIN_ZOOM_LEVEL
      if (next > MAX_ZOOM_LEVEL) return MAX_ZOOM_LEVEL
      return next
    })
  }

  const zoomPercentage = Math.round(zoomLevel * 100)
  const isZoomedOut = zoomLevel <= MIN_ZOOM_LEVEL + 0.001
  const isZoomedIn = zoomLevel >= MAX_ZOOM_LEVEL - 0.001
  const timelineDensity =
    zoomLevel <= MICRO_DENSITY_THRESHOLD ? 'micro' : zoomLevel <= COMPACT_DENSITY_THRESHOLD ? 'compact' : 'detailed'
  const timelineListSpacing =
    timelineDensity === 'micro' ? 'space-y-1.5' : timelineDensity === 'compact' ? 'space-y-2' : 'space-y-4'
  const openCoverViewer = (src, alt) => {
    if (!src || typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 767px)').matches) return
    setCoverViewer({ open: true, src, alt: alt ?? t('common.issueCover') })
  }

  const openIssueDetails = useCallback((entry) => {
    if (!entry?.id) return
    setSelectedIssueId(entry.id)
  }, [])

  const closeIssueDetails = useCallback(() => {
    setSelectedIssueId(null)
  }, [])

  const navigatorHasContent =
    monthAnchors.length > 0 || stageAnchors.length > 0 || issueAnchors.length > 0
  const canShowNavigator = navigatorHasContent

  if (!slug) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 body-xs text-slate-500">
        {t('timeline.missingHeroSlug')}
      </div>
    )
  }

  if (!apiBaseUrl) {
    return (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 body-xs text-amber-800">
        {t('timeline.configureBackendForTimeline')}
      </div>
    )
  }

  return (
    <section className="mt-8 w-full rounded-2xl border border-slate-100 bg-linear-to-br from-white to-slate-50 p-4">
      <TimelineHeader
        heroName={heroName}
        isAuthenticated={isAuthenticated}
        isSyncingIssueStates={isSyncingIssueStates}
        issueStatesError={issueStatesQuery.isError}
        sortOptions={timelineSortOptions}
        sortDirection={sortDirection}
        onSortChange={setSortDirection}
        zoomPercentage={zoomPercentage}
        onZoomIn={() => adjustZoomLevel(ZOOM_STEP)}
        onZoomOut={() => adjustZoomLevel(-ZOOM_STEP)}
        isZoomedIn={isZoomedIn}
        isZoomedOut={isZoomedOut}
        issueFilter={issueFilter}
        issueFilterOptions={timelineIssueFilterOptions}
        onIssueFilterChange={setIssueFilter}
      />
      <div className="mt-6 space-y-4">
        {status === 'loading' ? (
          <p className="body-sm text-slate-500">{t('timeline.loadingTimeline')}</p>
        ) : status === 'error' ? (
          <p className="body-sm text-rose-600">{error}</p>
        ) : orderedEntries.length === 0 ? (
          <p className="body-sm text-slate-500">{t('timeline.noIssuesLogged')}</p>
        ) : filteredEntries.length === 0 ? (
          <p className="body-sm text-slate-500">{t('timeline.noAnnualIssues')}</p>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row">
            {canShowNavigator && isNavigatorVisible ? (
              <TimelineNavigatorPanel
                indexMode={indexMode}
                onIndexModeChange={setIndexMode}
                indexOptions={indexModeOptions}
                anchorLookup={anchorLookup}
                activeAnchor={activeAnchor}
                onAnchorClick={handleAnchorClick}
                onToggleVisibility={() => setIsNavigatorVisible(false)}
              />
            ) : null}
            <div className="flex-1">
              {canShowNavigator && !isNavigatorVisible ? (
                <TimelineNavigatorToggle onClick={() => setIsNavigatorVisible(true)} />
              ) : null}
              <TimelineList
                entries={filteredEntries}
                zoomLevel={zoomLevel}
                listSpacingClass={timelineListSpacing}
                timelineDensity={timelineDensity}
                severityLookup={severityLookup}
                fallbackImage={fallbackImage}
                issueStatesById={issueStatesById}
                canUseIssueStateActions={canUseIssueStateActions}
                issueStateDisabled={issueStateDisabled}
                issueStateDisabledReason={issueStateDisabledReason}
                pendingIssueId={pendingIssueId}
                highlightedEntryDomId={highlightedEntryDomId}
                flashEntryDomId={flashState.id}
                onEntryHighlight={(entryDomId) => {
                  setHighlightedEntryDomId(entryDomId)
                  triggerFlash(entryDomId)
                }}
                onCoverPreview={openCoverViewer}
                onIssueSelect={openIssueDetails}
                onIssueStateToggle={handleIssueStateToggle}
              />
            </div>
          </div>
        )}
      </div>
      <CoverFullscreenViewer
        open={coverViewer.open}
        src={coverViewer.src}
        alt={coverViewer.alt}
        onClose={() => setCoverViewer({ open: false, src: null, alt: '' })}
      />
      <IssueDetailsDialog
        open={Boolean(selectedIssueId)}
        heroSlug={slug}
        issueId={selectedIssueId}
        fallbackImage={fallbackImage}
        issueState={selectedIssueId ? issueStatesById?.[selectedIssueId] : null}
        canUseIssueStateActions={canUseIssueStateActions}
        issueStatePending={pendingIssueId === selectedIssueId}
        issueStateDisabled={issueStateDisabled}
        issueStateDisabledReason={issueStateDisabledReason}
        onIssueStateToggle={(field, nextValue) =>
          selectedIssueId ? handleIssueStateToggle(selectedIssueId, field, nextValue) : undefined
        }
        onClose={closeIssueDetails}
      />
      <IssueOwnershipFormatDialog
        open={ownershipDialogState.open}
        issueTitle={ownershipDialogState.issueTitle}
        editions={ownershipDialogState.editions}
        selectedEditionIds={ownershipDialogState.selectedEditionIds}
        loading={ownershipDialogState.loading}
        saving={ownershipDialogState.saving}
        error={ownershipDialogState.error}
        onToggleEdition={toggleOwnershipEdition}
        onConfirm={confirmOwnershipDialog}
        onClose={closeOwnershipDialog}
      />
    </section>
  )
}

export default HeroTimeline


























