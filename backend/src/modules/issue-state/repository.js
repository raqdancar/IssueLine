// Gestiona la persistencia de l'estat de col-leccio dels issues.
import { supabaseServiceClient } from '../../lib/supabaseClient.js'

export const ISSUE_STATES_TABLE = 'user_issue_states'
export const ISSUE_COLLECTED_EDITIONS_TABLE = 'user_issue_collected_editions'

const throwSupabaseError = (message, error) => {
  if (error) {
    throw new Error(`${message}: ${error.message}`)
  }
}

export const listTimelineRowsForHero = async (heroApiId, select = 'id, metadata') => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select(select)
    .eq('hero_api_id', heroApiId)

  throwSupabaseError('Failed to load hero timeline entries', error)
  return data ?? []
}

export const listTimelineIssueIdsForHero = async (heroApiId) => {
  const rows = await listTimelineRowsForHero(heroApiId, 'id')
  return rows.map((entry) => entry.id)
}

export const findUserIssueStateRecord = async ({ userId, issueId }) => {
  const { data, error } = await supabaseServiceClient
    .from(ISSUE_STATES_TABLE)
    .select('id, have_it, read_it')
    .eq('user_id', userId)
    .eq('issue_id', issueId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load existing issue state: ${error.message}`)
  }

  return data ?? null
}

export const findTimelineIssue = async (issueId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, hero_api_id, metadata')
    .eq('id', issueId)
    .maybeSingle()

  throwSupabaseError('Failed to verify hero timeline issue', error)
  return data ?? null
}

export const listCollectedEditionSelections = async ({ userId, issueIds }) => {
  const { data, error } = await supabaseServiceClient
    .from(ISSUE_COLLECTED_EDITIONS_TABLE)
    .select('issue_id, collected_edition_id')
    .eq('user_id', userId)
    .in('issue_id', issueIds)

  return { data: data ?? [], error }
}

export const deleteCollectedEditionSelectionsForIssue = async ({ userId, issueId }) => {
  const { error } = await supabaseServiceClient
    .from(ISSUE_COLLECTED_EDITIONS_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('issue_id', issueId)

  return { error }
}

export const insertCollectedEditionSelections = async (payload) => {
  const { error } = await supabaseServiceClient
    .from(ISSUE_COLLECTED_EDITIONS_TABLE)
    .insert(payload)

  return { error }
}

export const listIssueStates = async ({ userId, issueIds }) => {
  const { data, error } = await supabaseServiceClient
    .from(ISSUE_STATES_TABLE)
    .select('issue_id, have_it, read_it, updated_at')
    .eq('user_id', userId)
    .in('issue_id', issueIds)

  throwSupabaseError('Failed to load issue states', error)
  return data ?? []
}
