// Construeix peces visuals i derivacions de la cronologia d'issues.
import { formatCollectedEditionFormat } from '@/lib/collectedEditions'
import { buildPublicStorageUrl, resolveIssueCoverImage } from '@/lib/issueImages'
import { resolvePrintLanguageBadge } from '@/lib/printLanguage'

const COLLECTED_EDITION_IMAGE_BUCKET = import.meta.env.VITE_COLLECTED_EDITION_IMAGE_BUCKET ?? 'collected-edition-images'

export const ALL_FILTER_VALUE = 'all'

export const resolveStageName = (entry, t) => {
  const meta = entry?.metadata ?? {}
  return meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? t('timeline.uncategorizedStage')
}

export const resolveStageSummary = (entry) => {
  const meta = entry?.metadata ?? {}
  return meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null
}

export const resolveStageKey = (entry) => {
  const meta = entry?.metadata ?? {}
  const name = meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? null
  if (!name) return null
  const normalized = name.trim().toLowerCase()
  return normalized || null
}

export const resolveEntryTimestamp = (entry) => {
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

export const resolveIssueQuickLabel = (entry, t) => {
  const meta = entry?.metadata ?? {}
  const issueLabel = meta.issueLabel ?? entry.issue_code ?? null
  if (issueLabel) return issueLabel
  const number = meta.number
  if (number) return t('timeline.issueLabel', { number })
  return entry?.headline ?? t('timeline.issueFallback')
}

export const buildStageGroups = (entries, stateIndex = {}, t, locale) => {
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

export const resolveCollectedCoverImage = (value) => buildPublicStorageUrl(value, COLLECTED_EDITION_IMAGE_BUCKET)

const normalizeFilterValue = (value) => String(value ?? '').trim().toLowerCase()

export const resolveEditionLanguageFilter = (edition) => {
  const rawValue = edition?.printLanguage ?? edition?.print_language ?? ''
  const badge = resolvePrintLanguageBadge(rawValue)
  if (badge?.code) {
    return {
      value: badge.code.toLowerCase(),
      label: badge.label ?? badge.code,
    }
  }

  const normalized = normalizeFilterValue(rawValue)
  return normalized ? { value: normalized, label: String(rawValue).trim() } : null
}

export const resolveEditionFormatFilter = (edition) => {
  const rawValue = edition?.format ?? ''
  const normalized = normalizeFilterValue(rawValue)
  return normalized ? { value: normalized, label: formatCollectedEditionFormat(rawValue) } : null
}

export const buildFilterOptions = (items, resolver) => {
  const optionsByValue = new Map()
  for (const item of items) {
    const option = resolver(item)
    if (!option?.value || optionsByValue.has(option.value)) continue
    optionsByValue.set(option.value, option)
  }
  return Array.from(optionsByValue.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export const buildFilteredCollectedEditions = ({
  collectedEditions = [],
  collectedLanguageFilter,
  collectedFormatFilter,
}) =>
  collectedEditions.filter((edition) => {
    const languageOption = resolveEditionLanguageFilter(edition)
    const formatOption = resolveEditionFormatFilter(edition)
    const languageMatches =
      collectedLanguageFilter === ALL_FILTER_VALUE || languageOption?.value === collectedLanguageFilter
    const formatMatches =
      collectedFormatFilter === ALL_FILTER_VALUE || formatOption?.value === collectedFormatFilter
    return languageMatches && formatMatches
  })

export const buildCollectedEditionFormatGroups = (collectedEditions = []) => {
  const groupsByFormat = new Map()

  for (const edition of collectedEditions) {
    const formatOption = resolveEditionFormatFilter(edition) ?? {
      value: 'unknown',
      label: formatCollectedEditionFormat('unknown'),
    }

    if (!groupsByFormat.has(formatOption.value)) {
      groupsByFormat.set(formatOption.value, {
        key: formatOption.value,
        label: formatOption.label,
        editions: [],
      })
    }

    groupsByFormat.get(formatOption.value).editions.push(edition)
  }

  return Array.from(groupsByFormat.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export const buildStageCoverageMap = (stages = []) =>
  stages.reduce((acc, stage) => {
    if (!stage?.key) return acc
    acc[stage.key] = stage.count ?? 0
    return acc
  }, {})

export const buildStageTimelineIssuesByKey = (entries, t) => {
  const index = new Map()

  entries.forEach((entry) => {
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
}

export const resolveTimelineRange = (entries, t) => {
  if (!entries.length) return { label: t('timeline.yearTba') }
  const timestamps = entries
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
}

export const getCollectedEditionTimelineIssueIds = (edition) =>
  Array.from(new Set((edition?.issues ?? []).map((issue) => issue?.timelineIssueId).filter(Boolean)))

export const isCollectedEditionOwned = ({ edition, statesByIssueId = {} }) => {
  const editionId = String(edition?.id ?? '')
  if (!editionId) return false

  const issueIds = getCollectedEditionTimelineIssueIds(edition)
  if (!issueIds.length) return false

  return issueIds.every((issueId) => {
    const issueState = statesByIssueId?.[issueId]
    const selectedEditionIds = Array.isArray(issueState?.collectedEditionIds)
      ? issueState.collectedEditionIds.map(String)
      : []
    return Boolean(issueState?.haveIt) && selectedEditionIds.includes(editionId)
  })
}

export const isCollectedEditionRead = ({ edition, statesByIssueId = {} }) => {
  const issueIds = getCollectedEditionTimelineIssueIds(edition)
  if (!issueIds.length) return false
  return issueIds.every((issueId) => Boolean(statesByIssueId?.[issueId]?.readIt))
}
