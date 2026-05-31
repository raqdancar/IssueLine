// Renderitza un component reutilitzable de la interfície d'IssueLine.
import { useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Info, Loader2 } from 'lucide-react'
import {
  useCollectedEditionReadMutation,
  useIssueStateMutation,
  useIssueStatesQuery,
  useStageReadMutation,
} from '@/hooks/useIssueStates'
import { useHeroTimelineQuery } from '@/hooks/useHeroTimeline.js'
import IssueDetailsDialog from '@/components/issue-details/IssueDetailsDialog'
import IssueOwnershipFormatDialog from '@/components/issue-details/IssueOwnershipFormatDialog'
import StageDetailDialog from '@/components/stage-details/StageDetailDialog'
import { TimelineInsightsSkeleton } from '@/components/timeline/TimelineLoadingSkeleton'
import PrintLanguageBadge from '@/components/PrintLanguageBadge'
import { formatCollectedEditionFormat } from '@/lib/collectedEditions'
import { fetchIssueDetails } from '@/lib/issueDetailsApi.js'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import {
  AutoScrollIssueStrip,
  CollectedFilterSelect,
  GaugeCard,
  StageAccordionItem,
} from '@/components/timeline/TimelineInsightPrimitives'
import {
  ALL_FILTER_VALUE,
  buildCollectedEditionFormatGroups,
  buildFilteredCollectedEditions,
  buildFilterOptions,
  buildStageCoverageMap,
  buildStageGroups,
  buildStageTimelineIssuesByKey,
  isCollectedEditionOwned as resolveCollectedEditionOwned,
  isCollectedEditionRead as resolveCollectedEditionRead,
  resolveCollectedCoverImage,
  resolveEditionFormatFilter,
  resolveEditionLanguageFilter,
  resolveTimelineRange,
} from '@/components/timeline/timelineInsightsViewModel'

