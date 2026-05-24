// Render the main timeline experience with filters, anchors, issue states, and details.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TimelineHeader from './timeline/TimelineHeader'
import TimelineNavigatorPanel from './timeline/TimelineNavigatorPanel'
import TimelineNavigatorToggle from './timeline/TimelineNavigatorToggle'
import TimelineList from './timeline/TimelineList'
import TimelineFullscreenShowcase from './timeline/TimelineFullscreenShowcase'
import { TimelineLoadingSkeleton } from './timeline/TimelineLoadingSkeleton'
import CoverFullscreenViewer from './CoverFullscreenViewer'
import IssueDetailsDialog from './issue-details/IssueDetailsDialog'
import IssueOwnershipFormatDialog from './issue-details/IssueOwnershipFormatDialog'
import { isAnnualIssueEntry } from './timeline/utils'
import {
  compareTimelineEntries,
  getEntryDomId,
  getIssueKey,
  getStageKey,
  resolveMonthBucket,
  resolveTimelineOrder,
  resolveYearBucket,
} from '../utils/timeline'
import { backendBaseUrl } from '@/utils/backend.js'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import { useIssueStateMutation, useIssueStatesQuery } from '@/hooks/useIssueStates.js'
import { useTimelineFullscreen } from '@/hooks/useTimelineFullscreen.js'
import { fetchIssueDetails } from '@/lib/issueDetailsApi.js'
import { parseJsonResponse } from '@/lib/httpClient.js'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import {
  COMPACT_DENSITY_THRESHOLD,
  MAX_ZOOM_LEVEL,
  MICRO_DENSITY_THRESHOLD,
  MIN_ZOOM_LEVEL,
  ZOOM_STEP,
  indexModeOptions,
  severityVariants,
  timelineOrderModeOptions,
  timelinePublicationFilterOptions,
  timelineSortOptions,
} from './timeline/constants'

