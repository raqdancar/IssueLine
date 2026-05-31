// Gestiona dades de personatges, imatges i cronologies dins del backend.
/**
 * Servei de domini per construir i consultar la cronologia d'un personatge.
 *
 * Aquest mÃ²dul agrega dades de mÃºltiples fonts internes:
 * - `hero_timelines` (lÃ­nia temporal canÃ²nica),
 * - `hero_issues` (metadades enriquides de nÃºmeros),
 * - `collected_editions` i enllaÃ§os (recopilatoris i cobertura).
 *
 * L'objectiu Ã©s retornar payloads preparats per al frontend, mantenint
 * compatibilitat amb dades parcials i diferents versions de metadades.
 */

import { toHumanGcdIssueUrl } from '../gcd/issueMapper.js'
import { compactLinkedTimelineMetadata } from './timelineMetadata.js'
import {
  deleteTimelineRowsByIds,
  findHeroBySlug,
  findHeroIssueById,
  findHeroIssueByGcdIssueId,
  findTimelineEntryById,
  insertTimelineRow,
  insertTimelineRows,
  listCollectedEditionLinksByEditionIds,
  listCollectedEditionsByHero,
  listCollectedEditionsForHeroIssue,
  listHeroIssuesByIds,
  listHeroIssuesByGcdIssueIds,
  listHeroIssuesForTimelineOverlay,
  listStageRowsById,
  listStageRowsByIds,
  listTimelineEntries,
  listTimelineMetadataRows,
  updateTimelineRow,
} from './repository.js'

