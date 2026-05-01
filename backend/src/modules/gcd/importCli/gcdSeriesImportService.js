// Import a full GCD series into hero issues, timeline rows, and optional cover links.
import { mapIssueToTimelineEntry } from '../issueMapper.js'
import { upsertHeroIssues } from '../../hero/issuesService.js'
import {
  deleteHeroTimelineEntriesByGcdIssueIds,
  upsertHeroTimelineEntriesByGcdIssueId,
} from '../../hero/timelineService.js'
import { supabaseServiceClient } from '../../../lib/supabaseClient.js'
import { buildTimelineVisibilityPlan } from './timelineFilterService.js'
import { linkImportedIssueCovers } from './coverLinkService.js'
import { gcdGetWithRateLimitRetry } from './rateLimitRetryService.js'

const toSlug = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeHeroNameCandidate = (value) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  return normalized
    .replace(/\([^)]*series[^)]*\)/gi, ' ')
    .replace(/\([^)]*\d{4}[^)]*\)/g, ' ')
    .replace(/\bvol(\.|ume)?\s*\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const resolveSeriesLabel = (series) =>
  series?.name ?? series?.series_name ?? series?.title ?? series?.display_name ?? `Series ${series?.id ?? 'unknown'}`

const formatHeroCandidates = (rows = []) =>
  rows.map((row) => `${row.name} (slug=${row.slug ?? 'n/a'}, api_id=${row.api_id})`).join('; ')

const resolveHeroFromOverrides = async ({ heroSlugOverride, heroApiIdOverride }) => {
  if (heroSlugOverride && heroApiIdOverride) {
    throw new Error('Use either heroSlugOverride or heroApiIdOverride, not both.')
  }

  if (heroApiIdOverride) {
    // Allow deterministic imports by API id when slug matching is ambiguous.
    const numeric = Number(heroApiIdOverride)
    if (!Number.isSafeInteger(numeric) || numeric <= 0) {
      throw new Error('heroApiIdOverride must be a positive integer.')
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

  if (heroSlugOverride) {
    const normalizedSlug = String(heroSlugOverride).trim().toLowerCase()
    const { data, error } = await supabaseServiceClient
      .from('superheroes')
      .select('api_id, name, slug, publisher')
      .eq('slug', normalizedSlug)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to resolve hero by slug override: ${error.message}`)
    }
    if (!data) {
      throw new Error(`No hero found for slug "${normalizedSlug}".`)
    }
    return data
  }

  return null
}

const resolveHeroForSeries = async (series) => {
  const rawName = resolveSeriesLabel(series)
  const baseName = normalizeHeroNameCandidate(rawName)
  if (!baseName) {
    throw new Error(`Unable to resolve hero from series name "${rawName}".`)
  }

  const slug = toSlug(baseName)
  if (slug) {
    const { data: bySlug, error: slugError } = await supabaseServiceClient
      .from('superheroes')
      .select('api_id, name, slug, publisher')
      .eq('slug', slug)
      .order('api_id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (slugError) {
      throw new Error(`Failed to resolve hero by slug: ${slugError.message}`)
    }

    if (bySlug) {
      return bySlug
    }
  }

  const exactName = baseName.toLowerCase()
  const { data: exactMatches, error: nameError } = await supabaseServiceClient
    .from('superheroes')
    .select('api_id, name, slug, publisher')
    .ilike('name', exactName)
    .order('api_id', { ascending: true })
    .limit(5)

  if (nameError) {
    throw new Error(`Failed to resolve hero by name: ${nameError.message}`)
  }

  if ((exactMatches ?? []).length === 1) {
    return exactMatches[0]
  }

  if ((exactMatches ?? []).length > 1) {
    throw new Error(
      `Ambiguous hero match for "${baseName}". Candidates: ${formatHeroCandidates(
        exactMatches
      )}. Re-run with --hero-slug=<slug> or set a hero slug override in the prompt.`
    )
  }

  const likePattern = `%${baseName}%`
  const { data: fuzzyMatches, error: fuzzyError } = await supabaseServiceClient
    .from('superheroes')
    .select('api_id, name, slug, publisher')
    .ilike('name', likePattern)
    .order('api_id', { ascending: true })
    .limit(5)

  if (fuzzyError) {
    throw new Error(`Failed to resolve hero by fuzzy name: ${fuzzyError.message}`)
  }

  if ((fuzzyMatches ?? []).length === 1) {
    return fuzzyMatches[0]
  }

  if ((fuzzyMatches ?? []).length > 1) {
    throw new Error(
      `Ambiguous fuzzy hero match for "${baseName}". Candidates: ${formatHeroCandidates(
        fuzzyMatches
      )}. Re-run with --hero-slug=<slug> or set a hero slug override in the prompt.`
    )
  }

  throw new Error(
    `No superhero row matched series "${rawName}" (parsed as "${baseName}"). Seed/insert the hero first in superheroes.`
  )
}

const normalizeSeriesId = (value) => {
  const numeric = Number(value)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error('A valid positive numeric seriesId is required.')
  }
  return numeric
}

const fetchSeriesIssues = async ({ seriesId, logger = console }) => {
  const seriesFetch = await gcdGetWithRateLimitRetry(`series/${seriesId}/`, {
    logger,
    label: `series/${seriesId}`,
  })
  const series = seriesFetch.data
  const urls = series?.active_issues ?? []
  const descriptors = series?.issue_descriptors ?? []

  if (!urls.length) {
    return {
      series,
      issues: [],
      fetchFailures: [],
      rateLimitPauses: seriesFetch.pauses,
      rateLimitWaitedMs: seriesFetch.waitedMs,
    }
  }

  const issues = []
  const fetchFailures = []
  let rateLimitPauses = seriesFetch.pauses
  let rateLimitWaitedMs = seriesFetch.waitedMs

  for (let index = 0; index < urls.length; index += 1) {
    const issueUrl = urls[index]
    if (!issueUrl) continue

    try {
      const issueFetch = await gcdGetWithRateLimitRetry(issueUrl, {
        logger,
        label: `issue ${index + 1}/${urls.length}`,
      })
      const issue = issueFetch.data
      rateLimitPauses += issueFetch.pauses
      rateLimitWaitedMs += issueFetch.waitedMs
      if (!issue.descriptor && descriptors[index]) {
        issue.descriptor = descriptors[index]
      }
      issues.push(issue)
      logger.log(`Fetched issue ${index + 1}/${urls.length}`)
    } catch (error) {
      fetchFailures.push({
        index,
        issueUrl,
        message: error.message,
      })
      logger.warn(`Failed issue ${index + 1}/${urls.length}: ${error.message}`)
    }
  }

  return {
    series,
    issues,
    fetchFailures,
    rateLimitPauses,
    rateLimitWaitedMs,
  }
}

const resolveDistinctGcdIssueIds = (issues) => {
  const values = new Set()
  for (const issue of issues ?? []) {
    const raw = issue?.id
    const numeric = Number(raw)
    if (!Number.isSafeInteger(numeric) || numeric <= 0) continue
    values.add(numeric)
  }
  return Array.from(values)
}

const toImportSummary = ({
  seriesId,
  seriesLabel,
  hero,
  fetchedIssues,
  fetchFailures,
  persistedIssueRows,
  timelineCandidates,
  timelineVisibilityPlan,
  timelinePersistResult,
  deletedVariants,
  coverSummary,
  includeCovers,
  rateLimitPauses,
  rateLimitWaitedMs,
}) => ({
  seriesId,
  seriesLabel,
  hero,
  fetchedIssues,
  fetchFailures,
  persistedIssueRows,
  timelineCandidates,
  timelineInserted: timelinePersistResult.inserted.length,
  timelineUpdated: timelinePersistResult.updated.length,
  timelineSkipped: timelinePersistResult.skipped.length,
  timelineVariantFilteredOut: timelineVisibilityPlan.excludedEntries.length,
  variantFilteringApplied: timelineVisibilityPlan.variantFilteringApplied,
  timelineVariantRowsDeleted: deletedVariants.deleted,
  timelineVariantDeleteFailures: deletedVariants.failed.length,
  coversAttempted: includeCovers,
  coverSummary,
  rateLimitPauses,
  rateLimitWaitedMs,
})

/**
 * Imports an entire GCD series for its mapped hero using project-native services.
 */
export const importGcdSeriesIntoSupabase = async ({
  seriesId,
  excludeVariantsFromTimeline,
  coversAvailable,
  coversFolderName,
  heroSlugOverride,
  heroApiIdOverride,
  logger = console,
}) => {
  const normalizedSeriesId = normalizeSeriesId(seriesId)
  logger.log(`Loading GCD series ${normalizedSeriesId}...`)

  const { series, issues, fetchFailures, rateLimitPauses, rateLimitWaitedMs } = await fetchSeriesIssues({
    seriesId: normalizedSeriesId,
    logger,
  })

  if (!series) {
    throw new Error(`Series ${normalizedSeriesId} was not found in GCD.`)
  }

  const overrideHero = await resolveHeroFromOverrides({ heroSlugOverride, heroApiIdOverride })
  const hero = overrideHero ?? (await resolveHeroForSeries(series))
  if (overrideHero) {
    logger.log(`Hero override applied: ${hero.name} (api_id=${hero.api_id}, slug=${hero.slug ?? 'n/a'})`)
  }
  logger.log(`Resolved hero: ${hero.name} (api_id=${hero.api_id}, slug=${hero.slug ?? 'n/a'})`)

  logger.log(`Upserting ${issues.length} issue rows...`)
  const persistedIssueRows = await upsertHeroIssues(hero.api_id, issues)

  const timelineCandidates = issues.map(mapIssueToTimelineEntry).filter(Boolean)
  const timelineVisibilityPlan = buildTimelineVisibilityPlan({
    entries: timelineCandidates,
    excludeVariantsFromTimeline,
  })

  logger.log(
    `Preparing timeline entries: ${timelineVisibilityPlan.selectedEntries.length} selected, ` +
      `${timelineVisibilityPlan.excludedEntries.length} filtered`
  )

  const timelinePersistResult = await upsertHeroTimelineEntriesByGcdIssueId(
    hero.api_id,
    timelineVisibilityPlan.selectedEntries
  )

  let deletedVariants = { deleted: 0, failed: [] }
  if (timelineVisibilityPlan.variantFilteringApplied && timelineVisibilityPlan.excludedEntries.length) {
    const excludedIds = timelineVisibilityPlan.excludedEntries
      .map((entry) => entry?.metadata?.gcdIssueId ?? entry?.metadata?.gcd_issue_id)
      .filter((value) => value !== null && value !== undefined)
    deletedVariants = await deleteHeroTimelineEntriesByGcdIssueIds(hero.api_id, excludedIds)
  }

  let coverSummary = null
  if (coversAvailable) {
    logger.log(`Linking cover images from /covers/${coversFolderName}...`)
    coverSummary = await linkImportedIssueCovers({
      heroApiId: hero.api_id,
      gcdIssueIds: resolveDistinctGcdIssueIds(issues),
      coversFolderName,
      heroSlug: hero.slug ?? null,
    })
  }

  return toImportSummary({
    seriesId: normalizedSeriesId,
    seriesLabel: resolveSeriesLabel(series),
    hero,
    fetchedIssues: issues.length,
    fetchFailures,
    persistedIssueRows: persistedIssueRows.length,
    timelineCandidates: timelineCandidates.length,
    timelineVisibilityPlan,
    timelinePersistResult,
    deletedVariants,
    includeCovers: coversAvailable,
    coverSummary,
    rateLimitPauses,
    rateLimitWaitedMs,
  })
}
