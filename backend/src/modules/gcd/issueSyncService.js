// Gestiona la integracio amb GCD i la normalitzacio de dades editorials.
const BRITISH_REGEX = /\\[british]/i
const DIRECT_REGEX = /direct/i
const NEWSSTAND_REGEX = /(newsstand|newstand)/i

const descriptorAllowed = (descriptor, { directOnly, skipNewsstand }) => {
  const label = descriptor ?? ''
  // Skip known non-target variants before spending API/storage work.
  if (BRITISH_REGEX.test(label)) return false
  if (skipNewsstand && NEWSSTAND_REGEX.test(label)) return false
  if (directOnly) {
    return DIRECT_REGEX.test(label)
  }
  return true
}

import { gcdGet } from './client.js'
import { upsertHeroIssues } from '../hero/issuesService.js'
import { getExistingGcdIssueIds, insertHeroTimelineEntries } from '../hero/timelineService.js'
import { mapIssueToTimelineEntry, extractIssueIdFromUrl } from './issueMapper.js'

const parseSeriesId = (value) => {
  const numeric = Number(value)
  if (Number.isNaN(numeric) || numeric <= 0) {
    throw new Error('A valid seriesId is required.')
  }
  return numeric
}

const fetchSeriesDetail = async (seriesId) => {
  return gcdGet(`series/${seriesId}/`)
}

const fetchIssue = async (issueUrl) => {
  return gcdGet(issueUrl)
}

const resolveIssueIdentifier = (issue) => {
  const identifier = issue?.id ?? extractIssueIdFromUrl(issue?.api_url)
  return identifier === undefined || identifier === null ? null : String(identifier)
}

export const syncSeriesIssuesForHero = async ({
  hero,
  seriesId,
  limit = 50,
  offset = 0,
  issueUrlsOverride = null,
  directOnly = false,
  skipNewsstand = true,
}) => {
  if (!hero?.api_id) {
    throw new Error('Hero information is required.')
  }
  const normalizedSeriesId = parseSeriesId(seriesId)

  let issueUrls = issueUrlsOverride
  let nextOffset = null

  if (!issueUrls) {
    const seriesDetail = await fetchSeriesDetail(normalizedSeriesId)
    const allIssueUrls = seriesDetail?.active_issues ?? []
    const descriptors = seriesDetail?.issue_descriptors ?? []

    if (!allIssueUrls.length) {
      return {
        hero,
        seriesId: normalizedSeriesId,
        fetchedIssues: 0,
        upsertedIssues: 0,
        timelineInserted: 0,
        nextOffset: null,
      }
    }

    const filteredPairs = allIssueUrls
      .map((url, index) => ({ url, descriptor: descriptors[index] }))
      .filter((pair) => descriptorAllowed(pair.descriptor, { directOnly, skipNewsstand }))
    if (!filteredPairs.length) {
      return {
        hero,
        seriesId: normalizedSeriesId,
        fetchedIssues: 0,
        upsertedIssues: 0,
        timelineInserted: 0,
        nextOffset: null,
      }
    }

    const boundedOffset = Math.max(0, Math.min(offset, filteredPairs.length - 1))
    const slice = filteredPairs.slice(boundedOffset, boundedOffset + limit)
    issueUrls = slice.map((pair) => pair.url)
    nextOffset = boundedOffset + slice.length >= filteredPairs.length ? null : boundedOffset + slice.length
  }

  if (!issueUrls.length) {
    return {
      hero,
      seriesId: normalizedSeriesId,
      fetchedIssues: 0,
      upsertedIssues: 0,
      timelineInserted: 0,
      nextOffset,
    }
  }

  const issuesBuffer = []
  const newTimelineEntries = []
  // Deduplicate against existing rows and against duplicate ids in the same sync batch.
  const existingIds = await getExistingGcdIssueIds(hero.api_id)

  for (const issueUrl of issueUrls) {
    const issue = await fetchIssue(issueUrl)
    issuesBuffer.push(issue)
    const identifier = resolveIssueIdentifier(issue)
    const alreadyExists = identifier ? existingIds.has(identifier) : false
    if (!alreadyExists) {
      const timelineEntry = mapIssueToTimelineEntry(issue)
      if (timelineEntry) {
        newTimelineEntries.push(timelineEntry)
        if (identifier) {
          existingIds.add(identifier)
        }
      }
    }
  }

  const heroIssues = await upsertHeroIssues(hero.api_id, issuesBuffer)
  const insertedTimelineEntries = newTimelineEntries.length
    ? await insertHeroTimelineEntries(hero.api_id, newTimelineEntries)
    : []

  return {
    hero,
    seriesId: normalizedSeriesId,
    fetchedIssues: issuesBuffer.length,
    upsertedIssues: heroIssues.length,
    timelineInserted: insertedTimelineEntries.length ?? 0,
    nextOffset,
  }
}







