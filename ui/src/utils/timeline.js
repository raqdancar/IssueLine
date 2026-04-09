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
  const normalized = String(number).toLowerCase().replace(/[^0-9a-z]+/g, '')
  if (!normalized) return null
  return { key: normalized, label: `Issue #${number}` }
}
