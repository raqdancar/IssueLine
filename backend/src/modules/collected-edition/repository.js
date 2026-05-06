// Read/write collected-edition records and edition-to-issue links in Supabase.
import { supabaseServiceClient } from '../../lib/supabaseClient.js'

const escapeIlike = (value) => String(value ?? '').replace(/[%_,]/g, '').trim()

const buildCollectedEditionPayload = ({ heroApiId, edition }) => ({
  hero_api_id: heroApiId,
  title: edition.title,
  subtitle: edition.subtitle,
  series_title: edition.seriesTitle ?? null,
  print_language: edition.printLanguage ?? null,
  publisher: edition.publisher,
  publication_date: edition.publicationDate,
  cover_date: edition.coverDate ?? null,
  description: edition.description,
  page_count: edition.pageCount,
  format: edition.format ?? 'unknown',
  cover_image_url: edition.coverImageUrl,
  source: edition.source ?? 'gcd',
  source_external_id: edition.sourceExternalId,
  source_series_id: edition.sourceSeriesId ?? null,
  isbn: edition.isbn ?? null,
  source_payload: edition.rawSourcePayload ?? null,
})

export const findCollectedEditionDuplicate = async ({ sourceExternalId, isbn }) => {
  const matchClauses = []
  if (sourceExternalId) {
    matchClauses.push(`source_external_id.eq.${sourceExternalId}`)
  }
  if (isbn) {
    matchClauses.push(`isbn.eq.${isbn}`)
  }

  if (!matchClauses.length) {
    return null
  }

  // Prefer earliest match to keep duplicate handling deterministic in CLI flows.
  const { data, error } = await supabaseServiceClient
    .from('collected_editions')
    .select('id, hero_api_id, title, source, source_external_id, source_series_id, isbn, created_at')
    .or(matchClauses.join(','))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check collected edition duplicates: ${error.message}`)
  }

  return data ?? null
}

export const insertCollectedEdition = async ({ heroApiId, edition }) => {
  const payload = buildCollectedEditionPayload({ heroApiId, edition })
  const { data, error } = await supabaseServiceClient
    .from('collected_editions')
    .insert(payload)
    .select(
      'id, hero_api_id, title, print_language, source, source_external_id, source_series_id, isbn, created_at'
    )
    .single()

  if (error) {
    throw new Error(`Failed to insert collected edition: ${error.message}`)
  }

  return data
}

export const searchCollectedEditionsByTitle = async ({ query, limit = 10 } = {}) => {
  const normalized = escapeIlike(query)
  if (!normalized) return []
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 50) : 10

  const { data, error } = await supabaseServiceClient
    .from('collected_editions')
    .select('id, hero_api_id, title, isbn, source_external_id, created_at')
    .ilike('title', `%${normalized}%`)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) {
    throw new Error(`Failed to search collected editions by title: ${error.message}`)
  }

  return data ?? []
}

export const getCollectedEditionById = async (id) => {
  const normalized = String(id ?? '').trim()
  if (!normalized) {
    throw new Error('Collected edition id is required.')
  }

  const { data, error } = await supabaseServiceClient
    .from('collected_editions')
    .select('id, hero_api_id, title, print_language, source, source_external_id, source_series_id, isbn, cover_image_url, created_at')
    .eq('id', normalized)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load collected edition: ${error.message}`)
  }
  return data ?? null
}

export const updateCollectedEditionCoverImageUrl = async ({ collectedEditionId, coverImageUrl }) => {
  const id = String(collectedEditionId ?? '').trim()
  if (!id) {
    throw new Error('collectedEditionId is required.')
  }
  const normalizedUrl = String(coverImageUrl ?? '').trim()
  if (!normalizedUrl) {
    throw new Error('coverImageUrl is required.')
  }

  const { data, error } = await supabaseServiceClient
    .from('collected_editions')
    .update({ cover_image_url: normalizedUrl })
    .eq('id', id)
    .select('id, title, cover_image_url')
    .single()

  if (error) {
    throw new Error(`Failed to update collected edition cover image URL: ${error.message}`)
  }

  return data
}

export const getHeroIssuesByGcdIssueIds = async ({ heroApiId, gcdIssueIds }) => {
  if (!heroApiId || !Array.isArray(gcdIssueIds) || !gcdIssueIds.length) {
    return []
  }

  const normalized = Array.from(
    new Set(
      gcdIssueIds
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 0)
    )
  )
  if (!normalized.length) return []

  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('id, hero_api_id, gcd_issue_id, series_name, number, title')
    .eq('hero_api_id', heroApiId)
    .in('gcd_issue_id', normalized)

  if (error) {
    throw new Error(`Failed to load hero issues by gcd_issue_id: ${error.message}`)
  }

  return data ?? []
}

export const getHeroIssuesForHero = async ({ heroApiId }) => {
  if (!heroApiId) return []
  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('id, hero_api_id, gcd_issue_id, series_name, number, title')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero issues: ${error.message}`)
  }
  return data ?? []
}

export const getExistingCollectedEditionLinks = async ({ collectedEditionId, heroIssueIds }) => {
  if (!collectedEditionId || !Array.isArray(heroIssueIds) || !heroIssueIds.length) {
    return new Set()
  }

  const { data, error } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select('hero_issue_id')
    .eq('collected_edition_id', collectedEditionId)
    .in('hero_issue_id', heroIssueIds)

  if (error) {
    throw new Error(`Failed to load existing collected-edition links: ${error.message}`)
  }

  return new Set((data ?? []).map((item) => item.hero_issue_id))
}

export const insertCollectedEditionIssueLinks = async ({ collectedEditionId, heroIssueIds, notes = null }) => {
  if (!collectedEditionId || !Array.isArray(heroIssueIds) || !heroIssueIds.length) {
    return []
  }

  const payload = heroIssueIds.map((heroIssueId) => ({
    collected_edition_id: collectedEditionId,
    hero_issue_id: heroIssueId,
    notes: notes ?? null,
  }))

  const { data, error } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .upsert(payload, { onConflict: 'collected_edition_id,hero_issue_id', ignoreDuplicates: true })
    .select('id, collected_edition_id, hero_issue_id, created_at')

  if (error) {
    throw new Error(`Failed to insert collected-edition links: ${error.message}`)
  }

  return data ?? []
}