function HeroTimelineInsights({ heroSlug, heroName }) {
  const { t, locale } = useI18n()
  const timelineQuery = useHeroTimelineQuery(heroSlug)
  const state = useMemo(
    () => ({
      status: timelineQuery.status,
      entries: timelineQuery.entries,
      collectedEditions: timelineQuery.collectedEditionsOverview,
      error: timelineQuery.errorMessage || t('timeline.loadingOverview'),
    }),
    [
      timelineQuery.collectedEditionsOverview,
      timelineQuery.entries,
      timelineQuery.errorMessage,
      timelineQuery.status,
      t,
    ],
  )
  const [openStage, setOpenStage] = useState(null)
  const [insightTab, setInsightTab] = useState('progress')
  const [editionActionState, setEditionActionState] = useState({ pendingEditionId: null, pendingAction: null, error: null })
  const [collectedLanguageFilter, setCollectedLanguageFilter] = useState(ALL_FILTER_VALUE)
  const [collectedFormatFilter, setCollectedFormatFilter] = useState(ALL_FILTER_VALUE)
  const [selectedStageKey, setSelectedStageKey] = useState(null)
  const [selectedStageIssueId, setSelectedStageIssueId] = useState(null)
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
  const { isAuthenticated } = useSessionContext()
  const { statesByIssueId, canFetchStates, isFetching: issueStatesLoading } = useIssueStatesQuery(heroSlug, {
    enabled: Boolean(heroSlug),
  })
  const issueStateMutation = useIssueStateMutation(heroSlug)
  const stageReadMutation = useStageReadMutation(heroSlug)
  const collectedEditionReadMutation = useCollectedEditionReadMutation(heroSlug)

  const totalIssues = state.entries.length
  const collectedEditions = useMemo(() => state.collectedEditions ?? [], [state.collectedEditions])
  const collectedLanguageOptions = useMemo(
    () => buildFilterOptions(collectedEditions, resolveEditionLanguageFilter),
    [collectedEditions],
  )
  const collectedFormatOptions = useMemo(
    () => buildFilterOptions(collectedEditions, resolveEditionFormatFilter),
    [collectedEditions],
  )
  const filteredCollectedEditions = useMemo(
    () =>
      buildFilteredCollectedEditions({
        collectedEditions,
        collectedLanguageFilter,
        collectedFormatFilter,
      }),
    [collectedEditions, collectedFormatFilter, collectedLanguageFilter],
  )
  const collectedEditionFormatGroups = useMemo(
    () => buildCollectedEditionFormatGroups(filteredCollectedEditions),
    [filteredCollectedEditions],
  )
  const stageGroups = useMemo(
    () => buildStageGroups(state.entries, statesByIssueId ?? {}, t, locale),
    [state.entries, statesByIssueId, t, locale],
  )
  const stageCoverageOrder = useMemo(
    () => stageGroups.map((stage) => ({ key: stage.key, name: stage.name })),
    [stageGroups],
  )
  const stageTimelineIssuesByKey = useMemo(() => buildStageTimelineIssuesByKey(state.entries, t), [state.entries, t])

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

  const timelineRange = useMemo(() => resolveTimelineRange(state.entries, t), [state.entries, t])

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

  const closeOwnershipDialog = (options = {}) => {
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
          },
    )
  }

  const openOwnershipDialog = async (issueId) => {
    if (!issueId || !heroSlug) return
    setOwnershipDialogState({
      open: true,
      loading: true,
      saving: false,
      issueId,
      issueTitle: null,
      editions: [],
      selectedEditionIds: statesByIssueId?.[issueId]?.collectedEditionIds ?? [],
      error: null,
    })

    try {
      const payload = await fetchIssueDetails({ heroSlug, issueId })
      const detailIssue = payload?.issue ?? null
      const fallbackEntry = state.entries.find((entry) => String(entry?.id) === String(issueId))
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
      }))
    } catch (error) {
      setOwnershipDialogState((current) => ({
        ...current,
        loading: false,
        error: error?.message ?? t('issueDetails.ownershipDialog.loadError'),
      }))
    }
  }

  const selectSingleIssueOwnership = () => {
    setOwnershipDialogState((current) => ({ ...current, selectedEditionIds: [] }))
  }

  const toggleOwnershipEdition = (editionId, checked) => {
    if (!editionId) return
    setOwnershipDialogState((current) => {
      const selectedSet = new Set(current.selectedEditionIds ?? [])
      if (checked) {
        selectedSet.add(editionId)
      } else {
        selectedSet.delete(editionId)
      }
      return { ...current, selectedEditionIds: Array.from(selectedSet) }
    })
  }

  const confirmOwnershipDialog = async () => {
    const issueId = ownershipDialogState.issueId
    if (!issueId || !canFetchStates) return

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
  }

  const handleIssueToggle = (issueId, field, nextValue) => {
    if (!issueId || !canFetchStates) return
    if (field === 'haveIt' && nextValue) {
      void openOwnershipDialog(issueId)
      return
    }
    const patch = field === 'haveIt' && !nextValue ? { haveIt: false, collectedEditionIds: [] } : { [field]: nextValue }
    issueStateMutation.mutate({ issueId, patch })
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

  const isCollectedEditionOwned = (edition) => resolveCollectedEditionOwned({ edition, statesByIssueId })
  const isCollectedEditionRead = (edition) => resolveCollectedEditionRead({ edition, statesByIssueId })

  const handleCollectedEditionToggle = async (edition) => {
    if (!canFetchStates || !edition?.id) return

    const editionId = String(edition.id)
    const issueIds = getCollectedEditionTimelineIssueIds(edition)
    if (!issueIds.length) return

    const currentlyOwned = isCollectedEditionOwned(edition)
    setEditionActionState({ pendingEditionId: editionId, pendingAction: 'ownership', error: null })

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
      setEditionActionState({ pendingEditionId: null, pendingAction: null, error: null })
    } catch (error) {
      setEditionActionState({
        pendingEditionId: null,
        pendingAction: null,
        error: error?.message ?? t('timeline.unableUpdateIssueState'),
      })
    }
  }

  const handleCollectedEditionReadToggle = async (edition) => {
    if (!canFetchStates || !edition?.id) return

    const editionId = String(edition.id)
    const issueIds = getCollectedEditionTimelineIssueIds(edition)
    if (!issueIds.length) return

    const nextReadIt = !isCollectedEditionRead(edition)
    setEditionActionState({ pendingEditionId: editionId, pendingAction: 'read', error: null })

    try {
      await collectedEditionReadMutation.mutateAsync({
        collectedEditionId: editionId,
        issueIds,
        readIt: nextReadIt,
      })
      setEditionActionState({ pendingEditionId: null, pendingAction: null, error: null })
    } catch (error) {
      setEditionActionState({
        pendingEditionId: null,
        pendingAction: null,
        error: error?.message ?? t('timeline.unableUpdateIssueState'),
      })
    }
  }

  return (
    <section className="w-full max-w-full min-w-0 rounded-2xl border border-slate-100 bg-linear-to-br from-white via-slate-50 to-white p-3 shadow-sm sm:rounded-[32px] sm:p-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
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
          <div className="w-fit max-w-full rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-center text-white shadow-inner shadow-slate-900/20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">{t('timeline.coverage')}</p>
            <p className="text-xl font-black tracking-wide">{timelineRange.label}</p>
            <p className="text-xs text-white/70">{t('timeline.trackedIssues', { count: totalIssues })}</p>
          </div>
        ) : null}
      </div>

      {state.status === 'success' ? (
        <div className="mt-6 space-y-6">
          <div className="w-full min-w-0">
            <div role="tablist" aria-label={t('timeline.publishingResume')} className="grid min-w-0 grid-cols-2 items-stretch gap-1 border-b border-border/80 md:inline-flex md:min-w-full md:items-end md:gap-2">
              <button
                type="button"
                role="tab"
                aria-selected={insightTab === 'progress'}
                className={`-mb-px min-w-0 whitespace-normal break-words rounded-t-xl border-x border-t border-b px-2 py-2 text-center text-xs font-semibold leading-tight transition md:px-4 md:text-sm ${
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
                className={`-mb-px min-w-0 whitespace-normal break-words rounded-t-xl border-x border-t border-b px-2 py-2 text-center text-xs font-semibold leading-tight transition md:px-4 md:text-sm ${
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
              <div className="min-w-0 space-y-4 rounded-2xl border border-slate-100 bg-white/60 p-3 shadow-inner sm:rounded-3xl sm:p-4">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">{t('timeline.collectionProgress')}</p>
                {isAuthenticated ? (
                  <div className="grid min-w-0 gap-3 md:grid-cols-2 md:gap-4">
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
            <div className="min-w-0 space-y-3 rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm sm:p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">{t('timeline.collectedCoverageTitle')}</p>
                  <p className="text-xs text-slate-500">{t('timeline.collectedCoverageSubtitle')}</p>
                </div>
                {collectedEditions.length ? (
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:min-w-[28rem]">
                    <CollectedFilterSelect
                      label={t('timeline.collectedLanguageFilter')}
                      value={collectedLanguageFilter}
                      allLabel={t('timeline.collectedAllLanguages')}
                      options={collectedLanguageOptions}
                      onChange={setCollectedLanguageFilter}
                    />
                    <CollectedFilterSelect
                      label={t('timeline.collectedFormatFilter')}
                      value={collectedFormatFilter}
                      allLabel={t('timeline.collectedAllFormats')}
                      options={collectedFormatOptions}
                      onChange={setCollectedFormatFilter}
                    />
                  </div>
                ) : null}
              </div>
              {collectedEditions.length ? (
                filteredCollectedEditions.length ? (
                  <>
                    <p className="text-xs font-semibold text-slate-500">
                      {t('timeline.collectedFilteredCount', {
                        count: filteredCollectedEditions.length,
                        total: collectedEditions.length,
                      })}
                    </p>
                    <div className="space-y-5">
                  {collectedEditionFormatGroups.map((formatGroup) => (
                    <section
                      key={formatGroup.key}
                      className="overflow-hidden rounded-[22px] border border-primary/20 bg-linear-to-br from-accent/25 via-white/80 to-white shadow-sm"
                    >
                      <header className="flex items-center gap-3 border-b border-primary/15 bg-accent/20 px-3 py-2.5 sm:px-4">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" aria-hidden="true" />
                        <h4 className="text-sm font-black uppercase tracking-[0.16em] text-primary">{formatGroup.label}</h4>
                        <span className="h-px min-w-4 flex-1 bg-linear-to-r from-primary/35 to-transparent" aria-hidden="true" />
                        <span className="shrink-0 rounded-full border border-primary/20 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          {t('timeline.collectedFormatGroupCount', { count: formatGroup.editions.length })}
                        </span>
                      </header>
                      <div className="grid min-w-0 gap-3 p-3 lg:grid-cols-2">
                  {formatGroup.editions.map((edition) => {
                    const coverImage = resolveCollectedCoverImage(edition.coverImageUrl)
                    const stageCoverage = buildStageCoverageMap(edition.stages)
                    const coveredStageCount = edition.stages?.length ?? 0
                    const editionId = String(edition.id)
                    const editionTimelineIssueIds = getCollectedEditionTimelineIssueIds(edition)
                    const isEditionOwned = isCollectedEditionOwned(edition)
                    const isEditionRead = isCollectedEditionRead(edition)
                    const isEditionOwnershipPending =
                      editionActionState.pendingEditionId === editionId && editionActionState.pendingAction === 'ownership'
                    const isEditionReadPending =
                      editionActionState.pendingEditionId === editionId && editionActionState.pendingAction === 'read'
                    const editionActionDisabled =
                      !canFetchStates ||
                      Boolean(editionActionState.pendingEditionId) ||
                      !editionTimelineIssueIds.length

                    return (
                      <article key={edition.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white/75 p-3 shadow-sm">
                        <div className="flex min-w-0 gap-3">
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
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <p className="min-w-0 body-sm font-semibold break-words text-slate-900">{edition.title}</p>
                              <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-auto">
                                <button
                                  type="button"
                                  aria-pressed={isEditionOwned}
                                  aria-label={t('timeline.addToCollection')}
                                  aria-busy={isEditionOwnershipPending ? 'true' : undefined}
                                  disabled={editionActionDisabled}
                                  title={
                                    !canFetchStates
                                      ? t('timeline.signInToTrackOwnedRead')
                                      : isEditionOwnershipPending
                                        ? t('timeline.savingUpdate')
                                        : t('timeline.addToCollection')
                                  }
                                  onClick={() => void handleCollectedEditionToggle(edition)}
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                                    isEditionOwned
                                      ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900/30 hover:text-slate-900'
                                  } ${editionActionDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
                                >
                                  {isEditionOwnershipPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={isEditionRead}
                                  aria-label={isEditionRead ? t('timeline.allRead') : t('timeline.markAsRead')}
                                  aria-busy={isEditionReadPending ? 'true' : undefined}
                                  disabled={editionActionDisabled}
                                  title={
                                    !canFetchStates
                                      ? t('timeline.signInToTrackOwnedRead')
                                      : isEditionReadPending
                                        ? t('timeline.savingUpdate')
                                        : isEditionRead
                                          ? t('timeline.allRead')
                                          : t('timeline.markAsRead')
                                  }
                                  onClick={() => void handleCollectedEditionReadToggle(edition)}
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                                    isEditionRead
                                      ? 'border-sky-300 bg-sky-100 text-sky-700'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'
                                  } ${editionActionDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
                                >
                                  {isEditionReadPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {edition.subtitle ? <p className="body-xs break-words text-slate-600">{edition.subtitle}</p> : null}
                            <div className="body-xs flex flex-wrap items-center gap-1.5 text-slate-500">
                              <span>{formatCollectedEditionFormat(edition.format)}</span>
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
                                    className={`h-2 flex-1 rounded-full ${count > 0 ? 'bg-primary' : 'bg-slate-200'}`}
                                    title={`${stage.name}: ${count} ${t('timeline.indexIssues').toLowerCase()}`}
                                  />
                                )
                              })}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(edition.stages ?? []).map((stage) => (
                                <span
                                  key={`${edition.id}-stage-${stage.key}`}
                                  className="inline-flex max-w-full rounded-full border border-primary/25 bg-accent/35 px-2 py-0.5 text-[11px] font-semibold leading-tight whitespace-normal break-words text-primary"
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
                    </section>
                  ))}
                    </div>
                  </>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    {t('timeline.collectedFilteredEmpty')}
                  </p>
                )
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
        heroSlug={heroSlug}
        onIssueSelect={handleOpenIssueDetail}
      />
      <IssueDetailsDialog
        open={Boolean(selectedStageIssueId)}
        heroSlug={heroSlug}
        issueId={selectedStageIssueId}
        timelineEntries={state.entries}
        onIssueNavigate={(nextIssueId) => setSelectedStageIssueId(nextIssueId)}
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
      <IssueOwnershipFormatDialog
        open={ownershipDialogState.open}
        heroSlug={heroSlug}
        issueTitle={ownershipDialogState.issueTitle}
        editions={ownershipDialogState.editions}
        selectedEditionIds={ownershipDialogState.selectedEditionIds}
        loading={ownershipDialogState.loading}
        saving={ownershipDialogState.saving}
        error={ownershipDialogState.error}
        onSelectSingleIssue={selectSingleIssueOwnership}
        onToggleEdition={toggleOwnershipEdition}
        onConfirm={confirmOwnershipDialog}
        onClose={closeOwnershipDialog}
      />
    </section>
  )
}

export default HeroTimelineInsights

