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

  let coverLookup = new Map()
  if (gcdIssueIds.length) {
    try {
      coverLookup = await getHeroIssueCoverPathMap(heroApiId, gcdIssueIds)
    } catch (coverLookupError) {
      // Timeline data should still render even when cover enrichment fails in a partial deploy/migration state.
      console.warn(
        `[heroTimeline] cover enrichment skipped for hero ${heroApiId}: ${coverLookupError.message}`
      )
      return entries
    }
  }

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

const chunk = (values, size = 100) => {
  const batches = []
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size))
  }
  return batches
}

const buildTimelinePayload = (heroApiId, entry) => ({
  hero_api_id: heroApiId,
  headline: entry.headline,
  summary: entry.summary ?? null,
  issue_code: entry.issueCode ?? null,
  issue_date: normalizeIssueDate(entry.issueDate),
  source_url: entry.sourceUrl ?? null,
  severity: entry.severity ?? 'info',
  metadata: entry.metadata ?? null,
})

const resolveTimelineGcdIssueId = (entry) => {
  const value = entry?.metadata?.gcdIssueId ?? entry?.metadata?.gcd_issue_id
  if (value === undefined || value === null) return null
  const numeric = Number(value)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null
  return String(numeric)
}

const loadTimelineRowsByGcdIssueId = async (heroApiId, gcdIssueIds) => {
  if (!gcdIssueIds.length) return new Map()

  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero timelines for upsert: ${error.message}`)
  }

  const targetSet = new Set(gcdIssueIds)
  const lookup = new Map()
  for (const row of data ?? []) {
    const gcdIssueId = resolveTimelineGcdIssueId({ metadata: row.metadata })
    if (!gcdIssueId || !targetSet.has(gcdIssueId) || lookup.has(gcdIssueId)) {
      continue
    }
    lookup.set(gcdIssueId, row)
  }

  return lookup
}

/**
 * Upserts timeline rows by hero + metadata.gcdIssueId.
 * If an entry has no gcdIssueId, it is inserted as a new row.
 */
export const upsertHeroTimelineEntriesByGcdIssueId = async (heroApiId, entries) => {
  if (!entries?.length) {
    return { inserted: [], updated: [], skipped: [] }
  }

  const entriesWithId = []
  const entriesWithoutId = []
  for (const entry of entries) {
    const gcdIssueId = resolveTimelineGcdIssueId(entry)
    if (gcdIssueId) {
      entriesWithId.push({ entry, gcdIssueId })
    } else {
      entriesWithoutId.push(entry)
    }
  }

  const existingLookup = await loadTimelineRowsByGcdIssueId(
    heroApiId,
    Array.from(new Set(entriesWithId.map((item) => item.gcdIssueId)))
  )

  const toInsert = [...entriesWithoutId]
  const toUpdate = []
  const skipped = []

  for (const item of entriesWithId) {
    const existing = existingLookup.get(item.gcdIssueId)
    if (!existing) {
      toInsert.push(item.entry)
      continue
    }
    toUpdate.push({ id: existing.id, entry: item.entry, gcdIssueId: item.gcdIssueId })
  }

  const inserted = toInsert.length ? await insertHeroTimelineEntries(heroApiId, toInsert) : []
  const updated = []

  for (const batch of chunk(toUpdate, 25)) {
    await Promise.all(
      batch.map(async ({ id, entry, gcdIssueId }) => {
        const payload = buildTimelinePayload(heroApiId, entry)
        const { data, error } = await supabaseServiceClient
          .from('hero_timelines')
          .update(payload)
          .eq('id', id)
          .select('*')
          .maybeSingle()

        if (error) {
          skipped.push({ gcdIssueId, id, reason: error.message })
          return
        }

        if (!data) {
          skipped.push({ gcdIssueId, id, reason: 'Timeline row not found during update.' })
          return
        }

        updated.push(data)
      })
    )
  }

  return { inserted, updated, skipped }
}

/**
 * Deletes hero timeline rows where metadata.gcdIssueId matches provided ids.
 */
export const deleteHeroTimelineEntriesByGcdIssueIds = async (heroApiId, gcdIssueIds) => {
  const targets = Array.from(
    new Set(
      (gcdIssueIds ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 0)
        .map((value) => String(value))
    )
  )
  if (!targets.length) {
    return { deleted: 0, failed: [] }
  }

  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero timelines for delete: ${error.message}`)
  }

  const targetSet = new Set(targets)
  const idsToDelete = (data ?? [])
    .filter((row) => {
      const value = resolveTimelineGcdIssueId({ metadata: row.metadata })
      return value ? targetSet.has(value) : false
    })
    .map((row) => row.id)

  if (!idsToDelete.length) {
    return { deleted: 0, failed: [] }
  }

  const failed = []
  let deleted = 0
  for (const batch of chunk(idsToDelete, 100)) {
    const { error: deleteError, count } = await supabaseServiceClient
      .from('hero_timelines')
      .delete({ count: 'exact' })
      .in('id', batch)

    if (deleteError) {
      failed.push({ ids: batch, reason: deleteError.message })
      continue
    }
    deleted += count ?? batch.length
  }

  return { deleted, failed }
}