const normalizeIssueDate = (value) => {
  if (!value) {
    throw new Error('Issue date is required.')
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid issue date provided: ${value}`)
  }
  return date.toISOString().slice(0, 10)
}

const resolveTimelineStageId = (timelineEntry = {}) => {
  const metadata = timelineEntry?.metadata ?? {}
  const rawStageId = timelineEntry?.stage_id ?? metadata.stage_id ?? metadata.stageId ?? null
  const stageId = Number(rawStageId)
  return Number.isSafeInteger(stageId) && stageId > 0 ? stageId : null
}

const resolveStageName = (stage = {}, metadata = {}) =>
  stage.title ??
  stage.name ??
  stage.label ??
  stage.stage_name ??
  stage.stageName ??
  metadata.stage_name ??
  metadata.stageName ??
  metadata.stage?.name ??
  metadata.stage?.label ??
  null

const resolveStageSummary = (stage = {}, metadata = {}) =>
  stage.summary ??
  stage.short_summary ??
  stage.shortSummary ??
  metadata.stage_summary ??
  metadata.stageSummary ??
  metadata.stage?.short_summary ??
  metadata.stage?.summary ??
  null

const applyStageMetadataOverlay = (entry, stageMap = new Map()) => {
  const stageId = resolveTimelineStageId(entry)
  if (!stageId) return entry

  const stage = stageMap.get(stageId)
  if (!stage) return entry

  const metadata = entry?.metadata ?? {}
  const stageName = resolveStageName(stage, metadata)
  const stageSummary = resolveStageSummary(stage, metadata)

  return {
    ...entry,
    metadata: {
      ...metadata,
      stage_id: stageId,
      stageId,
      stage_name: stageName,
      stageName: stageName,
      stage_summary: stageSummary,
      stageSummary: stageSummary,
    },
  }
}

const resolveEntryGcdIssueId = (entry = {}) => {
  const metadata = entry.metadata ?? {}
  const value = metadata.gcdIssueId ?? metadata.gcd_issue_id
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

const isPresent = (value) => value !== null && value !== undefined && value !== ''

const assignMetadataAliases = (metadata, value, ...keys) => {
  if (!isPresent(value)) return
  for (const key of keys) {
    metadata[key] = value
  }
}

const applyHeroIssueMetadataOverlay = (entry, heroIssueRow = null) => {
  const legacyGcdIssueId = resolveEntryGcdIssueId(entry)
  if (!heroIssueRow) {
    const sourceUrl = toHumanGcdIssueUrl(entry.source_url, legacyGcdIssueId)
    return sourceUrl === entry.source_url ? entry : { ...entry, source_url: sourceUrl }
  }

  const metadata = { ...(entry.metadata ?? {}) }
  const gcdIssueId = Number(heroIssueRow.gcd_issue_id) || legacyGcdIssueId
  const issueLabel =
    isPresent(heroIssueRow.series_name) && isPresent(heroIssueRow.number)
      ? `${heroIssueRow.series_name} ${heroIssueRow.number}`
      : null

  assignMetadataAliases(metadata, gcdIssueId, 'gcdIssueId')
  assignMetadataAliases(metadata, issueLabel, 'issueLabel')
  assignMetadataAliases(metadata, heroIssueRow.number, 'number')
  assignMetadataAliases(metadata, heroIssueRow.volume, 'volume')
  assignMetadataAliases(metadata, heroIssueRow.title, 'title')
  assignMetadataAliases(metadata, heroIssueRow.key_date, 'keyDate', 'key_date')
  assignMetadataAliases(metadata, heroIssueRow.on_sale_date, 'onSaleDate', 'on_sale_date')
  assignMetadataAliases(metadata, heroIssueRow.publication_date, 'publicationDate', 'publication_date')
  assignMetadataAliases(metadata, heroIssueRow.price, 'price')
  assignMetadataAliases(metadata, heroIssueRow.page_count, 'pageCount', 'page_count')
  assignMetadataAliases(metadata, heroIssueRow.cover, 'cover')
  assignMetadataAliases(metadata, heroIssueRow.cover_original, 'cover_original')
  assignMetadataAliases(metadata, heroIssueRow.cover_image_path, 'coverImagePath', 'cover_image_path')
  assignMetadataAliases(metadata, heroIssueRow.series_name, 'seriesName', 'series_name')
  assignMetadataAliases(metadata, heroIssueRow.timeline_order, 'timelineOrder', 'timeline_order')

  return {
    ...entry,
    source_url: toHumanGcdIssueUrl(entry.source_url, gcdIssueId),
    metadata,
  }
}

const loadHeroIssueOverlayLookup = async (heroApiId, entries) => {
  const heroIssueIds = entries.map((entry) => entry.hero_issue_id).filter(Boolean)
  const gcdIssueIds = entries
    .filter((entry) => !entry.hero_issue_id)
    .map((entry) => resolveEntryGcdIssueId(entry))
    .filter(Boolean)

  if (!heroIssueIds.length && !gcdIssueIds.length) {
    return { byId: new Map(), byGcdIssueId: new Map() }
  }

  const rows = await listHeroIssuesForTimelineOverlay({ heroApiId, heroIssueIds, gcdIssueIds })
  return {
    byId: new Map(rows.map((row) => [row.id, row])),
    byGcdIssueId: new Map(rows.map((row) => [Number(row.gcd_issue_id), row])),
  }
}

const resolveEntryTimelineOrder = (entry = {}) => {
  const metadata = entry.metadata ?? {}
  const value = metadata.timelineOrder ?? metadata.timeline_order
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

const resolveEntryTimestamp = (entry = {}) => {
  const timestamp = new Date(entry.issue_date ?? 0).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const sortTimelineEntries = (entries = []) =>
  [...entries].sort((a, b) => {
    const orderA = resolveEntryTimelineOrder(a)
    const orderB = resolveEntryTimelineOrder(b)
    if (orderA !== null || orderB !== null) {
      const safeA = orderA ?? Number.POSITIVE_INFINITY
      const safeB = orderB ?? Number.POSITIVE_INFINITY
      if (safeA !== safeB) return safeA - safeB
    }

    const dateA = resolveEntryTimestamp(a)
    const dateB = resolveEntryTimestamp(b)
    if (dateA !== dateB) return dateA - dateB

    return (resolveEntryGcdIssueId(a) ?? 0) - (resolveEntryGcdIssueId(b) ?? 0)
  })

/**
 * Cerca un personatge per `slug` i retorna la seva informaciÃ³ bÃ sica.
 *
 * @param {string} slug Slug URL del personatge.
 * @returns {Promise<{api_id:number,name:string,slug:string,publisher:string}|null>}
 */

export const getHeroBySlug = async (slug) => {
  return findHeroBySlug(slug)
}

/**
 * Retorna la cronologia completa d'un personatge, ordenada per data.
 *
 * A mÃ©s, intenta enriquir les entrades amb `coverImagePath` a partir de la taula
 * de nÃºmeros importats. Si l'enriquiment falla, retorna igualment les entrades
 * per no bloquejar la visualitzaciÃ³ de la cronologia.
 *
 * @param {number} heroApiId Identificador API del personatge.
 * @returns {Promise<Array>} Entrades de cronologia preparades per al frontend.
 */

export const getHeroTimelineEntries = async (heroApiId) => {
  const entries = await listTimelineEntries(heroApiId)
  let enrichedEntries = entries.map((entry) => applyHeroIssueMetadataOverlay(entry))

  try {
    const issueLookup = await loadHeroIssueOverlayLookup(heroApiId, entries)
    enrichedEntries = entries.map((entry) => {
      const canonicalIssue =
        issueLookup.byId.get(entry.hero_issue_id) ??
        issueLookup.byGcdIssueId.get(resolveEntryGcdIssueId(entry))
      return applyHeroIssueMetadataOverlay(entry, canonicalIssue)
    })
  } catch (overlayError) {
    // Legacy metadata remains a valid fallback during partial deploys and migrations.
    console.warn(`[heroTimeline] canonical issue overlay skipped for hero ${heroApiId}: ${overlayError.message}`)
  }

  const stageIds = Array.from(
    new Set(
      enrichedEntries
        .map((entry) => {
          return resolveTimelineStageId(entry)
        })
        .filter(Boolean)
    )
  )

  if (!stageIds.length) {
    return sortTimelineEntries(enrichedEntries)
  }

  let stageRows = []
  try {
    stageRows = await listStageRowsByIds(stageIds)
  } catch (stageError) {
    // Stage title syncing is optional. Keep timeline functional if the table/columns are not available yet.
    console.warn(
      `[heroTimeline] stage metadata overlay skipped for hero ${heroApiId}: ${stageError.message}`
    )
    return enrichedEntries
  }

  const stageMap = new Map(
    (stageRows ?? [])
      .map((row) => {
        const stageId = Number(row?.id)
        if (!Number.isSafeInteger(stageId) || stageId <= 0) return null
        return [stageId, row]
      })
      .filter(Boolean)
  )

  if (!stageMap.size) {
    return sortTimelineEntries(enrichedEntries)
  }

  return sortTimelineEntries(enrichedEntries.map((entry) => applyStageMetadataOverlay(entry, stageMap)))
}

const toSafeInteger = (value) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null
  return numeric
}

const resolveTimelineIssueNumber = (timelineEntry, heroIssueRow) => {
  if (heroIssueRow?.number) return heroIssueRow.number
  const metadata = timelineEntry?.metadata ?? {}
  return metadata.number ?? timelineEntry?.issue_code ?? null
}

const parseIssueNumberForSort = (value) => {
  if (value === null || value === undefined) return null
  const match = String(value).match(/\d+/)
  if (!match) return null
  const numeric = Number(match[0])
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

const resolveTimelineIssueDetailPayload = (timelineEntry, heroIssueRow) => {
  const metadata = timelineEntry?.metadata ?? {}
  const gcdIssueId = toSafeInteger(metadata.gcdIssueId ?? metadata.gcd_issue_id)
  const stageName = metadata.stage_name ?? metadata.stageName ?? metadata.stage?.name ?? metadata.stage?.label ?? null
  const stageSummary =
    metadata.stage_summary ?? metadata.stageSummary ?? metadata.stage?.short_summary ?? metadata.stage?.summary ?? null
  const sourceUrl = toHumanGcdIssueUrl(
    timelineEntry.source_url ??
      metadata.source_url ??
      metadata.sourceUrl,
    gcdIssueId
  )

  return {
    id: timelineEntry.id,
    heroApiId: timelineEntry.hero_api_id,
    eventType: timelineEntry.event_type ?? (heroIssueRow || gcdIssueId ? 'issue' : 'milestone'),
    headline: timelineEntry.headline,
    summary: timelineEntry.summary,
    issueCode: timelineEntry.issue_code,
    issueDate: timelineEntry.issue_date,
    severity: timelineEntry.severity,
    sourceUrl,
    createdAt: timelineEntry.created_at,
    updatedAt: timelineEntry.updated_at,
    issue: {
      title: heroIssueRow?.title ?? metadata.title ?? null,
      number: resolveTimelineIssueNumber(timelineEntry, heroIssueRow),
      legacyNumber: timelineEntry.legacy_number ?? metadata.legacy_number ?? metadata.legacyNumber ?? null,
    },
    series: {
      id: heroIssueRow?.series_id ?? toSafeInteger(metadata.series_id ?? metadata.seriesId),
      title: heroIssueRow?.series_name ?? metadata.series_name ?? metadata.seriesName ?? null,
      volume: heroIssueRow?.volume ?? metadata.volume ?? null,
    },
    dates: {
      publicationDate: heroIssueRow?.publication_date ?? metadata.publication_date ?? metadata.publicationDate ?? null,
      coverDate: heroIssueRow?.key_date ?? metadata.key_date ?? metadata.keyDate ?? null,
      onSaleDate: heroIssueRow?.on_sale_date ?? metadata.on_sale_date ?? metadata.onSaleDate ?? null,
    },
    stage: {
      key: metadata.stage_key ?? metadata.stageKey ?? metadata.stage?.key ?? null,
      name: stageName,
      summary: stageSummary,
    },
    credits: {
      editing: heroIssueRow?.raw?.editing ?? metadata.editing ?? null,
      rating: heroIssueRow?.raw?.rating ?? metadata.rating ?? null,
    },
    pricing: {
      price: heroIssueRow?.price ?? metadata.price ?? null,
      pageCount: heroIssueRow?.page_count ?? metadata.page_count ?? metadata.pageCount ?? null,
    },
    gcd: {
      issueId: gcdIssueId,
      issueApiUrl:
        metadata.api_url ??
        metadata.apiUrl ??
        heroIssueRow?.raw?.api_url ??
        (gcdIssueId ? `https://www.comics.org/api/issue/${gcdIssueId}/` : null),
    },
    images: {
      coverImagePath: heroIssueRow?.cover_image_path ?? metadata.cover_image_path ?? metadata.coverImagePath ?? null,
      cover: heroIssueRow?.cover ?? metadata.cover ?? metadata.cover_url ?? metadata.coverUrl ?? null,
      coverOriginal: heroIssueRow?.cover_original ?? metadata.cover_original ?? null,
    },
    metadata,
    rawIssue: heroIssueRow?.raw ?? null,
  }
}

