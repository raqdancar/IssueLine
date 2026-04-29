/**
 * Servei de domini per construir i consultar la cronologia d'un personatge.
 *
 * Aquest mòdul agrega dades de múltiples fonts internes:
 * - `hero_timelines` (línia temporal canònica),
 * - `hero_issues` (metadades enriquides de números),
 * - `collected_editions` i enllaços (recopilatoris i cobertura).
 *
 * L'objectiu és retornar payloads preparats per al frontend, mantenint
 * compatibilitat amb dades parcials i diferents versions de metadades.
 */

import { supabaseServiceClient } from '../../lib/supabaseClient.js'
import { getHeroIssueCoverPathMap } from './issuesService.js'

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

/**
 * Cerca un personatge per `slug` i retorna la seva informació bàsica.
 *
 * @param {string} slug Slug URL del personatge.
 * @returns {Promise<{api_id:number,name:string,slug:string,publisher:string}|null>}
 */

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

/**
 * Retorna la cronologia completa d'un personatge, ordenada per data.
 *
 * A més, intenta enriquir les entrades amb `coverImagePath` a partir de la taula
 * de números importats. Si l'enriquiment falla, retorna igualment les entrades
 * per no bloquejar la visualització de la cronologia.
 *
 * @param {number} heroApiId Identificador API del personatge.
 * @returns {Promise<Array>} Entrades de cronologia preparades per al frontend.
 */

export const getHeroTimelineEntries = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, issue_date, headline, summary, issue_code, source_url, severity, metadata, special_issue, created_at')
    .eq('hero_api_id', heroApiId)
    .order('issue_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch timeline entries: ${error.message}`)
  }

  const entries = data ?? []
  let enrichedEntries = entries
  const gcdIssueIds = entries
    .map((entry) => {
      const metadata = entry.metadata ?? {}
      if (metadata.gcdIssueId) return Number(metadata.gcdIssueId)
      if (metadata.gcd_issue_id) return Number(metadata.gcd_issue_id)
      return null
    })
    .filter((value) => Number.isFinite(value))

  let coverLookup = new Map()
  if (gcdIssueIds.length) {
    try {
      coverLookup = await getHeroIssueCoverPathMap(heroApiId, gcdIssueIds)
    } catch (coverLookupError) {
      // Timeline data should still render even when cover enrichment fails in a partial deploy/migration state.
      console.warn(
        `[heroTimeline] cover enrichment skipped for hero ${heroApiId}: ${coverLookupError.message}`
      )
      coverLookup = new Map()
    }
  }

  if (coverLookup.size) {
    enrichedEntries = entries.map((entry) => {
      const metadata = entry.metadata ?? null
      if (!metadata) return entry
      const gcdIssueId = metadata.gcdIssueId ?? metadata.gcd_issue_id
      const coverPath = coverLookup.get(Number(gcdIssueId))
      if (!coverPath) {
        return entry
      }
      return {
        ...entry,
        metadata: {
          ...metadata,
          coverImagePath: coverPath,
          cover_image_path: coverPath,
        },
      }
    })
  }

  const stageIds = Array.from(
    new Set(
      enrichedEntries
        .map((entry) => {
          const metadata = entry?.metadata ?? {}
          const rawStageId = metadata.stage_id ?? metadata.stageId ?? null
          const stageId = Number(rawStageId)
          return Number.isSafeInteger(stageId) && stageId > 0 ? stageId : null
        })
        .filter(Boolean)
    )
  )

  if (!stageIds.length) {
    return enrichedEntries
  }

  const { data: stageRows, error: stageError } = await supabaseServiceClient
    .from('hero_issue_stages')
    .select('*')
    .in('id', stageIds)

  if (stageError) {
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
    return enrichedEntries
  }

  return enrichedEntries.map((entry) => {
    const metadata = entry?.metadata ?? null
    if (!metadata) return entry
    const stageId = Number(metadata.stage_id ?? metadata.stageId ?? 0)
    if (!Number.isSafeInteger(stageId) || stageId <= 0) {
      return entry
    }
    const stage = stageMap.get(stageId)
    if (!stage) return entry

    const stageName =
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
    const stageSummary =
      stage.summary ??
      stage.short_summary ??
      stage.shortSummary ??
      metadata.stage_summary ??
      metadata.stageSummary ??
      metadata.stage?.short_summary ??
      metadata.stage?.summary ??
      null

    return {
      ...entry,
      metadata: {
        ...metadata,
        stage_name: stageName,
        stageName: stageName,
        stage_summary: stageSummary,
        stageSummary: stageSummary,
      },
    }
  })
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
  const sourceUrl =
    timelineEntry.source_url ??
    metadata.source_url ??
    metadata.sourceUrl ??
    (gcdIssueId ? `https://www.comics.org/issue/${gcdIssueId}/` : null)

  return {
    id: timelineEntry.id,
    heroApiId: timelineEntry.hero_api_id,
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
      legacyNumber: metadata.legacy_number ?? metadata.legacyNumber ?? null,
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
      editing: metadata.editing ?? null,
      rating: metadata.rating ?? null,
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
  if (!heroIssueId) return []

  const { data, error } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select(
      'notes, collected_editions(id, title, subtitle, series_title, publisher, publication_date, format, cover_image_url, source, source_external_id, source_series_id, isbn)'
    )
    .eq('hero_issue_id', heroIssueId)

  if (error) {
    throw new Error(`Failed to load collected editions for issue: ${error.message}`)
  }

  return (data ?? []).map(mapCollectedEditionRow).filter(Boolean)
}

