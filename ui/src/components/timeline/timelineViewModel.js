// Construeix peces visuals i derivacions de la cronologia d'issues.
import { isAnnualIssueEntry, isSpecialTimelineEventEntry } from '@/components/timeline/utils'
import {
  compareTimelineEntries,
  getEntryDomId,
  getIssueKey,
  getStageKey,
  resolveMonthBucket,
  resolveTimelineOrder,
  resolveYearBucket,
} from '@/utils/timeline'

const buildMonthAnchors = (entries) => {
  const orderedKeys = []
  const groups = new Map()

  entries.forEach((entry, index) => {
    const bucket = resolveMonthBucket(entry)
    if (!groups.has(bucket.key)) {
      orderedKeys.push(bucket.key)
      groups.set(bucket.key, {
        ...bucket,
        count: 0,
        targetId: getEntryDomId(entry, index),
      })
    }
    groups.get(bucket.key).count += 1
  })

  return orderedKeys.map((key) => groups.get(key))
}

const buildYearAnchors = (entries) => {
  const orderedKeys = []
  const groups = new Map()

  entries.forEach((entry, index) => {
    const bucket = resolveYearBucket(entry)
    if (!groups.has(bucket.key)) {
      orderedKeys.push(bucket.key)
      groups.set(bucket.key, {
        ...bucket,
        count: 0,
        targetId: getEntryDomId(entry, index),
      })
    }
    groups.get(bucket.key).count += 1
  })

  return orderedKeys.map((key) => groups.get(key))
}

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

const buildStageAnchors = (entries) => {
  const orderedKeys = []
  const groups = new Map()

  entries.forEach((entry, index) => {
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
        startRank: resolveStageRank(entry, index),
      })
    }

    const group = groups.get(stage.key)
    group.count += 1

    const candidateRank = resolveStageRank(entry, index)
    if (isBetterStageStart(candidateRank, group.startRank)) {
      group.targetId = getEntryDomId(entry, index)
      group.startRank = candidateRank
    }
  })

  return orderedKeys.map((key) => {
    const { startRank: _startRank, ...group } = groups.get(key)
    return group
  })
}

const buildIssueAnchors = (entries, t) => {
  const stageOrder = []
  const stages = new Map()
  const flattened = []

  entries.forEach((entry, index) => {
    if (isSpecialTimelineEventEntry(entry)) return

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
}

export const buildTimelineViewModel = ({
  entries = [],
  sortDirection,
  timelineOrderMode,
  publicationFilter,
  collectionFilters,
  issueStatesById = {},
  t,
}) => {
  const hasCanonicalTimelineOrder = entries.some((entry) => resolveTimelineOrder(entry) !== null)
  const useCanonicalOrder = hasCanonicalTimelineOrder && timelineOrderMode === 'canonical'
  const orderedEntries = [...entries].sort((a, b) =>
    compareTimelineEntries(a, b, useCanonicalOrder ? 'asc' : sortDirection, {
      useTimelineOrder: useCanonicalOrder,
    }),
  )

  const filteredEntries = orderedEntries.filter((entry) => {
    if (publicationFilter === 'annuals' && !isAnnualIssueEntry(entry)) return false

    const issueState = entry?.id ? issueStatesById?.[entry.id] : null
    const haveIt = Boolean(issueState?.haveIt)
    const readIt = Boolean(issueState?.readIt)

    if (collectionFilters.ownedOnly && !haveIt) return false
    if (collectionFilters.readOnly && !readIt) return false
    return true
  })

  const navigableEntries = filteredEntries.filter((entry) => !isSpecialTimelineEventEntry(entry))

  const monthAnchors = buildMonthAnchors(navigableEntries)
  const yearAnchors = buildYearAnchors(navigableEntries)
  const stageAnchors = buildStageAnchors(filteredEntries)
  const { issueAnchors, issueAnchorsByStage } = buildIssueAnchors(navigableEntries, t)
  const anchorLookup = {
    month: monthAnchors,
    year: yearAnchors,
    stage: stageAnchors,
    issue: issueAnchors,
  }

  return {
    hasCanonicalTimelineOrder,
    orderedEntries,
    filteredEntries,
    monthAnchors,
    yearAnchors,
    stageAnchors,
    issueAnchors,
    issueAnchorsByStage,
    anchorLookup,
    canShowNavigator: monthAnchors.length > 0 || stageAnchors.length > 0 || issueAnchors.length > 0,
  }
}
