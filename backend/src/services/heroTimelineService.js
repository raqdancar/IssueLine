import { supabaseServiceClient } from './supabaseClient.js'

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
    .select('id, issue_date, headline, summary, issue_code, source_url, severity, metadata, created_at')
    .eq('hero_api_id', heroApiId)
    .order('issue_date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch timeline entries: ${error.message}`)
  }

  return data ?? []
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
  const normalizedDate = new Date(issueDate).toISOString().slice(0, 10)

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
