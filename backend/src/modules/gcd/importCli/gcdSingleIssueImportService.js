import { mapIssueToTimelineEntry } from '../issueMapper.js'
import { upsertHeroIssues } from '../../hero/issuesService.js'
import { upsertHeroTimelineEntriesByGcdIssueId } from '../../hero/timelineService.js'
import { linkImportedIssueCovers } from './coverLinkService.js'
import { supabaseServiceClient } from '../../../lib/supabaseClient.js'
import { normalizeGcdIssueIdInput } from './issueIdentifierUtils.js'
import { gcdGetWithRateLimitRetry } from './rateLimitRetryService.js'

const loadExistingHeroIssue = async ({ heroApiId, gcdIssueId }) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('id, gcd_issue_id')
    .eq('hero_api_id', heroApiId)
    .eq('gcd_issue_id', gcdIssueId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to check existing hero issue: ${error.message}`)
  }
  return data ?? null
}

const resolveIssueDisplayName = (issue) => {
  const series = issue?.series_name ? String(issue.series_name).trim() : ''
  const number = issue?.number ? String(issue.number).trim() : ''
  const title = issue?.title ? String(issue.title).trim() : ''
  if (title) return title
  if (series && number) return `${series} #${number}`
  if (series) return series
  return `GCD issue ${issue?.id ?? 'unknown'}`
}

/**
 * Imports a single GCD issue for a selected hero.
 */
export const importSingleGcdIssueIntoSupabase = async ({
  hero,
  gcdIssueId,
  includeInTimeline = true,
  coversAvailable = false,
  coversFolderName = null,
  logger = console,
}) => {
  if (!hero?.api_id) {
    throw new Error('Valid hero selection is required.')
  }

  const normalizedIssueId = normalizeGcdIssueIdInput(gcdIssueId)
  logger.log(`Loading GCD issue ${normalizedIssueId}...`)
  const issueFetch = await gcdGetWithRateLimitRetry(`issue/${normalizedIssueId}/`, {
    logger,
    label: `issue/${normalizedIssueId}`,
  })
  const issue = issueFetch.data

  if (!issue) {
    throw new Error(`Issue ${normalizedIssueId} was not found in GCD.`)
  }

  const issueDisplayName = resolveIssueDisplayName(issue)
  const existingBefore = await loadExistingHeroIssue({
    heroApiId: hero.api_id,
    gcdIssueId: normalizedIssueId,
  })

  const persistedRows = await upsertHeroIssues(hero.api_id, [issue])
  const issueStatus = existingBefore ? 'updated' : 'inserted'

  let timelineStatus = 'skipped'
  let timelineInserted = 0
  let timelineUpdated = 0
  let timelineSkipped = 0
  let timelineEntry = null

  if (includeInTimeline) {
    timelineEntry = mapIssueToTimelineEntry(issue)
    if (!timelineEntry) {
      timelineStatus = 'skipped_invalid_date'
    } else {
      const result = await upsertHeroTimelineEntriesByGcdIssueId(hero.api_id, [timelineEntry])
      timelineInserted = result.inserted.length
      timelineUpdated = result.updated.length
      timelineSkipped = result.skipped.length
      timelineStatus = timelineInserted ? 'inserted' : timelineUpdated ? 'updated' : 'skipped'
    }
  }

  let coverSummary = null
  if (coversAvailable) {
    logger.log(`Linking cover from /covers/${coversFolderName}...`)
    coverSummary = await linkImportedIssueCovers({
      heroApiId: hero.api_id,
      gcdIssueIds: [normalizedIssueId],
      coversFolderName,
      heroSlug: hero.slug ?? null,
    })
  }

  return {
    hero,
    gcdIssueId: normalizedIssueId,
    issueDisplayName,
    issueStatus,
    persistedIssueRows: persistedRows.length,
    includeInTimeline,
    timelineStatus,
    timelineInserted,
    timelineUpdated,
    timelineSkipped,
    coversAttempted: coversAvailable,
    coverSummary,
    rateLimitPauses: issueFetch.pauses,
    rateLimitWaitedMs: issueFetch.waitedMs,
  }
}