function HeroTimeline({ slug, heroName, fallbackImage, timelineLogoSrc = null, timelineLogoAlt = null }) {
  const { t } = useI18n()
  const sectionRef = useRef(null)
  const apiBaseUrl = backendBaseUrl
  const [sortDirection, setSortDirection] = useState('desc')
  const [timelineOrderMode, setTimelineOrderMode] = useState('canonical')
  const [indexMode, setIndexMode] = useState('month')
  const [publicationFilter, setPublicationFilter] = useState('all')
  const [collectionFilters, setCollectionFilters] = useState({
    ownedOnly: false,
    readOnly: false,
  })
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
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const flashTimeoutRef = useRef(null)
  const { isFullscreen, fullscreenEnabled, toggleFullscreen } = useTimelineFullscreen(sectionRef)

  // Load timeline entries for the current hero slug.
  useEffect(() => {
    if (!apiBaseUrl || !slug) return undefined

    const controller = new AbortController()
    setState((previous) => ({ ...previous, status: 'loading', error: null }))

    const loadTimeline = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/hero-timelines/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        })
        const payload = await parseJsonResponse(response)
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
    // Reset filters and selected issue when switching heroes.
    setPublicationFilter('all')
    setCollectionFilters({ ownedOnly: false, readOnly: false })
    setSelectedIssueId(null)
  }, [slug])

  const severityLookup = useMemo(() => severityVariants, [])
  const hasCanonicalTimelineOrder = useMemo(
    () => entries.some((entry) => resolveTimelineOrder(entry) !== null),
    [entries],
  )
  const orderedEntries = useMemo(() => {
    const useCanonicalOrder = hasCanonicalTimelineOrder && timelineOrderMode === 'canonical'
    return [...entries].sort((a, b) =>
      compareTimelineEntries(a, b, useCanonicalOrder ? 'asc' : sortDirection, {
        useTimelineOrder: useCanonicalOrder,
      }),
    )
  }, [entries, hasCanonicalTimelineOrder, sortDirection, timelineOrderMode])
  const filteredEntries = useMemo(() => {
    // Combine publication filters with user collection/read filters.
    const publicationFilterMatch = (entry) => {
      if (publicationFilter === 'all') return true
      if (publicationFilter === 'annuals') return isAnnualIssueEntry(entry)
      return true
    }

    const personalFilterMatch = (entry) => {
      const issueState = entry?.id ? issueStatesById?.[entry.id] : null
      const haveIt = Boolean(issueState?.haveIt)
      const readIt = Boolean(issueState?.readIt)

      if (collectionFilters.ownedOnly && !haveIt) return false
      if (collectionFilters.readOnly && !readIt) return false
      return true
    }

    return orderedEntries.filter((entry) => publicationFilterMatch(entry) && personalFilterMatch(entry))
  }, [orderedEntries, collectionFilters, publicationFilter, issueStatesById])

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
    const resolveIssueNumberRank = (entry) => {
      const rawIssueNumber =
        entry?.metadata?.number ??
        entry?.metadata?.issue_number ??
        entry?.metadata?.issueNumber ??
        entry?.issue_code ??
        ''
      const match = String(rawIssueNumber).match(/\d+/)
      return match ? Number(match[0]) : Number.POSITIVE_INFINITY
    }

    const resolveStageRank = (entry, index) => {
      const parsedDate = new Date(entry?.issue_date ?? '').getTime()
      return {
        date: Number.isNaN(parsedDate) ? Number.POSITIVE_INFINITY : parsedDate,
        issueNumber: resolveIssueNumberRank(entry),
        index,
      }
    }

    const isBetterStageStart = (candidate, current) => {
      if (!current) return true
      if (candidate.date !== current.date) return candidate.date < current.date
      if (candidate.issueNumber !== current.issueNumber) return candidate.issueNumber < current.issueNumber
      return candidate.index < current.index
    }

    const orderedKeys = []
    const groups = new Map()
    // Choose one stable target issue per stage for index navigation.
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
          _startRank: resolveStageRank(entry, index),
        })
      }
      const group = groups.get(stage.key)
      group.count += 1

      const candidateRank = resolveStageRank(entry, index)
      if (isBetterStageStart(candidateRank, group._startRank)) {
        group.targetId = getEntryDomId(entry, index)
        group._startRank = candidateRank
      }
    })
    return orderedKeys.map((key) => {
      const { _startRank: _ignoredStartRank, ...group } = groups.get(key)
      return group
    })
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

  const { issueAnchors, issueAnchorsByStage } = useMemo(() => {
    const stageOrder = []
    const stages = new Map()
    const flattened = []

    filteredEntries.forEach((entry, index) => {
      const issue = getIssueKey(entry)
      if (!issue) return

      const stage = getStageKey(entry)
      const stageKey = stage?.key ?? 'uncategorized-stage'
      const stageLabel = stage?.label ?? t('timeline.uncategorizedStage')

      if (!stages.has(stageKey)) {
        stageOrder.push(stageKey)
        stages.set(stageKey, {
          key: stageKey,
          label: stageLabel,
          anchors: [],
        })
      }

      const anchor = {
        key: entry?.id ? `issue-${entry.id}` : `issue-${issue.key}-${index}`,
        label: issue.label,
        count: 1,
        targetId: getEntryDomId(entry, index),
      }

      stages.get(stageKey).anchors.push(anchor)
      flattened.push(anchor)
    })

    return {
      issueAnchors: flattened,
      issueAnchorsByStage: stageOrder.map((key) => stages.get(key)),
    }
  }, [filteredEntries, t])

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
    // Ignore late timers from older flashes by checking the token.
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
      // Show the floating button only while the timeline section is in view.
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
    // Keep list state and index state aligned when jumping to an anchor.
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
      // Opening the ownership dialog is required before enabling "have it".
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
  const handleBackToTop = useCallback(() => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const shouldShowBackToTop = isMobileViewport && showBackToTop

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
    <section
      ref={sectionRef}
      className={`relative mt-8 w-full border p-4 transition ${
        isFullscreen
          ? 'h-full min-h-screen overflow-auto rounded-none border-slate-900/20 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.22),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(236,72,153,0.14),transparent_34%),linear-gradient(155deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.94)_38%,rgba(255,255,255,0.98)_100%)] shadow-2xl'
          : 'rounded-2xl border-slate-100 bg-linear-to-br from-white to-slate-50'
      }`}
    >
      <TimelineHeader
        heroName={heroName}
        timelineLogoSrc={timelineLogoSrc}
        timelineLogoAlt={timelineLogoAlt}
        isAuthenticated={isAuthenticated}
        isSyncingIssueStates={isSyncingIssueStates}
        issueStatesError={issueStatesQuery.isError}
        sortOptions={timelineSortOptions}
        sortDirection={sortDirection}
        onSortChange={setSortDirection}
        timelineOrderMode={hasCanonicalTimelineOrder ? timelineOrderMode : 'publication'}
        timelineOrderOptions={timelineOrderModeOptions}
        onTimelineOrderModeChange={setTimelineOrderMode}
        hasCanonicalTimelineOrder={hasCanonicalTimelineOrder}
        zoomPercentage={zoomPercentage}
        onZoomIn={() => adjustZoomLevel(ZOOM_STEP)}
        onZoomOut={() => adjustZoomLevel(-ZOOM_STEP)}
        isZoomedIn={isZoomedIn}
        isZoomedOut={isZoomedOut}
        publicationFilter={publicationFilter}
        publicationFilterOptions={timelinePublicationFilterOptions}
        onPublicationFilterChange={setPublicationFilter}
        collectionFilters={collectionFilters}
        onCollectionFilterChange={(key, nextValue) =>
          setCollectionFilters((current) => ({ ...current, [key]: nextValue }))
        }
        fullscreenEnabled={fullscreenEnabled}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showcaseMode={isFullscreen}
      />
      <div className="mt-6 space-y-4">
        {status === 'loading' ? (
          <TimelineLoadingSkeleton variant="light" showNavigator cardCount={6} />
        ) : status === 'error' ? (
          <p className="body-sm text-rose-600">{error}</p>
        ) : orderedEntries.length === 0 ? (
          <p className="body-sm text-slate-500">{t('timeline.noIssuesLogged')}</p>
        ) : filteredEntries.length === 0 ? (
          <p className="body-sm text-slate-500">
            {publicationFilter === 'annuals' && !collectionFilters.ownedOnly && !collectionFilters.readOnly
              ? t('timeline.noAnnualIssues')
              : t('timeline.noIssuesForFilter')}
          </p>
        ) : (
          isFullscreen ? (
            <TimelineFullscreenShowcase
              canShowNavigator={canShowNavigator}
              isNavigatorVisible={isNavigatorVisible}
              indexMode={indexMode}
              onIndexModeChange={setIndexMode}
              indexOptions={indexModeOptions}
              anchorLookup={anchorLookup}
              issueAnchorsByStage={issueAnchorsByStage}
              activeAnchor={activeAnchor}
              onAnchorClick={handleAnchorClick}
              onHideNavigator={() => setIsNavigatorVisible(false)}
              onShowNavigator={() => setIsNavigatorVisible(true)}
              entries={filteredEntries}
              zoomLevel={zoomLevel}
              listSpacingClass={timelineListSpacing}
              timelineDensity={timelineDensity}
              severityLookup={severityLookup}
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
          ) : (
            <div className="flex flex-col gap-4 md:grid md:h-[calc(100vh-13rem)] md:min-h-[38rem] md:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] md:items-start md:overflow-hidden">
              {canShowNavigator && isNavigatorVisible ? (
                <TimelineNavigatorPanel
                  indexMode={indexMode}
                  onIndexModeChange={setIndexMode}
                  indexOptions={indexModeOptions}
                  anchorLookup={anchorLookup}
                  issueAnchorsByStage={issueAnchorsByStage}
                  activeAnchor={activeAnchor}
                  onAnchorClick={handleAnchorClick}
                  onToggleVisibility={() => setIsNavigatorVisible(false)}
                />
              ) : null}
              <div
                className={`min-w-0 flex-1 md:h-full md:overflow-y-auto md:pr-1 ${
                  !canShowNavigator || !isNavigatorVisible ? 'md:col-span-2' : ''
                }`}
              >
                {canShowNavigator && !isNavigatorVisible ? (
                  <TimelineNavigatorToggle onClick={() => setIsNavigatorVisible(true)} />
                ) : null}
                <TimelineList
                  entries={filteredEntries}
                  zoomLevel={zoomLevel}
                  listSpacingClass={timelineListSpacing}
                  timelineDensity={timelineDensity}
                  severityLookup={severityLookup}
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
          )
        )}
      </div>
      <CoverFullscreenViewer
        open={coverViewer.open}
        src={coverViewer.src}
        alt={coverViewer.alt}
        portalContainer={isFullscreen ? sectionRef.current : undefined}
        onClose={() => setCoverViewer({ open: false, src: null, alt: '' })}
      />
      <IssueDetailsDialog
        open={Boolean(selectedIssueId)}
        heroSlug={slug}
        issueId={selectedIssueId}
        portalContainer={isFullscreen ? sectionRef.current : undefined}
        timelineEntries={entries}
        onIssueNavigate={(nextIssueId) => setSelectedIssueId(nextIssueId)}
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
        portalContainer={isFullscreen ? sectionRef.current : undefined}
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
      {shouldShowBackToTop && typeof document !== 'undefined'
        ? createPortal(
            // Portal keeps the floating button pinned to the viewport, not list flow.
            <button
              type="button"
              onClick={handleBackToTop}
              aria-label="Back to top"
              className="fixed bottom-4 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white/95 shadow-lg shadow-slate-900/20 backdrop-blur transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 md:hidden"
            >
              <img src="/timeline-ui/back-to-filters.png" alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
            </button>,
            document.body,
          )
        : null}
    </section>
  )
}

export default HeroTimeline



