const mapCollectedEditionRow = (row) => {
  const edition = row?.collected_editions
  if (!edition?.id) return null

  const sourceExternalId = edition.source_external_id ? String(edition.source_external_id) : null
  const sourceUrl =
    edition.source === 'gcd' && sourceExternalId
      ? `https://www.comics.org/issue/${sourceExternalId}/`
      : null

  return {
    id: edition.id,
    title: edition.title ?? null,
    subtitle: edition.subtitle ?? null,
    seriesTitle: edition.series_title ?? null,
    printLanguage: edition.print_language ?? null,
    format: edition.format ?? 'unknown',
    coverImageUrl: edition.cover_image_url ?? null,
    publicationDate: edition.publication_date ?? null,
    publisher: edition.publisher ?? null,
    isbn: edition.isbn ?? null,
    source: edition.source ?? null,
    sourceExternalId,
    sourceSeriesId: edition.source_series_id ?? null,
    notes: row?.notes ?? null,
    sourceUrl,
  }
}

const loadCollectedEditionsForHeroIssue = async (heroIssueId) => {
  const rows = await listCollectedEditionsForHeroIssue(heroIssueId)
  return rows.map(mapCollectedEditionRow).filter(Boolean)
}

const resolveStageIdentityFromTimelineEntry = (timelineEntry = {}, stageIdentityById = new Map()) => {
  const metadata = timelineEntry?.metadata ?? {}
  const stageId = resolveTimelineStageId(timelineEntry)
  const stageIdentityFromTable = stageId ? stageIdentityById.get(stageId) ?? null : null

  const resolvedName =
    stageIdentityFromTable?.name ??
    metadata.stage_name ??
    metadata.stageName ??
    metadata.stage?.name ??
    metadata.stage?.label ??
    null
  if (!resolvedName) return null

  const resolvedKey = stageIdentityFromTable?.key ?? String(resolvedName).trim().toLowerCase()
  if (!resolvedKey) return null
  return { key: resolvedKey, name: resolvedName }
}

