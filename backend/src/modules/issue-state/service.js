import { supabaseServiceClient } from '../../lib/supabaseClient.js'

const ISSUE_STATES_TABLE = 'user_issue_states'

const mapStateRow = (row) => ({
  issueId: row.issue_id,
  haveIt: Boolean(row.have_it),
  readIt: Boolean(row.read_it),
  updatedAt: row.updated_at ?? null,
})

const resolveStageKey = (metadata = {}) => {
  const rawStage =
    metadata.stage_name ??
    metadata.stageName ??
    metadata.stage?.name ??
    metadata.stage?.label ??
    null

  if (!rawStage || typeof rawStage !== 'string') {
    return null
  }

  const normalized = rawStage.trim().toLowerCase()
  return normalized || null
}

const fetchHeroTimelineStageMap = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero timeline entries: ${error.message}`)
  }

  const stageIndex = new Map()
  for (const entry of data ?? []) {
    const stageKey = resolveStageKey(entry.metadata)
    if (!stageKey) continue
    if (!stageIndex.has(stageKey)) {
      stageIndex.set(stageKey, [])
    }
    stageIndex.get(stageKey).push(entry.id)
  }

  return stageIndex
}

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

export const markStageIssuesAsRead = async ({ userId, heroApiId, stageKey }) => {
  if (!userId) {
    throw new Error('User is required to update issue states.')
  }
  if (!heroApiId) {
    throw new Error('heroApiId is required to mark stage issues.')
  }
  const normalizedStageKey = typeof stageKey === 'string' ? stageKey.trim().toLowerCase() : null
  if (!normalizedStageKey) {
    throw new Error('stageKey is required to mark stage issues.')
  }

  const stageMap = await fetchHeroTimelineStageMap(heroApiId)
  const issueIds = stageMap.get(normalizedStageKey) ?? []

  if (!issueIds.length) {
    const error = new Error(`Stage "${stageKey}" has no tracked issues.`)
    error.statusCode = 404
    throw error
  }

  const existingStates = await getUserIssueStatesByIssueIds({ userId, issueIds })
  const existingIndex = new Map(existingStates.map((state) => [state.issueId, state]))
  const timestamp = new Date().toISOString()

  const payload = issueIds.map((issueId) => {
    const existing = existingIndex.get(issueId)
    return {
      user_id: userId,
      issue_id: issueId,
      have_it: existing?.haveIt ?? false,
      read_it: true,
      updated_at: timestamp,
    }
  })

  const { data, error } = await supabaseServiceClient
    .from(ISSUE_STATES_TABLE)
    .upsert(payload, { onConflict: 'user_id,issue_id' })
    .select('issue_id, have_it, read_it, updated_at')

  if (error) {
    throw new Error(`Failed to mark stage issues as read: ${error.message}`)
  }

  return {
    stageKey: normalizedStageKey,
    issueIds,
    states: (data ?? []).map(mapStateRow),
  }
}
