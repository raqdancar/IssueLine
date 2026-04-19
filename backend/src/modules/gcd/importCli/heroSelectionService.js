import { supabaseServiceClient } from '../../../lib/supabaseClient.js'

const DEFAULT_LIMIT = 20

/**
 * Lists heroes from Supabase with optional search by name/slug.
 */
export const searchHeroes = async ({ query = '', limit = DEFAULT_LIMIT } = {}) => {
  const normalizedLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 50) : DEFAULT_LIMIT
  let statement = supabaseServiceClient
    .from('superheroes')
    .select('api_id, name, slug, publisher')
    .order('name', { ascending: true })
    .limit(normalizedLimit)

  const normalizedQuery = String(query ?? '').trim()
  if (normalizedQuery) {
    const escaped = normalizedQuery.replace(/,/g, '')
    statement = statement.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`)
  }

  const { data, error } = await statement
  if (error) {
    throw new Error(`Failed to search heroes: ${error.message}`)
  }

  return data ?? []
}

/**
 * Resolves a hero by api_id.
 */
export const getHeroByApiId = async (heroApiId) => {
  const numeric = Number(heroApiId)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error('heroApiId must be a positive integer.')
  }

  const { data, error } = await supabaseServiceClient
    .from('superheroes')
    .select('api_id, name, slug, publisher')
    .eq('api_id', numeric)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve hero by api_id: ${error.message}`)
  }
  if (!data) {
    throw new Error(`No hero found for api_id=${numeric}.`)
  }
  return data
}

/**
 * Resolves a hero by slug.
 */
export const getHeroBySlug = async (heroSlug) => {
  const normalized = String(heroSlug ?? '').trim().toLowerCase()
  if (!normalized) {
    throw new Error('heroSlug is required.')
  }

  const { data, error } = await supabaseServiceClient
    .from('superheroes')
    .select('api_id, name, slug, publisher')
    .eq('slug', normalized)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve hero by slug: ${error.message}`)
  }
  if (!data) {
    throw new Error(`No hero found for slug "${normalized}".`)
  }
  return data
}