const resolveGcdIssueIdFromMetadata = (metadata = {}) => {
  const value = metadata.gcdIssueId ?? metadata.gcd_issue_id
  const numeric = Number(value)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null
  return numeric
}

/**
 * Construeix la vista agregada de recopilatoris per a un personatge.
 *
 * El resultat inclou:
 * - metadades del recopilatori,
 * - llistat d'issues incloses,
 * - cobertura per etapes (stages) de cronologia.
 *
 * @param {number} heroApiId Identificador API del personatge.
 * @returns {Promise<Array>} Resum de recopilatoris amb cobertura d'issues.
 */

export const getHeroCollectedEditionsOverview = async (heroApiId) => {
  if (!heroApiId) return []

  const editions = await listCollectedEditionsByHero(heroApiId)
  if (!editions.length) return []

  const collectedEditionIds = editions.map((row) => row.id)

  const links = await listCollectedEditionLinksByEditionIds(collectedEditionIds)
  if (!links.length) {
    return editions.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      printLanguage: row.print_language ?? null,
      publisher: row.publisher,
      publicationDate: row.publication_date ?? null,
      format: row.format ?? 'unknown',
      coverImageUrl: row.cover_image_url ?? null,
      source: row.source ?? null,
      sourceExternalId: row.source_external_id ? String(row.source_external_id) : null,
      sourceSeriesId: row.source_series_id ?? null,
      isbn: row.isbn ?? null,
      issueCount: 0,
      issues: [],
      stages: [],
    }))
  }

  const heroIssueIds = Array.from(new Set(links.map((link) => link.hero_issue_id).filter(Boolean)))

  const heroIssueRows = await listHeroIssuesByIds({ heroApiId, heroIssueIds })
  const timelineRows = await listTimelineMetadataRows(heroApiId)

  const stageIds = Array.from(
    new Set(
      (timelineRows ?? [])
        .map((row) => {
          return resolveTimelineStageId(row)
        })
        .filter(Boolean)
    )
  )
  const stageIdentityById = new Map()

  if (stageIds.length) {
    try {
      const stageRows = await listStageRowsByIds(stageIds)
      for (const stage of stageRows ?? []) {
        const stageId = Number(stage?.id)
        if (!Number.isSafeInteger(stageId) || stageId <= 0) continue
        const stageName = resolveStageName(stage)
        if (!stageName) continue
        const stageKey = String(stageName).trim().toLowerCase()
        if (!stageKey) continue
        stageIdentityById.set(stageId, { key: stageKey, name: stageName })
      }
    } catch (stageError) {
      console.warn(
        `[heroTimeline] stage metadata overlay skipped for collected overview of hero ${heroApiId}: ${stageError.message}`
      )
    }
  }

  const issueById = new Map((heroIssueRows ?? []).map((row) => [row.id, row]))
  const timelineStageByHeroIssueId = new Map()
  const timelineIssueIdByHeroIssueId = new Map()
  const timelineStageByGcdIssueId = new Map()
  const timelineIssueIdByGcdIssueId = new Map()
  for (const row of timelineRows ?? []) {
    const metadata = row.metadata ?? {}
    const gcdIssueId = resolveGcdIssueIdFromMetadata(metadata)
    const stage = resolveStageIdentityFromTimelineEntry(row, stageIdentityById)
    if (row.hero_issue_id && !timelineStageByHeroIssueId.has(row.hero_issue_id)) {
      timelineStageByHeroIssueId.set(row.hero_issue_id, stage)
      timelineIssueIdByHeroIssueId.set(row.hero_issue_id, row.id)
    }
    if (gcdIssueId && !timelineStageByGcdIssueId.has(gcdIssueId)) {
      timelineStageByGcdIssueId.set(gcdIssueId, stage)
      timelineIssueIdByGcdIssueId.set(gcdIssueId, row.id)
    }
  }

  const linksByEditionId = new Map()
  for (const link of links) {
    if (!linksByEditionId.has(link.collected_edition_id)) {
      linksByEditionId.set(link.collected_edition_id, [])
    }
    linksByEditionId.get(link.collected_edition_id).push(link)
  }

  return editions.map((edition) => {
    const relatedLinks = linksByEditionId.get(edition.id) ?? []
    const stageMap = new Map()
    const issues = []

    for (const link of relatedLinks) {
      const issue = issueById.get(link.hero_issue_id)
      if (!issue) continue
      const stage =
        timelineStageByHeroIssueId.get(issue.id) ??
        timelineStageByGcdIssueId.get(issue.gcd_issue_id)

      if (stage?.key) {
        const current = stageMap.get(stage.key) ?? { key: stage.key, name: stage.name, count: 0 }
        current.count += 1
        stageMap.set(stage.key, current)
      }

      const issueNumber = issue.number ?? null
      const issueLabel = issueNumber
        ? `${issue.series_name ?? 'Issue'} #${issueNumber}`
        : issue.title ?? issue.series_name ?? `Issue ${issue.gcd_issue_id}`

      issues.push({
        timelineIssueId:
          timelineIssueIdByHeroIssueId.get(issue.id) ??
          timelineIssueIdByGcdIssueId.get(issue.gcd_issue_id) ??
          null,
        heroIssueId: issue.id,
        gcdIssueId: issue.gcd_issue_id,
        number: issueNumber,
        sortNumber: parseIssueNumberForSort(issueNumber),
        seriesName: issue.series_name ?? null,
        title: issue.title ?? null,
        label: issueLabel,
        note: link.notes ?? null,
        stageKey: stage?.key ?? null,
        stageName: stage?.name ?? null,
      })
    }

    return {
      id: edition.id,
      title: edition.title,
      subtitle: edition.subtitle,
      printLanguage: edition.print_language ?? null,
      publisher: edition.publisher,
      publicationDate: edition.publication_date ?? null,
      format: edition.format ?? 'unknown',
      coverImageUrl: edition.cover_image_url ?? null,
      source: edition.source ?? null,
      sourceExternalId: edition.source_external_id ? String(edition.source_external_id) : null,
      sourceSeriesId: edition.source_series_id ?? null,
      isbn: edition.isbn ?? null,
      issueCount: issues.length,
      issues: issues.sort((a, b) => {
        const safeA = Number.isSafeInteger(a.sortNumber) ? a.sortNumber : Number.POSITIVE_INFINITY
        const safeB = Number.isSafeInteger(b.sortNumber) ? b.sortNumber : Number.POSITIVE_INFINITY
        if (safeA !== safeB) return safeA - safeB
        return (a.gcdIssueId ?? 0) - (b.gcdIssueId ?? 0)
      }),
      stages: Array.from(stageMap.values()),
    }
  })
}

