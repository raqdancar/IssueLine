import { normalizeCoverUrl } from './gcdCoverUtils.js'

export const coerceIsoDate = (raw) => {
  if (!raw) return null
  let value = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    value = value.replace('-00', '-01')
  } else if (/^\d{4}-\d{2}-00$/.test(value)) {
    value = value.replace(/-00$/, '-01')
  } else if (/^\d{4}-00-00$/.test(value)) {
    value = value.replace('-00-00', '-01-01')
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
  if (issue.series_name) {
    parts.push(issue.series_name.trim())
  }
  if (descriptor) {
    parts.push(descriptor)
  } else if (number) {
    parts.push(`#${number}`)
  }
  return parts.length ? parts.join(' ') : 'Issue'
}

const extractIssueIdFromUrl = (url) => {
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

  return {
    issueDate: isoDate,
    headline: issue.title?.trim() || issueLabel,
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
      seriesName: issue.series_name,
      series_name: issue.series_name,
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
