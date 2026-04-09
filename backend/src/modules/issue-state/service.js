import { supabaseServiceClient } from '../../lib/supabaseClient.js'

const ISSUE_STATES_TABLE = 'user_issue_states'

const mapStateRow = (row) => ({
  issueId: row.issue_id,
  haveIt: Boolean(row.have_it),
  readIt: Boolean(row.read_it),
  updatedAt: row.updated_at ?? null,
})

export const getHeroTimelineIssueIds = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero timeline entries: ${error.message}`)
  }

  return (data ?? []).map((entry) => entry.id)
}

const fetchUserIssueStateRecord = async (userId, issueId) => {
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

const ensureIssueExists = async (issueId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id')
    .eq('id', issueId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify hero timeline issue: ${error.message}`)
  }
  if (!data) {
    const err = new Error(`Hero timeline issue "${issueId}" was not found.`)
    err.statusCode = 404
    throw err
  }
}

export const getUserIssueStatesByIssueIds = async ({ userId, issueIds }) => {
  if (!issueIds?.length) {
    return []
  }

  const { data, error } = await supabaseServiceClient
    .from(ISSUE_STATES_TABLE)
    .select('issue_id, have_it, read_it, updated_at')
    .eq('user_id', userId)
    .in('issue_id', issueIds)

  if (error) {
    throw new Error(`Failed to load issue states: ${error.message}`)
  }

  return (data ?? []).map(mapStateRow)
}

export const applyIssueStatePatch = async ({ userId, issueId, patch }) => {
  await ensureIssueExists(issueId)
  const existing = await fetchUserIssueStateRecord(userId, issueId)

  const currentHaveIt = existing?.have_it ?? false
  const currentReadIt = existing?.read_it ?? false

  const nextHaveIt = patch.haveIt ?? currentHaveIt
  const nextReadIt = patch.readIt ?? currentReadIt

  if (!nextHaveIt && !nextReadIt) {
    if (existing) {
      const { error: deleteError } = await supabaseServiceClient
        .from(ISSUE_STATES_TABLE)
        .delete()
        .eq('id', existing.id)
      if (deleteError) {
        throw new Error(`Failed to delete issue state: ${deleteError.message}`)
      }
    }
    return { issueId, haveIt: false, readIt: false, updatedAt: null }
  }

  const payload = {
    user_id: userId,
    issue_id: issueId,
    have_it: nextHaveIt,
    read_it: nextReadIt,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseServiceClient
    .from(ISSUE_STATES_TABLE)
    .upsert(payload, { onConflict: 'user_id,issue_id' })
    .select('issue_id, have_it, read_it, updated_at')
    .single()

  if (error) {
    throw new Error(`Failed to save issue state: ${error.message}`)
  }

  return mapStateRow(data)
}
