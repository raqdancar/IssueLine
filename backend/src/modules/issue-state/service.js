// Gestiona la persistencia de l'estat de col-leccio dels issues.
/**
 * Servei de persistÃ¨ncia i regles de negoci per als estats d'issues d'un usuari.
 *
 * Responsabilitats principals:
 * - Gestionar els flags `en possessiÃ³` (`have_it`) i `llegit` (`read_it`).
 * - Mantenir la relaciÃ³ entre una issue i els recopilatoris que l'usuari declara tenir.
 * - Propagar la possessiÃ³ quan es marca un recopilatori, aplicant-la als nÃºmeros que contÃ©.
 * - Retornar estats normalitzats per al frontend amb un format estable.
 */

import { supabaseServiceClient } from '../../lib/supabaseClient.js'
import {
  ISSUE_COLLECTED_EDITIONS_TABLE,
  ISSUE_STATES_TABLE,
  deleteCollectedEditionSelectionsForIssue,
  findTimelineIssue,
  findUserIssueStateRecord,
  insertCollectedEditionSelections,
  listCollectedEditionSelections,
  listIssueStates,
  listTimelineIssueIdsForHero,
  listTimelineRowsForHero,
} from './repository.js'

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
  const data = await listTimelineRowsForHero(heroApiId, 'id, metadata')

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
  return listTimelineIssueIdsForHero(heroApiId)
}

const fetchUserIssueStateRecord = async (userId, issueId) => {
  return findUserIssueStateRecord({ userId, issueId })
}

const ensureIssueExists = async (issueId) => {
  const data = await findTimelineIssue(issueId)
  if (!data) {
    const err = new Error(`Hero timeline issue "${issueId}" was not found.`)
    err.statusCode = 404
    throw err
  }

  return data
}

