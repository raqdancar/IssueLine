// Gestiona la persistencia de l'estat de col-leccio dels issues.
import { supabaseServiceClient } from '../../lib/supabaseClient.js'

export const ISSUE_STATES_TABLE = 'user_issue_states'
export const ISSUE_COLLECTED_EDITIONS_TABLE = 'user_issue_collected_editions'
const ISSUE_ID_FILTER_BATCH_SIZE = 200

const throwSupabaseError = (message, error) => {
  if (error) {
    throw new Error(`${message}: ${error.message}`)
  }
}

const listRowsByIssueIds = async ({ table, select, userId, issueIds }) => {
  const uniqueIssueIds = Array.from(new Set(issueIds ?? []))
  if (!uniqueIssueIds.length) {
    return { data: [], error: null }
  }

  const batches = []
  for (let index = 0; index < uniqueIssueIds.length; index += ISSUE_ID_FILTER_BATCH_SIZE) {
    batches.push(uniqueIssueIds.slice(index, index + ISSUE_ID_FILTER_BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map((batch) =>
      supabaseServiceClient
        .from(table)
        .select(select)
        .eq('user_id', userId)
        .in('issue_id', batch)
    )
  )

  const error = results.find((result) => result.error)?.error ?? null
  return {
    data: results.flatMap((result) => result.data ?? []),
    error,
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
    .select('id, hero_api_id, hero_issue_id, metadata')
    .eq('id', issueId)
    .maybeSingle()

  throwSupabaseError('Failed to verify hero timeline issue', error)
  return data ?? null
}

export const listCollectedEditionSelections = async ({ userId, issueIds }) => {
  return listRowsByIssueIds({
    table: ISSUE_COLLECTED_EDITIONS_TABLE,
    select: 'issue_id, collected_edition_id',
    userId,
    issueIds,
  })
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
  const { data, error } = await listRowsByIssueIds({
    table: ISSUE_STATES_TABLE,
    select: 'issue_id, have_it, read_it, updated_at',
    userId,
    issueIds,
  })

  throwSupabaseError('Failed to load issue states', error)
  return data ?? []
}