/**
 * Retorna el detall complet d'una issue de cronologia, incloent recopilatoris relacionats.
 *
 * @param {{heroApiId:number, issueId:string}} params
 * @returns {Promise<{issue:Object, collectedEditions:Array}|null>}
 */

export const getHeroTimelineIssueDetailById = async ({ heroApiId, issueId }) => {
  if (!heroApiId) {
    throw new Error('Hero identifier is required.')
  }
  if (!issueId) {
    throw new Error('Timeline issue identifier is required.')
  }

  const timelineEntry = await findTimelineEntryById({ heroApiId, issueId })
  if (!timelineEntry) {
    return null
  }

  const metadata = timelineEntry.metadata ?? {}
  const gcdIssueId = toSafeInteger(metadata.gcdIssueId ?? metadata.gcd_issue_id)
  let heroIssueRow = null
  let heroIssueId = timelineEntry.hero_issue_id ?? null

  if (heroIssueId) {
    heroIssueRow = await findHeroIssueById({ heroApiId, heroIssueId })
  }
  if (!heroIssueRow && gcdIssueId) {
    heroIssueRow = await findHeroIssueByGcdIssueId({ heroApiId, gcdIssueId })
    heroIssueId = heroIssueRow?.id ?? null
  }

  const collectedEditions = await loadCollectedEditionsForHeroIssue(heroIssueId)
  const stageId = resolveTimelineStageId(timelineEntry)
  let enrichedTimelineEntry = timelineEntry

  if (stageId) {
    try {
      const stageRows = await listStageRowsById(stageId)
      const stageMap = new Map((stageRows ?? []).map((stage) => [Number(stage.id), stage]))
      enrichedTimelineEntry = applyStageMetadataOverlay(timelineEntry, stageMap)
    } catch (stageError) {
      console.warn(
        `[heroTimeline] stage metadata overlay skipped for timeline issue ${issueId}: ${stageError.message}`
      )
    }
  }

  return {
    issue: resolveTimelineIssueDetailPayload(enrichedTimelineEntry, heroIssueRow),
    collectedEditions,
  }
}

