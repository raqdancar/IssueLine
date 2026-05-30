// Agrupa funcions auxiliars reutilitzables dins del backend.
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
  // Prefer explicit numeric issue fields, then fallback to generic issue codes.
  const normalizedCode = normalizedNumber || stripHashPrefix(issueCode)

  // Keep timeline labels deterministic while gracefully degrading with missing data.
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
