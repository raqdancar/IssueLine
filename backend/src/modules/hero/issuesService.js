// Gestiona dades de personatges, imatges i cronologies dins del backend.
import { supabaseServiceClient } from '../../lib/supabaseClient.js'
import { normalizeCoverUrl } from '../gcd/coverUtils.js'
import { coerceIsoDate, pickBestDate, mapIssueToTimelineEntry } from '../gcd/issueMapper.js'
import { normalizeSeriesName } from '../../utils/seriesNameUtils.js'
import { buildIssueHeadline } from '../../utils/issueHeadlineUtils.js'
import { resolveLegacyNumber } from './legacyNumbering.js'

const parseSeriesId = (issue) => {
  if (issue.series_id) return Number(issue.series_id)
  if (issue.series) {
    const match = /\/series\/(\d+)\//.exec(issue.series)
    if (match) {
      return Number(match[1])
    }
  }
  if (issue.api_url) {
    const match = /\/series\/(\d+)\//.exec(issue.api_url)
    if (match) {
      return Number(match[1])
    }
  }
  return null
}

const resolveGcdIssueId = (issue) => {
  if (issue.id) return Number(issue.id)
  if (issue.api_url) {
    const match = /\/issue\/(\d+)\//.exec(issue.api_url)
    if (match) {
      return Number(match[1])
    }
  }
  throw new Error('Issue payload is missing a gcd_issue_id.')
}

const deriveIssueDate = (issue) => {
  const best = pickBestDate(issue)
  return coerceIsoDate(best)
}

const coerceIssueNumber = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return Math.trunc(numeric)
  }
  const match = String(value).match(/\d+/)
  return match ? Number(match[0]) : null
}
const formatIssueRow = (heroApiId, issue) => {
  const issueDate = deriveIssueDate(issue)
  const normalizedNumber = coerceIssueNumber(issue.number)
  const normalizedPageCount = coerceIssueNumber(issue.page_count)
  // Persist both normalized fields and raw payload for future remapping/debugging.
  return {
    hero_api_id: heroApiId,
    gcd_issue_id: resolveGcdIssueId(issue),
    series_id: parseSeriesId(issue),
    series_name: normalizeSeriesName(issue.series_name) ?? issue.series_name ?? null,
    number: normalizedNumber,
    volume: issue.volume,
    title: issue.title,
    key_date: issue.key_date,
    on_sale_date: coerceIsoDate(issue.on_sale_date),
    publication_date: issue.publication_date,
    issue_date: issueDate,
    price: issue.price,
    page_count: normalizedPageCount,
    cover: normalizeCoverUrl(issue.cover),
    cover_original: issue.cover,
    raw: issue,
  }
}

export const upsertHeroIssues = async (heroApiId, issues) => {
  if (!heroApiId) {
    throw new Error('heroApiId is required to upsert hero issues.')
  }
  if (!issues?.length) {
    return []
  }

  const payload = issues.map((issue) => formatIssueRow(heroApiId, issue))
  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .upsert(payload, { onConflict: 'hero_api_id,gcd_issue_id' })
    .select('id, gcd_issue_id')

  if (error) {
    throw new Error(`Failed to upsert hero issues: ${error.message}`)
  }

  return data ?? []
}