const resolveStageIdentityFromMetadata = (metadata = {}, stageIdentityById = new Map()) => {
  const rawStageId = metadata.stage_id ?? metadata.stageId ?? null
  const stageId = Number(rawStageId)
  const stageIdentityFromTable =
    Number.isSafeInteger(stageId) && stageId > 0 ? stageIdentityById.get(stageId) ?? null : null

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

  const { data: editionRows, error: editionError } = await supabaseServiceClient
    .from('collected_editions')
    .select('id, title, subtitle, publisher, publication_date, format, cover_image_url, source, source_external_id, source_series_id, isbn')
    .eq('hero_api_id', heroApiId)
    .order('publication_date', { ascending: true, nullsFirst: false })

  if (editionError) {
    throw new Error(`Failed to load collected editions overview: ${editionError.message}`)
  }

  const editions = editionRows ?? []
  if (!editions.length) return []

  const collectedEditionIds = editions.map((row) => row.id)

  const { data: linksRows, error: linksError } = await supabaseServiceClient
    .from('collected_edition_issue_links')
    .select('collected_edition_id, hero_issue_id, notes')
    .in('collected_edition_id', collectedEditionIds)

  if (linksError) {
    throw new Error(`Failed to load collected-edition links: ${linksError.message}`)
  }

  const links = linksRows ?? []
  if (!links.length) {
    return editions.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
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

  const { data: heroIssueRows, error: heroIssueError } = await supabaseServiceClient
    .from('hero_issues')
    .select('id, gcd_issue_id, number, series_name, title')
    .eq('hero_api_id', heroApiId)
    .in('id', heroIssueIds)

  if (heroIssueError) {
    throw new Error(`Failed to load hero issues for collected overview: ${heroIssueError.message}`)
  }

  const { data: timelineRows, error: timelineError } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)

  if (timelineError) {
    throw new Error(`Failed to load timeline metadata for collected overview: ${timelineError.message}`)
  }

  const stageIds = Array.from(
    new Set(
      (timelineRows ?? [])
        .map((row) => {
          const metadata = row?.metadata ?? {}
          const stageId = Number(metadata.stage_id ?? metadata.stageId ?? 0)
          return Number.isSafeInteger(stageId) && stageId > 0 ? stageId : null
        })
        .filter(Boolean)
    )
  )
  const stageIdentityById = new Map()

  if (stageIds.length) {
    const { data: stageRows, error: stageError } = await supabaseServiceClient
      .from('hero_issue_stages')
      .select('*')
      .in('id', stageIds)

    if (!stageError) {
      for (const stage of stageRows ?? []) {
        const stageId = Number(stage?.id)
        if (!Number.isSafeInteger(stageId) || stageId <= 0) continue
        const stageName = stage.title ?? stage.name ?? stage.label ?? stage.stage_name ?? stage.stageName ?? null
        if (!stageName) continue
        const stageKey = String(stageName).trim().toLowerCase()
        if (!stageKey) continue
        stageIdentityById.set(stageId, { key: stageKey, name: stageName })
      }
    } else {
      console.warn(
        `[heroTimeline] stage metadata overlay skipped for collected overview of hero ${heroApiId}: ${stageError.message}`
      )
    }
  }

  const issueById = new Map((heroIssueRows ?? []).map((row) => [row.id, row]))
  const timelineStageByGcdIssueId = new Map()
  const timelineIssueIdByGcdIssueId = new Map()
  for (const row of timelineRows ?? []) {
    const metadata = row.metadata ?? {}
    const gcdIssueId = resolveGcdIssueIdFromMetadata(metadata)
    if (!gcdIssueId || timelineStageByGcdIssueId.has(gcdIssueId)) continue
    const stage = resolveStageIdentityFromMetadata(metadata, stageIdentityById)
    timelineStageByGcdIssueId.set(gcdIssueId, stage)
    timelineIssueIdByGcdIssueId.set(gcdIssueId, row.id)
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
      const stage = timelineStageByGcdIssueId.get(issue.gcd_issue_id)

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
        timelineIssueId: timelineIssueIdByGcdIssueId.get(issue.gcd_issue_id) ?? null,
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

  const { data: timelineEntry, error: timelineError } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, hero_api_id, issue_date, headline, summary, issue_code, source_url, severity, metadata, created_at, updated_at')
    .eq('hero_api_id', heroApiId)
    .eq('id', issueId)
    .limit(1)
    .maybeSingle()

  if (timelineError) {
    throw new Error(`Failed to load timeline issue detail: ${timelineError.message}`)
  }
  if (!timelineEntry) {
    return null
  }

  const metadata = timelineEntry.metadata ?? {}
  const gcdIssueId = toSafeInteger(metadata.gcdIssueId ?? metadata.gcd_issue_id)
  let heroIssueRow = null
  let heroIssueId = null

  if (gcdIssueId) {
    const { data, error } = await supabaseServiceClient
      .from('hero_issues')
      .select(
        'id, gcd_issue_id, series_id, series_name, number, volume, title, key_date, on_sale_date, publication_date, price, page_count, cover, cover_original, cover_image_path, raw'
      )
      .eq('hero_api_id', heroApiId)
      .eq('gcd_issue_id', gcdIssueId)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to load cached issue metadata: ${error.message}`)
    }
    heroIssueRow = data ?? null
    heroIssueId = heroIssueRow?.id ?? null
  }

  const collectedEditions = await loadCollectedEditionsForHeroIssue(heroIssueId)

  return {
    issue: resolveTimelineIssueDetailPayload(timelineEntry, heroIssueRow),
    collectedEditions,
  }
}

/**

 * Construeix o transforma informaci? de cronologia per a createHeroTimelineEntry.

 */

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
  const normalizedDate = normalizeIssueDate(issueDate)

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

/**

 * Gestiona dades o comportament relacionat amb issues a getExistingGcdIssueIds.

 */

export const getExistingGcdIssueIds = async (heroApiId) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('metadata')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load existing hero timeline metadata: ${error.message}`)
  }

  const identifiers = new Set()
  for (const row of data ?? []) {
    const gcdIssueId = row?.metadata?.gcdIssueId || row?.metadata?.metronIssueId
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

  const payload = entries.map((entry) => ({
    hero_api_id: heroApiId,
    headline: entry.headline,
    summary: entry.summary ?? null,
    issue_code: entry.issueCode ?? null,
    issue_date: normalizeIssueDate(entry.issueDate),
    source_url: entry.sourceUrl ?? null,
    severity: entry.severity ?? 'info',
    metadata: entry.metadata ?? null,
  }))

  const { data, error } = await supabaseServiceClient.from('hero_timelines').insert(payload).select('*')

  if (error) {
    throw new Error(`Failed to create hero timeline entries: ${error.message}`)
  }

  return data ?? []
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
  headline: entry.headline,
  summary: entry.summary ?? null,
  issue_code: entry.issueCode ?? null,
  issue_date: normalizeIssueDate(entry.issueDate),
  source_url: entry.sourceUrl ?? null,
  severity: entry.severity ?? 'info',
  metadata: entry.metadata ?? null,
})

