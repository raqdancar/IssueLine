import { normalizeSeriesName } from './seriesNameUtils.js'

const stripHashPrefix = (value) => {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  return trimmed.replace(/^#+/, '').trim()
}

export const buildIssueHeadline = ({ seriesName, issueCode, number, fallback }) => {
  const normalizedSeries = normalizeSeriesName(seriesName) ?? seriesName ?? ''
  const normalizedNumber = stripHashPrefix(number)
  const normalizedCode = normalizedNumber || stripHashPrefix(issueCode)

  if (normalizedSeries && normalizedCode) {
    return `${normalizedSeries} #${normalizedCode}`
  }

  if (normalizedSeries) {
    return normalizedSeries
  }

  if (normalizedCode) {
    return `Issue #${normalizedCode}`
  }

  return fallback || 'Issue'
}
