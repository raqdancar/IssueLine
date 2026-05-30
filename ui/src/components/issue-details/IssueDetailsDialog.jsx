// Renderitza parts del dialeg de detall d'un issue i les seves edicions.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, CheckCircle2 } from 'lucide-react'
import { buildIssueImageUrl, resolveIssueCoverImage } from '@/lib/issueImages'
import { resolveHeroThemeStyle } from '@/lib/heroThemes'
import { isSpecialTimelineEventEntry } from '@/components/timeline/utils'
import { useIssueDetailsQuery } from '@/hooks/useIssueDetails.js'
import { useModalLayer } from '@/hooks/useModalLayer.js'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { compareTimelineEntries } from '@/utils/timeline'
import StageDetailDialog from '@/components/stage-details/StageDetailDialog'
import IssueDetailsHeader from './IssueDetailsHeader'
import IssueMetadataPanel from './IssueMetadataPanel'
import IssueCollectedEditionsSection from './IssueCollectedEditionsSection'

const resolveCoverImage = (issue, fallbackImage) => {
  if (!issue) return fallbackImage ?? null
  const coverFromStorage = buildIssueImageUrl(issue.images?.coverImagePath)
  return coverFromStorage ?? issue.images?.cover ?? issue.images?.coverOriginal ?? fallbackImage ?? null
}

const resolveEntryTimestamp = (entry) => {
  const meta = entry?.metadata ?? {}
  const candidates = [
    entry?.issue_date,
    meta.issueDate,
    meta.issue_date,
    meta.publication_date,
    meta.publicationDate,
    meta.key_date,
    meta.keyDate,
    meta.on_sale_date,
    meta.onSaleDate,
  ].filter(Boolean)

  for (const value of candidates) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime()
    }
  }

  return Number.POSITIVE_INFINITY
}

const resolveStageMeta = (entry) => {
  const meta = entry?.metadata ?? {}
  const rawName = meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? null
  if (!rawName) return null

  const normalizedName = String(rawName).trim()
  if (!normalizedName) return null

  const summary = meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null
  return {
    key: normalizedName.toLowerCase(),
    name: normalizedName,
    summary,
  }
}

const resolveIssueNumberSortValue = (issueNumber) => {
  const match = String(issueNumber ?? '').match(/\d+(?:\.\d+)?/)
  if (!match) return Number.POSITIVE_INFINITY
  const parsed = Number.parseFloat(match[0])
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

const resolveStageYearLabel = (issues, t) => {
  const years = issues
    .map((item) => {
      if (!Number.isFinite(item.timestamp)) return null
      return new Date(item.timestamp).getUTCFullYear()
    })
    .filter((value) => value !== null)

  if (!years.length) return t('timeline.yearTba')
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)
  return minYear === maxYear ? `${minYear}` : `${minYear} - ${maxYear}`
}

const buildTimelineIssueNavigation = ({ issueId, timelineEntries }) => {
  if (!issueId || !Array.isArray(timelineEntries) || !timelineEntries.length) {
    return { previousIssueId: null, nextIssueId: null }
  }

  const navigableEntries = timelineEntries
    .filter((entry) => entry?.id && !isSpecialTimelineEventEntry(entry))
    .sort((a, b) => compareTimelineEntries(a, b, 'asc'))
  const currentIndex = navigableEntries.findIndex((entry) => String(entry.id) === String(issueId))

  if (currentIndex === -1) {
    return { previousIssueId: null, nextIssueId: null }
  }

  return {
    previousIssueId: navigableEntries[currentIndex - 1]?.id ?? null,
    nextIssueId: navigableEntries[currentIndex + 1]?.id ?? null,
  }
}

const buildStageContext = ({ issue, issueId, timelineEntries, t }) => {
  if (!issue || !Array.isArray(timelineEntries) || !timelineEntries.length) return null

  const currentIssueId = String(issue?.id ?? issueId ?? '')
  if (!currentIssueId) return null

  const currentEntry = timelineEntries.find((entry) => String(entry?.id ?? '') === currentIssueId)
  if (!currentEntry) return null

  const stageMeta = resolveStageMeta(currentEntry)
  if (!stageMeta?.key) return null

  const stageIssues = timelineEntries
    .filter((entry) => {
      const entryStage = resolveStageMeta(entry)
      return entryStage?.key === stageMeta.key
    })
    .map((entry, index) => {
      const meta = entry?.metadata ?? {}
      const timestamp = resolveEntryTimestamp(entry)
      const issueNumber = meta.number ?? meta.issue_number ?? meta.issueNumber ?? entry?.issue_code ?? null
      const issueEntryId = entry?.id ?? meta.issue_id ?? meta.issueId ?? null
      return {
        key: `${stageMeta.key}-${issueEntryId ?? index}`,
        issueId: issueEntryId,
        issueLabel: entry?.headline ?? entry?.issue_code ?? t('timeline.issueFallback'),
        issueNumber,
        publishedAt:
          entry?.issue_date ?? meta.publication_date ?? meta.publicationDate ?? meta.key_date ?? meta.keyDate ?? null,
        timestamp,
        coverImage: resolveIssueCoverImage(meta, null),
      }
    })
    .filter((item) => item.issueId != null)
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
      return resolveIssueNumberSortValue(a.issueNumber) - resolveIssueNumberSortValue(b.issueNumber)
    })

  if (!stageIssues.length) return null

  const stageSummary = issue?.stage?.summary ?? stageMeta.summary ?? null
  return {
    stage: {
      key: stageMeta.key,
      name: issue?.stage?.name ?? stageMeta.name,
      summary: stageSummary,
      issueCount: stageIssues.length,
      yearLabel: resolveStageYearLabel(stageIssues, t),
    },
    issues: stageIssues,
  }
}