/**

 * Construeix o transforma informaci? de cronologia per a createHeroTimelineEntry.

 */

export const createHeroTimelineEntry = async ({
  heroApiId,
  eventType = 'milestone',
  headline,
  summary,
  issueCode,
  issueDate,
  sourceUrl,
  severity = 'info',
  metadata,
}) => {
  const normalizedDate = normalizeIssueDate(issueDate)

  return insertTimelineRow({
    hero_api_id: heroApiId,
    event_type: eventType,
    headline,
    summary,
    issue_code: issueCode ?? null,
    issue_date: normalizedDate,
    source_url: sourceUrl ?? null,
    severity,
    metadata: metadata ?? null,
  })
}

/**

 * Gestiona dades o comportament relacionat amb issues a getExistingGcdIssueIds.

 */

export const getExistingGcdIssueIds = async (heroApiId) => {
  const data = await listTimelineMetadataRows(heroApiId)
  const heroIssueGcdIssueIdById = await loadHeroIssueGcdIssueIdLookup(heroApiId, data)

  const identifiers = new Set()
  for (const row of data ?? []) {
    const gcdIssueId =
      heroIssueGcdIssueIdById.get(row.hero_issue_id) ??
      row?.metadata?.gcdIssueId ??
      row?.metadata?.gcd_issue_id ??
      row?.metadata?.metronIssueId
    if (gcdIssueId) {
      identifiers.add(String(gcdIssueId))
    }
  }
  return identifiers
}