export const getHeroIssuesByNumberRange = async ({ heroApiId, startNumber, endNumber }) => {
  if (!heroApiId) {
    throw new Error('heroApiId is required to read hero issues.')
  }

  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('*')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero issues: ${error.message}`)
  }

  const normalizedStart = startNumber ?? null
  const normalizedEnd = endNumber ?? null

  // Filter and sort client-side because issue numbers may include non-numeric tokens.
  return (data ?? [])
    .filter((row) => {
      const numeric = coerceIssueNumber(row.number)
      if (numeric === null) return false
      if (normalizedStart !== null && numeric < normalizedStart) return false
      if (normalizedEnd !== null && numeric > normalizedEnd) return false
      return true
    })
    .sort((a, b) => {
      const dateA = new Date(a.issue_date ?? a.on_sale_date ?? a.key_date ?? a.publication_date ?? 0).getTime()
      const dateB = new Date(b.issue_date ?? b.on_sale_date ?? b.key_date ?? b.publication_date ?? 0).getTime()
      if (Number.isNaN(dateA) || Number.isNaN(dateB)) {
        return (coerceIssueNumber(a.number) ?? 0) - (coerceIssueNumber(b.number) ?? 0)
      }
      return dateA - dateB
    })
}

const normalizeGcdIssueIds = (values = []) => {
  const normalized = new Set()
  for (const value of values) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) continue
    normalized.add(numeric)
  }
  return Array.from(normalized)
}

export const getHeroIssueCoverPathMap = async (heroApiId, gcdIssueIds) => {
  if (!heroApiId || !gcdIssueIds?.length) {
    return new Map()
  }

  const identifiers = normalizeGcdIssueIds(gcdIssueIds)
  if (!identifiers.length) {
    return new Map()
  }

  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('gcd_issue_id, cover_image_path')
    .eq('hero_api_id', heroApiId)
    .in('gcd_issue_id', identifiers)

  if (error) {
    throw new Error(`Failed to load hero issue covers: ${error.message}`)
  }

  const lookup = new Map()
  for (const row of data ?? []) {
    if (!row.cover_image_path) continue
    lookup.set(row.gcd_issue_id, row.cover_image_path)
  }

  return lookup
}

export const getHeroIssueCoverMetadataMap = async (heroApiId, gcdIssueIds) => {
  if (!heroApiId || !gcdIssueIds?.length) {
    return new Map()
  }

  const identifiers = normalizeGcdIssueIds(gcdIssueIds)
  if (!identifiers.length) {
    return new Map()
  }

  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('gcd_issue_id, cover_image_path, cover, cover_original')
    .eq('hero_api_id', heroApiId)
    .in('gcd_issue_id', identifiers)

  if (error) {
    throw new Error(`Failed to load hero issue cover metadata: ${error.message}`)
  }

  return new Map(
    (data ?? []).map((row) => [
      row.gcd_issue_id,
      {
        coverImagePath: row.cover_image_path ?? null,
        cover: row.cover ?? null,
        coverOriginal: row.cover_original ?? null,
      },
    ])
  )
}

export const getHeroIssueTimelineOrderMap = async (heroApiId, gcdIssueIds) => {
  if (!heroApiId || !gcdIssueIds?.length) {
    return new Map()
  }

  const identifiers = normalizeGcdIssueIds(gcdIssueIds)
  if (!identifiers.length) {
    return new Map()
  }

  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('gcd_issue_id, timeline_order')
    .eq('hero_api_id', heroApiId)
    .in('gcd_issue_id', identifiers)

  if (error) {
    throw new Error(`Failed to load hero issue timeline order: ${error.message}`)
  }

  const lookup = new Map()
  for (const row of data ?? []) {
    const timelineOrder = Number(row.timeline_order)
    if (!Number.isSafeInteger(timelineOrder) || timelineOrder <= 0) continue
    lookup.set(row.gcd_issue_id, timelineOrder)
  }

  return lookup
}

const buildIssuePayloadFromRow = (row) => {
  if (row.raw) {
    const payload = {
      ...row.raw,
      id: row.raw.id ?? row.gcd_issue_id,
      series_name: normalizeSeriesName(row.raw.series_name ?? row.series_name) ?? row.series_name ?? null,
      number: row.number ?? row.raw.number ?? null,
      title: row.raw.title ?? row.title,
      cover: row.raw.cover ?? row.cover_original ?? row.cover,
    }
    if (row.cover_image_path) {
      payload.cover_image_path = row.cover_image_path
    }
    return payload
  }

  const payload = {
    id: row.gcd_issue_id,
    number: row.number,
    title: row.title,
    series_name: normalizeSeriesName(row.series_name) ?? row.series_name ?? null,
    descriptor: row.number,
    key_date: row.key_date,
    on_sale_date: row.on_sale_date,
    publication_date: row.publication_date,
    price: row.price,
    page_count: row.page_count,
    cover: row.cover_original ?? row.cover,
    api_url: `https://www.comics.org/api/issue/${row.gcd_issue_id}/`,
  }

  if (row.cover_image_path) {
    payload.cover_image_path = row.cover_image_path
  }

  return payload
}

export const mapHeroIssueRowToTimelineEntry = (row) => {
  const payload = buildIssuePayloadFromRow(row)
  const legacyNumber = resolveLegacyNumber(row)

  const attachLegacyMetadata = (inputEntry) => {
    if (!legacyNumber) {
      return inputEntry
    }
    const cleanedSummary =
      typeof inputEntry.summary === 'string' && /^legacy/i.test(inputEntry.summary.trim())
        ? null
        : inputEntry.summary
    return {
      ...inputEntry,
      summary: cleanedSummary,
      metadata: {
        ...(inputEntry.metadata ?? {}),
        legacyNumber,
        legacy_number: legacyNumber,
      },
    }
  }

  const entry = mapIssueToTimelineEntry(payload)
  if (entry) {
    return attachLegacyMetadata(entry)
  }

  // Fallback path for rows that cannot be normalized through GCD mapper rules.
  const fallbackIssueDate = row.issue_date ?? row.on_sale_date ?? row.key_date ?? row.publication_date
  const normalizedSeriesName = normalizeSeriesName(row.series_name) ?? row.series_name ?? null
  const timelineHeadline = buildIssueHeadline({
    seriesName: normalizedSeriesName,
    number: row.number,
    issueCode: row.issue_code ?? row.number,
    fallback: row.title ?? `Issue ${row.number}`,
  })
  return attachLegacyMetadata({
    issueDate: fallbackIssueDate,
    headline: timelineHeadline,
    summary: row.publication_date ?? null,
    issueCode: row.number,
    severity: 'info',
    metadata: {
      gcdIssueId: row.gcd_issue_id,
      issueLabel: `${row.series_name ?? ''} ${row.number ?? ''}`.trim(),
      number: row.number,
      volume: row.volume,
      keyDate: row.key_date,
      key_date: row.key_date,
      publicationDate: row.publication_date,
      publication_date: row.publication_date,
      onSaleDate: row.on_sale_date,
      on_sale_date: row.on_sale_date,
      apiUrl: `https://www.comics.org/api/issue/${row.gcd_issue_id}/`,
      cover: row.cover,
      cover_original: row.cover_original,
      seriesName: row.series_name,
      series_name: row.series_name,
      seriesNameRaw: row.raw?.series_name ?? row.series_name ?? null,
      series_name_raw: row.raw?.series_name ?? row.series_name ?? null,
      price: row.price,
      pageCount: row.page_count,
      page_count: row.page_count,
      coverImagePath: row.cover_image_path ?? null,
      cover_image_path: row.cover_image_path ?? null,
    },
    sourceUrl: `https://www.comics.org/issue/${row.gcd_issue_id}/`,
  })
}