const getCollectedEditionSelectionsByIssueIds = async ({ userId, issueIds }) => {
  if (!userId || !issueIds?.length) return new Map()

  const { data, error } = await listCollectedEditionSelections({ userId, issueIds })

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
  if (timelineIssue?.hero_issue_id) return timelineIssue.hero_issue_id

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

  const { error: deleteError } = await deleteCollectedEditionSelectionsForIssue({ userId, issueId })

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

  const { error: insertError } = await insertCollectedEditionSelections(payload)

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

  const timelineRows = await listTimelineRowsForHero(heroApiId, 'id, hero_issue_id, metadata')

  const timelineIssueIdByHeroIssueId = new Map()
  const timelineIssueIdByGcdIssueId = new Map()
  for (const row of timelineRows ?? []) {
    if (row.hero_issue_id && !timelineIssueIdByHeroIssueId.has(row.hero_issue_id)) {
      timelineIssueIdByHeroIssueId.set(row.hero_issue_id, row.id)
    }
    const gcdIssueId = resolveGcdIssueIdFromMetadata(row?.metadata ?? {})
    if (!gcdIssueId || timelineIssueIdByGcdIssueId.has(gcdIssueId)) continue
    timelineIssueIdByGcdIssueId.set(gcdIssueId, row.id)
  }

  for (const heroIssue of heroIssueRows ?? []) {
    if (timelineIssueIdByHeroIssueId.has(heroIssue.id)) continue
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
 * A mÃ©s dels flags d'estat, tambÃ© resol els recopilatoris seleccionats per cada issue.
 *
 * @param {{ userId: string, issueIds: string[] }} params
 * @returns {Promise<Array<{issueId:string,haveIt:boolean,readIt:boolean,collectedEditionIds:string[],updatedAt:string|null}>>}
 */

export const getUserIssueStatesByIssueIds = async ({ userId, issueIds }) => {
  if (!issueIds?.length) {
    return []
  }

  const [stateRows, ownershipSelections] = await Promise.all([
    listIssueStates({ userId, issueIds }),
    getCollectedEditionSelectionsByIssueIds({ userId, issueIds }),
  ])

  return (stateRows ?? []).map((row) =>
    mapStateRow(row, ownershipSelections.get(row.issue_id) ?? [])
  )
}

/**
 * Aplica un patch d'estat sobre una issue i retorna l'estat final consolidat.
 *
 * Regles clau:
 * - Si `haveIt=false` i `readIt=false`, s'elimina el registre (estat buit).
 * - Si arriben `collectedEditionIds`, es validen contra els recopilatoris enllaÃ§ats a la issue.
 * - Si es marca `haveIt=true` amb recopilatoris, es propaga la possessiÃ³ als nÃºmeros continguts.
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
 * Aquest procÃ©s preserva el valor de `haveIt` existent per cada issue.
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

/**
 * Activa o desactiva la possessiÃ³ d'un recopilatori per a totes les issues vinculades.
 *
 * Aquesta operaciÃ³ es fa en bloc al backend per evitar tempestes de peticions
 * quan el frontend marca/desmarca omnibus amb moltes issues.
 *
 * @param {{ userId:string, heroApiId:number, collectedEditionId:string, haveIt:boolean }} params
 * @returns {Promise<{collectedEditionId:string,haveIt:boolean,issueIds:string[],states:Array}>}
 */
export const toggleCollectedEditionOwnership = async ({ userId, heroApiId, collectedEditionId, haveIt }) => {
  if (!userId) {
    throw new Error('User is required to update collected-edition ownership.')
  }
  if (!heroApiId) {
    throw new Error('heroApiId is required to update collected-edition ownership.')
  }
  if (!collectedEditionId) {
    throw new Error('collectedEditionId is required to update collected-edition ownership.')
  }

  const { data: linksRows, error: linksError } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select('hero_issue_id')
    .eq('collected_edition_id', collectedEditionId)

  if (linksError) {
    throw new Error(`Failed to load collected-edition links: ${linksError.message}`)
  }

  const heroIssueIds = Array.from(new Set((linksRows ?? []).map((row) => row.hero_issue_id).filter(Boolean)))
  if (!heroIssueIds.length) {
    return { collectedEditionId, haveIt, issueIds: [], states: [] }
  }

  const timelineIssueIdByHeroIssueId = await mapHeroIssueIdsToTimelineIssueIds({ heroApiId, heroIssueIds })
  const issueIds = Array.from(
    new Set(
      heroIssueIds
        .map((heroIssueId) => timelineIssueIdByHeroIssueId.get(heroIssueId))
        .filter(Boolean)
    )
  )

  if (!issueIds.length) {
    return { collectedEditionId, haveIt, issueIds: [], states: [] }
  }

  const currentStates = await getUserIssueStatesByIssueIds({ userId, issueIds })
  const stateByIssueId = new Map(currentStates.map((state) => [state.issueId, state]))
  const timestamp = new Date().toISOString()

  if (haveIt) {
    const statePayload = issueIds.map((issueId) => ({
      user_id: userId,
      issue_id: issueId,
      have_it: true,
      read_it: stateByIssueId.get(issueId)?.readIt ?? false,
      updated_at: timestamp,
    }))

    const { error: upsertStatesError } = await supabaseServiceClient
      .from(ISSUE_STATES_TABLE)
      .upsert(statePayload, { onConflict: 'user_id,issue_id' })

    if (upsertStatesError) {
      throw new Error(`Failed to save ownership states for collected edition: ${upsertStatesError.message}`)
    }

    const ownershipPayload = issueIds.map((issueId) => ({
      user_id: userId,
      issue_id: issueId,
      collected_edition_id: collectedEditionId,
    }))

    const { error: ownershipError } = await supabaseServiceClient
      .from(ISSUE_COLLECTED_EDITIONS_TABLE)
      .upsert(ownershipPayload, {
        onConflict: 'user_id,issue_id,collected_edition_id',
        ignoreDuplicates: true,
      })

    if (ownershipError && !isMissingRelationError(ownershipError)) {
      throw new Error(`Failed to save collected-edition ownership links: ${ownershipError.message}`)
    }
  } else {
    const { error: deleteOwnershipError } = await supabaseServiceClient
      .from(ISSUE_COLLECTED_EDITIONS_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('collected_edition_id', collectedEditionId)
      .in('issue_id', issueIds)

    if (deleteOwnershipError && !isMissingRelationError(deleteOwnershipError)) {
      throw new Error(`Failed to remove collected-edition ownership links: ${deleteOwnershipError.message}`)
    }

    const remainingSelections = await getCollectedEditionSelectionsByIssueIds({ userId, issueIds })
    const toDelete = []
    const toUpsert = []

    for (const issueId of issueIds) {
      const existingState = stateByIssueId.get(issueId)
      const nextHaveIt = (remainingSelections.get(issueId) ?? []).length > 0
      const nextReadIt = existingState?.readIt ?? false

      if (!nextHaveIt && !nextReadIt) {
        toDelete.push(issueId)
      } else {
        toUpsert.push({
          user_id: userId,
          issue_id: issueId,
          have_it: nextHaveIt,
          read_it: nextReadIt,
          updated_at: timestamp,
        })
      }
    }

    if (toDelete.length) {
      const { error: deleteStatesError } = await supabaseServiceClient
        .from(ISSUE_STATES_TABLE)
        .delete()
        .eq('user_id', userId)
        .in('issue_id', toDelete)

      if (deleteStatesError) {
        throw new Error(`Failed to clear issue states for collected edition: ${deleteStatesError.message}`)
      }
    }

    if (toUpsert.length) {
      const { error: upsertStatesError } = await supabaseServiceClient
        .from(ISSUE_STATES_TABLE)
        .upsert(toUpsert, { onConflict: 'user_id,issue_id' })

      if (upsertStatesError) {
        throw new Error(`Failed to update issue states for collected edition: ${upsertStatesError.message}`)
      }
    }
  }

  const states = await getUserIssueStatesByIssueIds({ userId, issueIds })
  return { collectedEditionId, haveIt, issueIds, states }
}

/**
 * Activa o desactiva la lectura d'un recopilatori per a totes les issues vinculades.
 *
 * A diferÃ¨ncia de la possessiÃ³, aquesta operaciÃ³ no modifica els enllaÃ§os de
 * recopilatoris seleccionats; nomÃ©s propaga `read_it` conservant `have_it`.
 *
 * @param {{ userId:string, heroApiId:number, collectedEditionId:string, readIt:boolean }} params
 * @returns {Promise<{collectedEditionId:string,readIt:boolean,issueIds:string[],states:Array}>}
 */
export const toggleCollectedEditionReadStatus = async ({ userId, heroApiId, collectedEditionId, readIt }) => {
  if (!userId) {
    throw new Error('User is required to update collected-edition reading state.')
  }
  if (!heroApiId) {
    throw new Error('heroApiId is required to update collected-edition reading state.')
  }
  if (!collectedEditionId) {
    throw new Error('collectedEditionId is required to update collected-edition reading state.')
  }

  const { data: linksRows, error: linksError } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select('hero_issue_id')
    .eq('collected_edition_id', collectedEditionId)

  if (linksError) {
    throw new Error(`Failed to load collected-edition links: ${linksError.message}`)
  }

  const heroIssueIds = Array.from(new Set((linksRows ?? []).map((row) => row.hero_issue_id).filter(Boolean)))
  if (!heroIssueIds.length) {
    return { collectedEditionId, readIt, issueIds: [], states: [] }
  }

  const timelineIssueIdByHeroIssueId = await mapHeroIssueIdsToTimelineIssueIds({ heroApiId, heroIssueIds })
  const issueIds = Array.from(
    new Set(
      heroIssueIds
        .map((heroIssueId) => timelineIssueIdByHeroIssueId.get(heroIssueId))
        .filter(Boolean)
    )
  )

  if (!issueIds.length) {
    return { collectedEditionId, readIt, issueIds: [], states: [] }
  }

  const currentStates = await getUserIssueStatesByIssueIds({ userId, issueIds })
  const stateByIssueId = new Map(currentStates.map((state) => [state.issueId, state]))
  const timestamp = new Date().toISOString()

  if (readIt) {
    const payload = issueIds.map((issueId) => {
      const current = stateByIssueId.get(issueId)
      return {
        user_id: userId,
        issue_id: issueId,
        have_it: current?.haveIt ?? false,
        read_it: true,
        updated_at: timestamp,
      }
    })

    const { error } = await supabaseServiceClient
      .from(ISSUE_STATES_TABLE)
      .upsert(payload, { onConflict: 'user_id,issue_id' })

    if (error) {
      throw new Error(`Failed to save reading states for collected edition: ${error.message}`)
    }
  } else {
    const toDelete = []
    const toUpsert = []

    for (const issueId of issueIds) {
      const current = stateByIssueId.get(issueId)
      if (!current?.haveIt) {
        toDelete.push(issueId)
      } else {
        toUpsert.push({
          user_id: userId,
          issue_id: issueId,
          have_it: true,
          read_it: false,
          updated_at: timestamp,
        })
      }
    }

    if (toDelete.length) {
      const { error } = await supabaseServiceClient
        .from(ISSUE_STATES_TABLE)
        .delete()
        .eq('user_id', userId)
        .in('issue_id', toDelete)

      if (error) {
        throw new Error(`Failed to clear reading states for collected edition: ${error.message}`)
      }
    }

    if (toUpsert.length) {
      const { error } = await supabaseServiceClient
        .from(ISSUE_STATES_TABLE)
        .upsert(toUpsert, { onConflict: 'user_id,issue_id' })

      if (error) {
        throw new Error(`Failed to update reading states for collected edition: ${error.message}`)
      }
    }
  }

  const states = await getUserIssueStatesByIssueIds({ userId, issueIds })
  return { collectedEditionId, readIt, issueIds, states }
}
