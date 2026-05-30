// Gestiona dades de personatges, imatges i cronologies dins del backend.
import { supabaseServiceClient } from '../../lib/supabaseClient.js'

const throwSupabaseError = (message, error) => {
  if (error) {
    throw new Error(`${message}: ${error.message}`)
  }
}

export const findHeroBySlug = async (slug) => {
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

  throwSupabaseError('Failed to fetch hero by slug', error)
  return data ?? null
}

export const listTimelineEntries = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, issue_date, headline, summary, issue_code, source_url, severity, metadata, stage_id, legacy_number, special_issue, created_at')
    .eq('hero_api_id', heroApiId)
    .order('issue_date', { ascending: true })

  throwSupabaseError('Failed to fetch timeline entries', error)
  return data ?? []
}

export const listTimelineMetadataRows = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata, stage_id')
    .eq('hero_api_id', heroApiId)

  throwSupabaseError('Failed to load timeline metadata', error)
  return data ?? []
}

export const listStageRowsByIds = async (stageIds) => {
  if (!stageIds?.length) return []

  const { data, error } = await supabaseServiceClient
    .from('hero_issue_stages')
    .select('*')
    .in('id', stageIds)

  throwSupabaseError('Failed to load hero issue stages', error)
  return data ?? []
}

export const listStageRowsById = async (stageId) => {
  if (!stageId) return []

  const { data, error } = await supabaseServiceClient
    .from('hero_issue_stages')
    .select('*')
    .eq('id', stageId)

  throwSupabaseError('Failed to load hero issue stage', error)
  return data ?? []
}

export const listCollectedEditionsByHero = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('collected_editions')
    .select('id, title, subtitle, print_language, publisher, publication_date, format, cover_image_url, source, source_external_id, source_series_id, isbn')
    .eq('hero_api_id', heroApiId)
    .order('publication_date', { ascending: true, nullsFirst: false })

  throwSupabaseError('Failed to load collected editions overview', error)
  return data ?? []
}

export const listCollectedEditionLinksByEditionIds = async (collectedEditionIds) => {
  if (!collectedEditionIds?.length) return []

  const { data, error } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select('collected_edition_id, hero_issue_id, notes')
    .in('collected_edition_id', collectedEditionIds)

  throwSupabaseError('Failed to load collected-edition links', error)
  return data ?? []
}

export const listCollectedEditionsForHeroIssue = async (heroIssueId) => {
  if (!heroIssueId) return []

  const { data, error } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select(
      'notes, collected_editions(id, title, subtitle, series_title, print_language, publisher, publication_date, format, cover_image_url, source, source_external_id, source_series_id, isbn)'
    )
    .eq('hero_issue_id', heroIssueId)

  throwSupabaseError('Failed to load collected editions for issue', error)
  return data ?? []
}

export const listHeroIssuesByIds = async ({ heroApiId, heroIssueIds }) => {
  if (!heroIssueIds?.length) return []

  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('id, gcd_issue_id, number, series_name, title')
    .eq('hero_api_id', heroApiId)
    .in('id', heroIssueIds)

  throwSupabaseError('Failed to load hero issues', error)
  return data ?? []
}

export const findTimelineEntryById = async ({ heroApiId, issueId }) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, hero_api_id, issue_date, headline, summary, issue_code, source_url, severity, metadata, stage_id, legacy_number, created_at, updated_at')
    .eq('hero_api_id', heroApiId)
    .eq('id', issueId)
    .limit(1)
    .maybeSingle()

  throwSupabaseError('Failed to load timeline issue detail', error)
  return data ?? null
}

export const findHeroIssueByGcdIssueId = async ({ heroApiId, gcdIssueId }) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select(
      'id, gcd_issue_id, series_id, series_name, number, volume, title, key_date, on_sale_date, publication_date, price, page_count, cover, cover_original, cover_image_path, raw'
    )
    .eq('hero_api_id', heroApiId)
    .eq('gcd_issue_id', gcdIssueId)
    .limit(1)
    .maybeSingle()

  throwSupabaseError('Failed to load cached issue metadata', error)
  return data ?? null
}

export const insertTimelineRow = async (payload) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .insert(payload)
    .select('*')
    .single()

  throwSupabaseError('Failed to create hero timeline entry', error)
  return data
}

export const insertTimelineRows = async (payload) => {
  const { data, error } = await supabaseServiceClient.from('hero_timelines').insert(payload).select('*')

  throwSupabaseError('Failed to create hero timeline entries', error)
  return data ?? []
}

export const updateTimelineRow = async ({ id, payload }) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  return { data: data ?? null, error }
}

export const deleteTimelineRowsByIds = async (ids) => {
  const { error, count } = await supabaseServiceClient
    .from('hero_timelines')
    .delete({ count: 'exact' })
    .in('id', ids)

  return { error, count }
}