const resolveTimelineGcdIssueId = (entry) => {
  const value = entry?.metadata?.gcdIssueId ?? entry?.metadata?.gcd_issue_id
  if (value === undefined || value === null) return null
  const numeric = Number(value)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null
  return String(numeric)
}

const loadTimelineRowsByGcdIssueId = async (heroApiId, gcdIssueIds) => {
  if (!gcdIssueIds.length) return new Map()

  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero timelines for upsert: ${error.message}`)
  }

  const targetSet = new Set(gcdIssueIds)
  const lookup = new Map()
  for (const row of data ?? []) {
    const gcdIssueId = resolveTimelineGcdIssueId({ metadata: row.metadata })
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

  const entriesWithId = []
  const entriesWithoutId = []
  for (const entry of entries) {
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
        const { data, error } = await supabaseServiceClient
          .from('hero_timelines')
          .update(payload)
          .eq('id', id)
          .select('*')
          .maybeSingle()

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

  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero timelines for delete: ${error.message}`)
  }

  const targetSet = new Set(targets)
  const idsToDelete = (data ?? [])
    .filter((row) => {
      const value = resolveTimelineGcdIssueId({ metadata: row.metadata })
      return value ? targetSet.has(value) : false
    })
    .map((row) => row.id)

  if (!idsToDelete.length) {
    return { deleted: 0, failed: [] }
  }

  const failed = []
  let deleted = 0
  for (const batch of chunk(idsToDelete, 100)) {
    const { error: deleteError, count } = await supabaseServiceClient
      .from('hero_timelines')
      .delete({ count: 'exact' })
      .in('id', batch)

    if (deleteError) {
      failed.push({ ids: batch, reason: deleteError.message })
      continue
    }
    deleted += count ?? batch.length
  }

  return { deleted, failed }
}