/**

 * Construeix o transforma informaci? de cronologia per a insertHeroTimelineEntries.

 */

export const insertHeroTimelineEntries = async (heroApiId, entries) => {
  if (!entries?.length) {
    return []
  }

  const resolvedEntries = await attachHeroIssueIds(heroApiId, entries)
  const payload = resolvedEntries.map((entry) => buildTimelinePayload(heroApiId, entry))

  return insertTimelineRows(payload)
}

const chunk = (values, size = 100) => {
  const batches = []
  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size))
  }
  return batches
}

const buildTimelinePayload = (heroApiId, entry) => ({
  hero_api_id: heroApiId,
  hero_issue_id: entry.heroIssueId ?? entry.hero_issue_id ?? null,
  event_type: entry.eventType ?? entry.event_type ?? 'issue',
  headline: entry.headline,
  summary: entry.summary ?? null,
  issue_code: entry.issueCode ?? null,
  issue_date: normalizeIssueDate(entry.issueDate),
  source_url: entry.sourceUrl ?? null,
  severity: entry.severity ?? 'info',
  metadata:
    (entry.heroIssueId ?? entry.hero_issue_id)
      ? compactLinkedTimelineMetadata(entry.metadata)
      : entry.metadata ?? null,
})

const attachHeroIssueIds = async (heroApiId, entries) => {
  const gcdIssueIds = entries
    .map((entry) => resolveEntryGcdIssueId(entry))
    .filter(Boolean)
  if (!gcdIssueIds.length) return entries

  const heroIssues = await listHeroIssuesByGcdIssueIds({ heroApiId, gcdIssueIds })
  const heroIssueIdByGcdIssueId = new Map(
    heroIssues.map((row) => [Number(row.gcd_issue_id), row.id])
  )

  return entries.map((entry) => {
    if (entry.heroIssueId ?? entry.hero_issue_id) return entry
    const gcdIssueId = resolveEntryGcdIssueId(entry)
    return {
      ...entry,
      heroIssueId: heroIssueIdByGcdIssueId.get(gcdIssueId) ?? null,
    }
  })
}

const resolveTimelineGcdIssueId = (entry) => {
  const value = entry?.metadata?.gcdIssueId ?? entry?.metadata?.gcd_issue_id
  if (value === undefined || value === null) return null
  const numeric = Number(value)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null
  return String(numeric)
}

const loadHeroIssueGcdIssueIdLookup = async (heroApiId, timelineRows) => {
  const heroIssueIds = Array.from(new Set((timelineRows ?? []).map((row) => row.hero_issue_id).filter(Boolean)))
  if (!heroIssueIds.length) return new Map()

  const heroIssues = await listHeroIssuesByIds({ heroApiId, heroIssueIds })
  return new Map(
    heroIssues
      .filter((row) => isPresent(row.gcd_issue_id))
      .map((row) => [row.id, String(row.gcd_issue_id)])
  )
}

const resolveTimelineRowGcdIssueId = (row, heroIssueGcdIssueIdById = new Map()) =>
  heroIssueGcdIssueIdById.get(row.hero_issue_id) ?? resolveTimelineGcdIssueId(row)