// Fullscreen modal with issue metadata, ownership actions, and collected editions.
function IssueDetailsDialog({
  open,
  heroSlug,
  issueId,
  portalContainer,
  timelineEntries = [],
  onIssueNavigate,
  fallbackImage,
  issueState,
  canUseIssueStateActions,
  issueStatePending,
  issueStateDisabled,
  issueStateDisabledReason,
  onIssueStateToggle,
  onClose,
}) {
  const { t } = useI18n()
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false)
  const query = useIssueDetailsQuery({
    heroSlug,
    issueId,
    enabled: open && Boolean(issueId),
  })

  const issue = query.data?.issue ?? null
  const collectedEditions = query.data?.collectedEditions ?? []
  const heroThemeStyle = resolveHeroThemeStyle(heroSlug)
  const coverImage = useMemo(() => resolveCoverImage(issue, fallbackImage), [issue, fallbackImage])
  const issueNavigation = useMemo(
    () => buildTimelineIssueNavigation({ issueId, timelineEntries }),
    [issueId, timelineEntries],
  )
  const stageContext = useMemo(
    () => buildStageContext({ issue, issueId, timelineEntries, t }),
    [issue, issueId, timelineEntries, t],
  )
  const coverAlt = issue?.headline ?? issue?.issue?.title ?? t('common.issueCover')

  useModalLayer({ open, onClose, lockScroll: true, closeOnEscape: true })
  useEffect(() => {
    if (!open) {
      setIsStageDialogOpen(false)
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null
  const portalTarget = portalContainer ?? document.body

  return createPortal(
    <div
      style={heroThemeStyle}
      className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/75 px-3 py-4 md:items-center md:px-6 md:py-8"
      onClick={onClose}
    >
      <div className="w-full max-w-[1480px]" onClick={(event) => event.stopPropagation()}>
        <div className="max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/30 sm:p-6 lg:flex lg:h-[92vh] lg:flex-col lg:overflow-hidden">
          <IssueDetailsHeader
            issue={issue}
            onClose={onClose}
            previousIssueId={issueNavigation.previousIssueId}
            nextIssueId={issueNavigation.nextIssueId}
            onIssueNavigate={onIssueNavigate}
            actionButtons={[
              {
                key: 'haveIt',
                active: Boolean(issueState?.haveIt),
                icon: CheckCircle2,
                label: t('timeline.addToCollection'),
                onClick: () => onIssueStateToggle?.('haveIt', !issueState?.haveIt),
              },
              {
                key: 'readIt',
                active: Boolean(issueState?.readIt),
                icon: BookOpen,
                label: t('timeline.markAsRead'),
                onClick: () => onIssueStateToggle?.('readIt', !issueState?.readIt),
              },
            ]}
            actionsDisabled={Boolean(!canUseIssueStateActions || issueStateDisabled)}
            actionsPending={Boolean(issueStatePending)}
            actionsDisabledReason={issueStateDisabledReason ?? t('timeline.issueActionsUnavailable')}
          />

          {query.isLoading ? (
            <div className="space-y-4 py-4">
              <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : query.isError ? (
            <div className="space-y-3 py-6">
              <p className="body-sm text-rose-600">{query.error?.message ?? t('issueDetails.loadError')}</p>
              <Button type="button" variant="outline" onClick={() => query.refetch()}>
                {t('issueDetails.retry')}
              </Button>
            </div>
          ) : !issue ? (
            <p className="body-sm py-6 text-slate-500">{t('issueDetails.empty')}</p>
          ) : (
            <div className="space-y-6 py-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5 lg:space-y-0 lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="grid gap-5 lg:min-h-0 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-start lg:overflow-y-auto lg:pr-1 xl:grid-cols-[180px_minmax(0,1fr)]">
                <div className="mx-auto w-full max-w-[180px] sm:max-w-[210px] lg:mx-0 lg:max-w-[180px]">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="aspect-2/3">
                      {coverImage ? (
                        <img src={coverImage} alt={coverAlt} className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-4 text-center">
                          <p className="body-sm text-slate-500">{t('issueDetails.coverMissing')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <IssueMetadataPanel issue={issue} />
                  {stageContext?.stage ? (
                    <section className="mt-4 rounded-xl border border-primary/30 bg-accent/50 p-3">
                      <p className="body-xs font-semibold uppercase tracking-wide text-primary">{t('timeline.stage')}</p>
                      <p className="mt-1 text-base font-semibold text-foreground">{stageContext.stage.name}</p>
                      <p className="body-xs mt-1 text-muted-foreground">
                        {stageContext.stage.yearLabel} - {t('timeline.trackedIssues', { count: stageContext.stage.issueCount })}
                      </p>
                      <p className="body-sm mt-2 text-foreground">
                        {stageContext.stage.summary ?? t('timeline.noStageSummary')}
                      </p>
                      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setIsStageDialogOpen(true)}>
                        {t('timeline.viewStageDetails')}
                      </Button>
                    </section>
                  ) : null}
                </div>
              </section>
              <IssueCollectedEditionsSection collectedEditions={collectedEditions} />
            </div>
          )}
        </div>
      </div>
      <StageDetailDialog
        open={Boolean(isStageDialogOpen && stageContext?.stage)}
        onClose={() => setIsStageDialogOpen(false)}
        stage={stageContext?.stage ?? null}
        issues={stageContext?.issues ?? []}
        heroSlug={heroSlug}
        portalContainer={portalContainer}
        onIssueSelect={(stageIssue) => {
          if (!stageIssue?.issueId) return
          onIssueNavigate?.(stageIssue.issueId)
          setIsStageDialogOpen(false)
        }}
      />
    </div>,
    portalTarget,
  )
}

export default IssueDetailsDialog
