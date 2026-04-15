import { supabaseServiceClient } from '../../lib/supabaseClient.js'
import { getHeroIssueCoverPathMap } from './issuesService.js'

const normalizeIssueDate = (value) => {
  if (!value) {
    throw new Error('Issue date is required.')
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid issue date provided: ${value}`)
  }
  return date.toISOString().slice(0, 10)
}

export const getHeroBySlug = async (slug) => {
  const normalizedSlug = slug?.trim().toLowerCase()
  if (!normalizedSlug) {
    throw new Error('Hero slug is required.')
  }

  const { data, error } = await supabaseServiceClient
    .from('superheroes')
    .select('api_id, name, slug, publisher')
    .eq('slug', normalizedSlug)
    .order('api_id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch hero by slug: ${error.message}`)
  }

  return data
}

export const getHeroTimelineEntries = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, issue_date, headline, summary, issue_code, source_url, severity, metadata, special_issue, created_at')
    .eq('hero_api_id', heroApiId)
    .order('issue_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch timeline entries: ${error.message}`)
  }

  const entries = data ?? []
  const gcdIssueIds = entries
    .map((entry) => {
      const metadata = entry.metadata ?? {}
      if (metadata.gcdIssueId) return Number(metadata.gcdIssueId)
      if (metadata.gcd_issue_id) return Number(metadata.gcd_issue_id)
      return null
    })
    .filter((value) => Number.isFinite(value))

  const coverLookup = gcdIssueIds.length ? await getHeroIssueCoverPathMap(heroApiId, gcdIssueIds) : new Map()

  if (!coverLookup.size) {
    return entries
  }

  return entries.map((entry) => {
    const metadata = entry.metadata ?? null
    if (!metadata) return entry
    const gcdIssueId = metadata.gcdIssueId ?? metadata.gcd_issue_id
    const coverPath = coverLookup.get(Number(gcdIssueId))
    if (!coverPath) {
      return entry
    }
    return {
      ...entry,
      metadata: {
        ...metadata,
        coverImagePath: coverPath,
        cover_image_path: coverPath,
      },
    }
  })
}

export const createHeroTimelineEntry = async ({
  heroApiId,
  headline,
  summary,
  issueCode,
  issueDate,
  sourceUrl,
  severity = 'info',
  metadata,
}) => {
  const normalizedDate = normalizeIssueDate(issueDate)

  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .insert({
      hero_api_id: heroApiId,
      headline,
      summary,
      issue_code: issueCode ?? null,
      issue_date: normalizedDate,
      source_url: sourceUrl ?? null,
      severity,
      metadata: metadata ?? null,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create hero timeline entry: ${error.message}`)
  }

  return data
}

export const getExistingGcdIssueIds = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('metadata')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load existing hero timeline metadata: ${error.message}`)
  }

  const identifiers = new Set()
  for (const row of data ?? []) {
    const gcdIssueId = row?.metadata?.gcdIssueId || row?.metadata?.metronIssueId
    if (gcdIssueId) {
      identifiers.add(String(gcdIssueId))
    }
  }
  return identifiers
}

export const insertHeroTimelineEntries = async (heroApiId, entries) => {
  if (!entries?.length) {
    return []
  }

  const payload = entries.map((entry) => ({
    hero_api_id: heroApiId,
    headline: entry.headline,
    summary: entry.summary ?? null,
    issue_code: entry.issueCode ?? null,
    issue_date: normalizeIssueDate(entry.issueDate),
    source_url: entry.sourceUrl ?? null,
    severity: entry.severity ?? 'info',
    metadata: entry.metadata ?? null,
  }))

  const { data, error } = await supabaseServiceClient.from('hero_timelines').insert(payload).select('*')

  if (error) {
    throw new Error(`Failed to create hero timeline entries: ${error.message}`)
  }

  return data ?? []
}

