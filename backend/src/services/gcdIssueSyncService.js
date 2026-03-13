import { gcdGet } from './gcdClient.js'
import { upsertHeroIssues } from './heroIssuesService.js'
import { getExistingGcdIssueIds, insertHeroTimelineEntries } from './heroTimelineService.js'
import { mapIssueToTimelineEntry } from './gcdIssueMapper.js'

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

export const syncSeriesIssuesForHero = async ({
  hero,
  seriesId,
  limit = 50,
  offset = 0,
  issueUrlsOverride = null,
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
      .filter((pair) => !/\[british]/i.test(pair.descriptor ?? ''))

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
  const existingIds = await getExistingGcdIssueIds(hero.api_id)

  for (const issueUrl of issueUrls) {
    const issue = await fetchIssue(issueUrl)
    issuesBuffer.push(issue)
    if (!existingIds.has(issue.id)) {
      const timelineEntry = mapIssueToTimelineEntry(issue)
      if (timelineEntry) {
        newTimelineEntries.push(timelineEntry)
        existingIds.add(issue.id)
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
