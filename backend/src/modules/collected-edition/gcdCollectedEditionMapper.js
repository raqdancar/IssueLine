// Gestiona el model i la persistencia de les edicions recopilatories.
import { normalizeCoverUrl } from '../gcd/coverUtils.js'
import { coerceIsoDate } from '../gcd/issueMapper.js'

const sanitizeString = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized ? normalized : null
}

const toIntegerOrNull = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.round(numeric)
}

const resolveSeriesId = (issue) => {
  if (issue?.series_id) {
    const numeric = Number(issue.series_id)
    if (Number.isSafeInteger(numeric) && numeric > 0) return numeric
  }
  const source = issue?.series ?? issue?.series_url ?? issue?.api_url ?? ''
  const match = /\/series\/(\d+)\//i.exec(source)
  if (!match) return null
  const numeric = Number(match[1])
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

const resolveIssueId = (issue) => {
  if (issue?.id) {
    const numeric = Number(issue.id)
    if (Number.isSafeInteger(numeric) && numeric > 0) return numeric
  }
  const source = issue?.api_url ?? issue?.issue ?? ''
  const match = /\/issue\/(\d+)\//i.exec(source)
  if (!match) return null
  const numeric = Number(match[1])
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

const parsePotentialIsbn = (value) => {
  const normalized = String(value ?? '')
    .replace(/[^0-9Xx]/g, '')
    .toUpperCase()
  if (!normalized) return null
  if (normalized.length !== 10 && normalized.length !== 13) return null
  return normalized
}

const resolveIsbn = (issue) => {
  const candidates = [
    issue?.isbn,
    issue?.isbn10,
    issue?.isbn_10,
    issue?.isbn13,
    issue?.isbn_13,
    issue?.barcode,
    issue?.identifiers?.isbn,
  ]
  for (const candidate of candidates) {
    // Accept whichever identifier first matches ISBN10/ISBN13 shape.
    const normalized = parsePotentialIsbn(candidate)
    if (normalized) return normalized
  }
  return null
}

const containsAny = (haystack, needles) => needles.some((token) => haystack.includes(token))

export const inferCollectedEditionFormat = ({ title, subtitle, seriesTitle, description }) => {
  const text = [title, subtitle, seriesTitle, description]
    .map((value) => sanitizeString(value)?.toLowerCase() ?? '')
    .join(' ')
  if (!text) return 'unknown'
  if (containsAny(text, ['epic collection'])) return 'epic_collection'
  if (containsAny(text, ['masterworks'])) return 'masterworks'
  if (containsAny(text, ['omnibus'])) return 'omnibus'
  if (containsAny(text, ['hardcover', 'hc'])) return 'hardcover'
  if (containsAny(text, ['trade paperback', 'tpb', 'paperback'])) return 'tpb'
  if (containsAny(text, ['collected edition', 'collection'])) return 'collected_edition'
  return 'unknown'
}

const resolvePublicationDate = (issue) =>
  coerceIsoDate(issue?.on_sale_date) ?? coerceIsoDate(issue?.key_date) ?? coerceIsoDate(issue?.publication_date)

const resolveCoverDate = (issue) => coerceIsoDate(issue?.key_date)

export const normalizeGcdCollectedEdition = (issue) => {
  if (!issue || typeof issue !== 'object') {
    throw new Error('GCD collected edition payload is invalid.')
  }

  const gcdIssueId = resolveIssueId(issue)
  if (!gcdIssueId) {
    throw new Error('GCD payload is missing a valid issue identifier.')
  }

  const title = sanitizeString(issue.title) ?? sanitizeString(issue.headline) ?? null
  const subtitle = sanitizeString(issue.descriptor) ?? sanitizeString(issue.number) ?? null
  const seriesTitle = sanitizeString(issue.series_name) ?? null
  const publisher = sanitizeString(issue.publisher) ?? sanitizeString(issue.brand) ?? null
  const description = sanitizeString(issue.notes) ?? null
  const pageCount = toIntegerOrNull(issue.page_count)
  const isbn = resolveIsbn(issue)
  const coverImageUrl =
    sanitizeString(issue.cover_image_url) ??
    sanitizeString(issue.cover_image_path) ??
    normalizeCoverUrl(issue.cover) ??
    null
  const publicationDate = resolvePublicationDate(issue)
  const coverDate = resolveCoverDate(issue)
  const sourceSeriesId = resolveSeriesId(issue)
  const format = inferCollectedEditionFormat({
    title,
    subtitle,
    seriesTitle,
    description,
  })

  return {
    title: title ?? `${seriesTitle ?? 'Collected edition'} ${subtitle ?? ''}`.trim(),
    subtitle,
    seriesTitle,
    publisher,
    publicationDate,
    coverDate,
    description,
    pageCount,
    format,
    coverImageUrl,
    source: 'gcd',
    sourceExternalId: String(gcdIssueId),
    sourceSeriesId: sourceSeriesId ? String(sourceSeriesId) : null,
    isbn,
    gcdIssueId,
    gcdIssueApiUrl: sanitizeString(issue.api_url) ?? null,
    rawSourcePayload: issue,
  }
}
