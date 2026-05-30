// Gestiona la integracio amb GCD i la normalitzacio de dades editorials.
import { normalizeCoverUrl } from './coverUtils.js'
import { normalizeSeriesName } from '../../utils/seriesNameUtils.js'
import { buildIssueHeadline } from '../../utils/issueHeadlineUtils.js'

export const coerceIsoDate = (raw) => {
  if (!raw) return null
  let value = raw.trim()
  // Normalize partial dates from GCD so timeline sorting always has a valid ISO day.
  if (/^\d{4}-00-00$/.test(value)) {
    value = value.replace('-00-00', '-01-01')
  } else if (/^\d{4}-00-\d{2}$/.test(value)) {
    value = value.replace('-00-', '-01-')
  } else if (/^\d{4}-\d{2}-00$/.test(value)) {
    value = value.replace(/-00$/, '-01')
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    value = value.replace('-00-', '-01-').replace(/-00$/, '-01')
  } else if (/^\d{4}-\d{2}$/.test(value)) {
    value = `${value}-01`
  } else if (/^\d{4}$/.test(value)) {
    value = `${value}-01-01`
  }
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return null
  }
  return new Date(timestamp).toISOString().slice(0, 10)
}

export const pickBestDate = (issue) => issue.key_date || issue.on_sale_date || issue.publication_date

const normalizeIssueLabel = (issue) => {
  const descriptor = issue.descriptor?.trim()
  const number = issue.number?.trim()
  const parts = []
  const normalizedSeriesName = normalizeSeriesName(issue.series_name)
  if (normalizedSeriesName) {
    parts.push(normalizedSeriesName)
  }
  if (descriptor) {
    parts.push(descriptor)
  } else if (number) {
    parts.push(`#${number}`)
  }
  return parts.length ? parts.join(' ') : 'Issue'
}

export const extractIssueIdFromUrl = (url) => {
  if (!url) return null
  const match = /\/issue\/(\d+)\//.exec(url)
  return match ? Number(match[1]) : null
}

export const mapIssueToTimelineEntry = (issue) => {
  const isoDate = coerceIsoDate(pickBestDate(issue))
  if (!isoDate) {
    return null
  }

  const issueLabel = normalizeIssueLabel(issue)
  const gcdIssueId = issue.id ?? extractIssueIdFromUrl(issue.api_url)
  const coverSmall = normalizeCoverUrl(issue.cover)
  const coverImagePath = issue.cover_image_path ?? issue.coverImagePath ?? null
  const normalizedSeriesName = normalizeSeriesName(issue.series_name) ?? issue.series_name ?? null
  // Build a stable display headline while preserving legacy fields in metadata.
  const timelineHeadline = buildIssueHeadline({
    seriesName: normalizedSeriesName,
    number: issue.number,
    issueCode: issue.issue_code ?? issue.descriptor ?? issueLabel,
    fallback: issueLabel,
  })

  return {
    issueDate: isoDate,
    headline: timelineHeadline,
    summary: issue.notes?.trim() || issue.publication_date || null,
    issueCode: issue.descriptor || issue.number || issueLabel,
    severity: 'info',
    metadata: {
      gcdIssueId,
      issueLabel,
      number: issue.number,
      volume: issue.volume,
      keyDate: issue.key_date,
      key_date: issue.key_date,
      publicationDate: issue.publication_date,
      publication_date: issue.publication_date,
      onSaleDate: issue.on_sale_date,
      on_sale_date: issue.on_sale_date,
      apiUrl: issue.api_url,
      cover: coverSmall,
      cover_original: issue.cover,
      seriesName: normalizedSeriesName,
      series_name: normalizedSeriesName,
      seriesNameRaw: issue.series_name ?? null,
      series_name_raw: issue.series_name ?? null,
      price: issue.price,
      pageCount: issue.page_count,
      page_count: issue.page_count,
      editing: issue.editing,
      rating: issue.rating,
      coverImagePath,
      cover_image_path: coverImagePath,
    },
    sourceUrl: issue.api_url?.replace('?format=json', '') ?? null,
  }
}

