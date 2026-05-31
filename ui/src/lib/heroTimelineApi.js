// Agrupa funcions compartides per accedir a dades i normalitzar informacio.
import { parseJsonResponse } from '@/lib/httpClient.js'
import { backendBaseUrl } from '@/utils/backend.js'

/**
 * @typedef {Object} HeroTimelineEntry
 * @property {string} id
 * @property {string} issue_date
 * @property {string} headline
 * @property {string|null} [summary]
 * @property {string|null} [issue_code]
 * @property {string|null} [source_url]
 * @property {'issue'|'milestone'} [event_type]
 * @property {'info'|'success'|'warning'|'critical'} [severity]
 * @property {Record<string, unknown>|null} [metadata]
 * @property {number|null} [stage_id]
 * @property {number|string|null} [legacy_number]
 * @property {boolean|null} [special_issue]
 * @property {string|null} [created_at]
 */

/**
 * @typedef {Object} CollectedEditionIssue
 * @property {string|null} timelineIssueId
 * @property {string} heroIssueId
 * @property {number|null} gcdIssueId
 * @property {string|null} number
 * @property {number|null} sortNumber
 * @property {string|null} seriesName
 * @property {string|null} title
 * @property {string} label
 * @property {string|null} note
 * @property {string|null} stageKey
 * @property {string|null} stageName
 */

/**
 * @typedef {Object} CollectedEditionOverview
 * @property {string} id
 * @property {string} title
 * @property {string|null} [subtitle]
 * @property {string|null} [printLanguage]
 * @property {string|null} [publisher]
 * @property {string|null} [publicationDate]
 * @property {string} format
 * @property {string|null} [coverImageUrl]
 * @property {string|null} [source]
 * @property {string|null} [sourceExternalId]
 * @property {number|null} [sourceSeriesId]
 * @property {string|null} [isbn]
 * @property {number} issueCount
 * @property {CollectedEditionIssue[]} issues
 * @property {{key:string,name:string,count:number}[]} stages
 */

/**
 * @typedef {Object} HeroTimelinePayload
 * @property {{api_id:number,name:string,slug:string,publisher:string|null}} hero
 * @property {HeroTimelineEntry[]} entries
 * @property {CollectedEditionOverview[]} collectedEditionsOverview
 */

/**
 * @param {{slug:string, signal?:AbortSignal}} params
 * @returns {Promise<HeroTimelinePayload>}
 */
export const fetchHeroTimeline = async ({ slug, signal } = {}) => {
  if (!backendBaseUrl) {
    throw new Error('Backend URL is not configured.')
  }
  if (!slug) {
    throw new Error('Hero slug is required.')
  }

  const response = await fetch(`${backendBaseUrl}/hero-timelines/${encodeURIComponent(slug)}`, {
    signal,
  })
  return parseJsonResponse(response)
}
