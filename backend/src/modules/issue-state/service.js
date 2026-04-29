/**
 * Servei de persistència i regles de negoci per als estats d'issues d'un usuari.
 *
 * Responsabilitats principals:
 * - Gestionar els flags `en possessió` (`have_it`) i `llegit` (`read_it`).
 * - Mantenir la relació entre una issue i els recopilatoris que l'usuari declara tenir.
 * - Propagar la possessió quan es marca un recopilatori, aplicant-la als números que conté.
 * - Retornar estats normalitzats per al frontend amb un format estable.
 */

import { supabaseServiceClient } from '../../lib/supabaseClient.js'

const ISSUE_STATES_TABLE = 'user_issue_states'
const ISSUE_COLLECTED_EDITIONS_TABLE = 'user_issue_collected_editions'

const isMissingRelationError = (error) => {
  const code = error?.code ?? ''
  const message = String(error?.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('could not find the table') ||
    message.includes('schema cache') ||
    message.includes('user_issue_collected_editions')
  )
}

const mapStateRow = (row, collectedEditionIds = []) => ({
  issueId: row.issue_id,
  haveIt: Boolean(row.have_it),
  readIt: Boolean(row.read_it),
  collectedEditionIds: Array.isArray(collectedEditionIds) ? collectedEditionIds : [],
  updatedAt: row.updated_at ?? null,
})

const resolveGcdIssueIdFromMetadata = (metadata = {}) => {
  const value = metadata.gcdIssueId ?? metadata.gcd_issue_id
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

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

/**
 * Retorna els identificadors de totes les issues de cronologia d'un personatge.
 *
 * @param {number} heroApiId Identificador API del personatge.
 * @returns {Promise<string[]>} Llista d'UUIDs de `hero_timelines.id`.
 */

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
    .select('id, hero_api_id, metadata')
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

  return data
}

const getCollectedEditionSelectionsByIssueIds = async ({ userId, issueIds }) => {
  if (!userId || !issueIds?.length) return new Map()

  const { data, error } = await supabaseServiceClient
    .from(ISSUE_COLLECTED_EDITIONS_TABLE)
    .select('issue_id, collected_edition_id')
    .eq('user_id', userId)
    .in('issue_id', issueIds)

  if (error) {
    if (isMissingRelationError(error)) {
      // Backward compatibility for environments where the ownership table
      // has not been migrated yet.
      return new Map()
    }
    throw new Error(`Failed to load collected-edition selections: ${error.message}`)
  }

  const index = new Map()
  for (const row of data ?? []) {
    if (!row?.issue_id || !row?.collected_edition_id) continue
    if (!index.has(row.issue_id)) {
      index.set(row.issue_id, [])
    }
    index.get(row.issue_id).push(row.collected_edition_id)
  }
  return index
}

const getCollectedEditionSelectionsForIssue = async ({ userId, issueId }) => {
  const map = await getCollectedEditionSelectionsByIssueIds({ userId, issueIds: [issueId] })
  return map.get(issueId) ?? []
}