const loadTimelineRowsByGcdIssueId = async (heroApiId, gcdIssueIds) => {
  if (!gcdIssueIds.length) return new Map()

  const data = await listTimelineMetadataRows(heroApiId)
  const heroIssueGcdIssueIdById = await loadHeroIssueGcdIssueIdLookup(heroApiId, data)

  const targetSet = new Set(gcdIssueIds)
  const lookup = new Map()
  for (const row of data ?? []) {
    const gcdIssueId = resolveTimelineRowGcdIssueId(row, heroIssueGcdIssueIdById)
    if (!gcdIssueId || !targetSet.has(gcdIssueId) || lookup.has(gcdIssueId)) {
      continue
    }
    lookup.set(gcdIssueId, row)
  }

  return lookup
}

/**
 * Upserts timeline rows by hero + metadata.gcdIssueId.
 * If an entry has no gcdIssueId, it is inserted as a new row.
 */
/**
 * Construeix o transforma informaci? de cronologia per a upsertHeroTimelineEntriesByGcdIssueId.
 */
export const upsertHeroTimelineEntriesByGcdIssueId = async (heroApiId, entries) => {
  if (!entries?.length) {
    return { inserted: [], updated: [], skipped: [] }
  }

  const resolvedEntries = await attachHeroIssueIds(heroApiId, entries)
  const entriesWithId = []
  const entriesWithoutId = []
  for (const entry of resolvedEntries) {
    const gcdIssueId = resolveTimelineGcdIssueId(entry)
    if (gcdIssueId) {
      entriesWithId.push({ entry, gcdIssueId })
    } else {
      entriesWithoutId.push(entry)
    }
  }

  const existingLookup = await loadTimelineRowsByGcdIssueId(
    heroApiId,
    Array.from(new Set(entriesWithId.map((item) => item.gcdIssueId)))
  )

  const toInsert = [...entriesWithoutId]
  const toUpdate = []
  const skipped = []

  for (const item of entriesWithId) {
    const existing = existingLookup.get(item.gcdIssueId)
    if (!existing) {
      toInsert.push(item.entry)
      continue
    }
    toUpdate.push({ id: existing.id, entry: item.entry, gcdIssueId: item.gcdIssueId })
  }

  const inserted = toInsert.length ? await insertHeroTimelineEntries(heroApiId, toInsert) : []
  const updated = []

  for (const batch of chunk(toUpdate, 25)) {
    await Promise.all(
      batch.map(async ({ id, entry, gcdIssueId }) => {
        const payload = buildTimelinePayload(heroApiId, entry)
        const { data, error } = await updateTimelineRow({ id, payload })

        if (error) {
          skipped.push({ gcdIssueId, id, reason: error.message })
          return
        }

        if (!data) {
          skipped.push({ gcdIssueId, id, reason: 'Timeline row not found during update.' })
          return
        }

        updated.push(data)
      })
    )
  }

  return { inserted, updated, skipped }
}

/**
 * Deletes hero timeline rows where metadata.gcdIssueId matches provided ids.
 */
/**
 * Construeix o transforma informaci? de cronologia per a deleteHeroTimelineEntriesByGcdIssueIds.
 */
export const deleteHeroTimelineEntriesByGcdIssueIds = async (heroApiId, gcdIssueIds) => {
  const targets = Array.from(
    new Set(
      (gcdIssueIds ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 0)
        .map((value) => String(value))
    )
  )
  if (!targets.length) {
    return { deleted: 0, failed: [] }
  }

  const data = await listTimelineMetadataRows(heroApiId)
  const heroIssueGcdIssueIdById = await loadHeroIssueGcdIssueIdLookup(heroApiId, data)

  const targetSet = new Set(targets)
  const idsToDelete = (data ?? [])
    .filter((row) => {
      const value = resolveTimelineRowGcdIssueId(row, heroIssueGcdIssueIdById)
      return value ? targetSet.has(value) : false
    })
    .map((row) => row.id)

  if (!idsToDelete.length) {
    return { deleted: 0, failed: [] }
  }

  const failed = []
  let deleted = 0
  for (const batch of chunk(idsToDelete, 100)) {
    const { error: deleteError, count } = await deleteTimelineRowsByIds(batch)

    if (deleteError) {
      failed.push({ ids: batch, reason: deleteError.message })
      continue
    }
    deleted += count ?? batch.length
  }

  return { deleted, failed }
}
