// Provide the timeline utility helpers.
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

export const resolveMonthBucket = (entry) => {
  const metadata = entry.metadata ?? {}
  const rawDate =
    entry.issue_date ||
    metadata.issueDate ||
    metadata.issue_date ||
    metadata.keyDate ||
    metadata.key_date ||
    metadata.publication_date ||
    metadata.publicationDate

  if (rawDate) {
    const parsed = new Date(rawDate)
    if (!Number.isNaN(parsed.getTime())) {
      const key = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`
      return { key, label: monthFormatter.format(parsed) }
    }
  }

  return { key: 'unknown', label: 'Unknown date' }
}

export const resolveYearBucket = (entry) => {
  const metadata = entry.metadata ?? {}
  const rawDate =
    entry.issue_date ||
    metadata.issueDate ||
    metadata.issue_date ||
    metadata.keyDate ||
    metadata.key_date ||
    metadata.publication_date ||
    metadata.publicationDate

  if (rawDate) {
    const parsed = new Date(rawDate)
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear()
      return { key: `year-${year}`, label: String(year) }
    }
  }

  return { key: 'unknown-year', label: 'Unknown year' }
}

export const getEntryDomId = (entry, index) => {
  if (entry?.id) {
    return `timeline-entry-${entry.id}`
  }
  return `timeline-entry-${index}`
}

export const getStageKey = (entry) => {
  const meta = entry.metadata ?? {}
  const stageName = meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label
  if (!stageName) return null
  const normalized = stageName.trim()
  return normalized ? { key: normalized.toLowerCase(), label: normalized } : null
}

export const getIssueKey = (entry) => {
  const meta = entry.metadata ?? {}
  const number = meta.number ?? entry.issue_code
  if (!number) return null
  const numberLabel = String(number).trim()
  const normalized = numberLabel.toLowerCase().replace(/[^0-9a-z]+/g, '')
  if (!normalized) return null
  const shortLabel = numberLabel.startsWith('#') ? numberLabel : `#${numberLabel}`
  return { key: normalized, label: shortLabel }
}

export const resolveTimelineOrder = (entry) => {
  const meta = entry?.metadata ?? {}
  const value = meta.timelineOrder ?? meta.timeline_order
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

const resolveEntryTimestamp = (entry) => {
  const meta = entry?.metadata ?? {}
  const rawDate =
    entry?.issue_date ||
    meta.issueDate ||
    meta.issue_date ||
    meta.keyDate ||
    meta.key_date ||
    meta.publication_date ||
    meta.publicationDate

  const timestamp = new Date(rawDate ?? 0).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const resolveGcdIssueId = (entry) => {
  const meta = entry?.metadata ?? {}
  const numeric = Number(meta.gcdIssueId ?? meta.gcd_issue_id)
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : 0
}

export const compareTimelineEntries = (a, b, direction = 'asc', options = {}) => {
  const useTimelineOrder = options.useTimelineOrder ?? true

  if (useTimelineOrder) {
    const orderA = resolveTimelineOrder(a)
    const orderB = resolveTimelineOrder(b)
    if (orderA !== null || orderB !== null) {
      const safeA = orderA ?? Number.POSITIVE_INFINITY
      const safeB = orderB ?? Number.POSITIVE_INFINITY
      if (safeA !== safeB) return safeA - safeB
    }
  }

  const directionValue = direction === 'desc' ? -1 : 1
  const dateA = resolveEntryTimestamp(a)
  const dateB = resolveEntryTimestamp(b)
  if (dateA !== dateB) return directionValue * (dateA - dateB)

  return resolveGcdIssueId(a) - resolveGcdIssueId(b)
}