const resolveHeroIssueIdForTimelineIssue = async (timelineIssue) => {
  const gcdIssueId = resolveGcdIssueIdFromMetadata(timelineIssue?.metadata ?? {})
  if (!gcdIssueId || !timelineIssue?.hero_api_id) return null

  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('id')
    .eq('hero_api_id', timelineIssue.hero_api_id)
    .eq('gcd_issue_id', gcdIssueId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve hero issue for collected-edition ownership: ${error.message}`)
  }

  return data?.id ?? null
}

const validateCollectedEditionOwnershipSelection = async ({ heroIssueId, collectedEditionIds }) => {
  if (!collectedEditionIds?.length) return []
  if (!heroIssueId) {
    throw new Error('This issue has no linked collected editions to select.')
  }

  const uniqueIds = Array.from(new Set(collectedEditionIds))

  const { data, error } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select('collected_edition_id')
    .eq('hero_issue_id', heroIssueId)
    .in('collected_edition_id', uniqueIds)

  if (error) {
    throw new Error(`Failed to validate collected-edition ownership: ${error.message}`)
  }

  const allowed = new Set((data ?? []).map((row) => row.collected_edition_id))
  const invalid = uniqueIds.filter((id) => !allowed.has(id))
  if (invalid.length) {
    throw new Error('One or more selected collected editions are not linked to this issue.')
  }

  return uniqueIds
}

const syncCollectedEditionSelections = async ({ userId, issueId, collectedEditionIds }) => {
  if (!userId || !issueId) return
  const nextIds = Array.from(new Set(collectedEditionIds ?? []))

  const { error: deleteError } = await supabaseServiceClient
    .from(ISSUE_COLLECTED_EDITIONS_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('issue_id', issueId)

  if (deleteError) {
    if (isMissingRelationError(deleteError)) {
      return
    }
    throw new Error(`Failed to clear previous collected-edition selections: ${deleteError.message}`)
  }

  if (!nextIds.length) return

  const payload = nextIds.map((collectedEditionId) => ({
    user_id: userId,
    issue_id: issueId,
    collected_edition_id: collectedEditionId,
  }))

  const { error: insertError } = await supabaseServiceClient
    .from(ISSUE_COLLECTED_EDITIONS_TABLE)
    .insert(payload)

  if (insertError) {
    if (isMissingRelationError(insertError)) {
      return
    }
    throw new Error(`Failed to save collected-edition selections: ${insertError.message}`)
  }
}

const mapHeroIssueIdsToTimelineIssueIds = async ({ heroApiId, heroIssueIds }) => {
  if (!heroApiId || !heroIssueIds?.length) return new Map()

  const { data: heroIssueRows, error: heroIssueError } = await supabaseServiceClient
    .from('hero_issues')
    .select('id, gcd_issue_id')
    .eq('hero_api_id', heroApiId)
    .in('id', heroIssueIds)

  if (heroIssueError) {
    throw new Error(`Failed to load hero issues for ownership propagation: ${heroIssueError.message}`)
  }

  const { data: timelineRows, error: timelineError } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)

  if (timelineError) {
    throw new Error(`Failed to load timeline issues for ownership propagation: ${timelineError.message}`)
  }

  const timelineIssueIdByGcdIssueId = new Map()
  for (const row of timelineRows ?? []) {
    const gcdIssueId = resolveGcdIssueIdFromMetadata(row?.metadata ?? {})
    if (!gcdIssueId || timelineIssueIdByGcdIssueId.has(gcdIssueId)) continue
    timelineIssueIdByGcdIssueId.set(gcdIssueId, row.id)
  }

  const timelineIssueIdByHeroIssueId = new Map()
  for (const heroIssue of heroIssueRows ?? []) {
    const timelineIssueId = timelineIssueIdByGcdIssueId.get(heroIssue.gcd_issue_id)
    if (!timelineIssueId) continue
    timelineIssueIdByHeroIssueId.set(heroIssue.id, timelineIssueId)
  }

  return timelineIssueIdByHeroIssueId
}

const propagateHaveItForCollectedEditions = async ({ userId, heroApiId, collectedEditionIds }) => {
  if (!userId || !heroApiId || !collectedEditionIds?.length) return []

  const uniqueCollectedEditionIds = Array.from(new Set(collectedEditionIds))

  const { data: linkRows, error: linksError } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select('collected_edition_id, hero_issue_id')
    .in('collected_edition_id', uniqueCollectedEditionIds)

  if (linksError) {
    throw new Error(`Failed to load collected-edition links for ownership propagation: ${linksError.message}`)
  }

  const links = linkRows ?? []
  if (!links.length) return []

  const heroIssueIds = Array.from(new Set(links.map((row) => row.hero_issue_id).filter(Boolean)))
  const timelineIssueIdByHeroIssueId = await mapHeroIssueIdsToTimelineIssueIds({ heroApiId, heroIssueIds })

  const timelineIssueIdsByEditionId = new Map()
  for (const link of links) {
    const timelineIssueId = timelineIssueIdByHeroIssueId.get(link.hero_issue_id)
    if (!timelineIssueId) continue
    if (!timelineIssueIdsByEditionId.has(link.collected_edition_id)) {
      timelineIssueIdsByEditionId.set(link.collected_edition_id, new Set())
    }
    timelineIssueIdsByEditionId.get(link.collected_edition_id).add(timelineIssueId)
  }

  const affectedIssueIds = Array.from(
    new Set(
      Array.from(timelineIssueIdsByEditionId.values()).flatMap((issueSet) => Array.from(issueSet))
    )
  )
  if (!affectedIssueIds.length) return []

  const { data: existingRows, error: existingError } = await supabaseServiceClient
    .from(ISSUE_STATES_TABLE)
    .select('issue_id, read_it')
    .eq('user_id', userId)
    .in('issue_id', affectedIssueIds)

  if (existingError) {
    throw new Error(`Failed to load existing ownership states for propagation: ${existingError.message}`)
  }

  const existingReadByIssueId = new Map((existingRows ?? []).map((row) => [row.issue_id, Boolean(row.read_it)]))
  const timestamp = new Date().toISOString()

  const statePayload = affectedIssueIds.map((affectedIssueId) => ({
    user_id: userId,
    issue_id: affectedIssueId,
    have_it: true,
    read_it: existingReadByIssueId.get(affectedIssueId) ?? false,
    updated_at: timestamp,
  }))

  const { error: upsertStatesError } = await supabaseServiceClient
    .from(ISSUE_STATES_TABLE)
    .upsert(statePayload, { onConflict: 'user_id,issue_id' })

  if (upsertStatesError) {
    throw new Error(`Failed to propagate ownership states: ${upsertStatesError.message}`)
  }

  const ownershipPayload = []
  for (const collectedEditionId of uniqueCollectedEditionIds) {
    const issueSet = timelineIssueIdsByEditionId.get(collectedEditionId)
    if (!issueSet?.size) continue
    for (const timelineIssueId of issueSet) {
      ownershipPayload.push({
        user_id: userId,
        issue_id: timelineIssueId,
        collected_edition_id: collectedEditionId,
      })
    }
  }

  if (ownershipPayload.length) {
    const { error: ownershipError } = await supabaseServiceClient
      .from(ISSUE_COLLECTED_EDITIONS_TABLE)
      .upsert(ownershipPayload, {
        onConflict: 'user_id,issue_id,collected_edition_id',
        ignoreDuplicates: true,
      })

    if (ownershipError) {
      if (isMissingRelationError(ownershipError)) {
        return affectedIssueIds
      }
      throw new Error(`Failed to propagate collected-edition ownership links: ${ownershipError.message}`)
    }
  }

  return affectedIssueIds
}

/**
 * Llegeix els estats d'issues d'un usuari per una llista concreta d'issues.
 *
 * A més dels flags d'estat, també resol els recopilatoris seleccionats per cada issue.
 *
 * @param {{ userId: string, issueIds: string[] }} params
 * @returns {Promise<Array<{issueId:string,haveIt:boolean,readIt:boolean,collectedEditionIds:string[],updatedAt:string|null}>>}
 */

export const getUserIssueStatesByIssueIds = async ({ userId, issueIds }) => {
  if (!issueIds?.length) {
    return []
  }

  const [stateResult, ownershipSelections] = await Promise.all([
    supabaseServiceClient
      .from(ISSUE_STATES_TABLE)
      .select('issue_id, have_it, read_it, updated_at')
      .eq('user_id', userId)
      .in('issue_id', issueIds),
    getCollectedEditionSelectionsByIssueIds({ userId, issueIds }),
  ])

  if (stateResult.error) {
    throw new Error(`Failed to load issue states: ${stateResult.error.message}`)
  }

  return (stateResult.data ?? []).map((row) =>
    mapStateRow(row, ownershipSelections.get(row.issue_id) ?? [])
  )
}

/**
 * Aplica un patch d'estat sobre una issue i retorna l'estat final consolidat.
 *
 * Regles clau:
 * - Si `haveIt=false` i `readIt=false`, s'elimina el registre (estat buit).
 * - Si arriben `collectedEditionIds`, es validen contra els recopilatoris enllaçats a la issue.
 * - Si es marca `haveIt=true` amb recopilatoris, es propaga la possessió als números continguts.
 *
 * @param {{ userId: string, issueId: string, patch: { haveIt?: boolean, readIt?: boolean, collectedEditionIds?: string[] } }} params
 * @returns {Promise<{issueId:string,haveIt:boolean,readIt:boolean,collectedEditionIds:string[],updatedAt:string|null,propagatedIssueIds:string[]}>}
 */

export const applyIssueStatePatch = async ({ userId, issueId, patch }) => {
  const timelineIssue = await ensureIssueExists(issueId)
  const existing = await fetchUserIssueStateRecord(userId, issueId)
  const existingCollectedEditionIds = await getCollectedEditionSelectionsForIssue({ userId, issueId })

  const currentHaveIt = existing?.have_it ?? false
  const currentReadIt = existing?.read_it ?? false

  const nextHaveIt = patch.haveIt ?? currentHaveIt
  const nextReadIt = patch.readIt ?? currentReadIt
  const incomingCollectedEditionIds = Array.isArray(patch.collectedEditionIds) ? patch.collectedEditionIds : undefined

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
    await syncCollectedEditionSelections({ userId, issueId, collectedEditionIds: [] })
    return { issueId, haveIt: false, readIt: false, collectedEditionIds: [], updatedAt: null }
  }

  let nextCollectedEditionIds = []
  if (nextHaveIt) {
    if (incomingCollectedEditionIds !== undefined) {
      const heroIssueId = await resolveHeroIssueIdForTimelineIssue(timelineIssue)
      nextCollectedEditionIds = await validateCollectedEditionOwnershipSelection({
        heroIssueId,
        collectedEditionIds: incomingCollectedEditionIds,
      })
    } else {
      nextCollectedEditionIds = existingCollectedEditionIds
    }
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

  // Avoid touching collected-edition ownership links on read-only toggles.
  // We only sync when ownership changes or when an explicit selection payload arrives.
  const shouldSyncCollectedSelections =
    nextHaveIt || incomingCollectedEditionIds !== undefined || patch.haveIt === false

  if (shouldSyncCollectedSelections) {
    await syncCollectedEditionSelections({
      userId,
      issueId,
      collectedEditionIds: nextHaveIt ? nextCollectedEditionIds : [],
    })
  }

  let propagatedIssueIds = []
  if (patch.haveIt === true && incomingCollectedEditionIds !== undefined && nextCollectedEditionIds.length) {
    propagatedIssueIds = await propagateHaveItForCollectedEditions({
      userId,
      heroApiId: timelineIssue.hero_api_id,
      collectedEditionIds: nextCollectedEditionIds,
    })
  }

  return {
    ...mapStateRow(data, nextHaveIt ? nextCollectedEditionIds : []),
    propagatedIssueIds,
  }
}

/**
 * Marca com a `llegit` totes les issues d'una etapa de cronologia.
 *
 * Aquest procés preserva el valor de `haveIt` existent per cada issue.
 *
 * @param {{ userId: string, heroApiId: number, stageKey: string }} params
 * @returns {Promise<{stageKey:string, issueIds:string[], states:Array}>}
 */

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

  const selectedEditionIdsByIssueId = await getCollectedEditionSelectionsByIssueIds({
    userId,
    issueIds,
  })

  return {
    stageKey: normalizedStageKey,
    issueIds,
    states: (data ?? []).map((row) =>
      mapStateRow(row, selectedEditionIdsByIssueId.get(row.issue_id) ?? [])
    ),
  }
}
