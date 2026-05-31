// Gestiona la integracio amb GCD i la normalitzacio de dades editorials.
import { gcdGet } from './client.js'
import { supabaseServiceClient } from '../../lib/supabaseClient.js'
import { normalizeCoverUrl } from './coverUtils.js'

const extractGcdIssueId = (metadata = {}) => {
  if (metadata.gcdIssueId) return Number(metadata.gcdIssueId)
  if (metadata.apiUrl) {
    const match = /\/issue\/(\d+)\//.exec(metadata.apiUrl)
    if (match) {
      return Number(match[1])
    }
  }
  return null
}

const needsCoverRefresh = (metadata = {}) => {
  const cover = metadata.cover || metadata.coverUrl || metadata.cover_url
  if (!cover) return true
  return /:\/\/[^/]+\/\//.test(cover)
}

const updateTimelineMetadata = async (timelineId, metadata) => {
  const { error } = await supabaseServiceClient
    .from('hero_timelines')
    .update({ metadata })
    .eq('id', timelineId)

  if (error) {
    throw new Error(`Failed to update hero timeline ${timelineId}: ${error.message}`)
  }
}

export const refreshHeroTimelineCovers = async ({ heroApiId, limit = 25 }) => {
  if (!heroApiId) {
    throw new Error('heroApiId is required to refresh covers.')
  }

  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, hero_issue_id, metadata')
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to load hero timeline entries: ${error.message}`)
  }

  const targets = []
  for (const row of data ?? []) {
    // Linked rows render canonical cover data from hero_issues. Refresh only legacy JSON copies.
    if (row.hero_issue_id) continue
    if (!row?.metadata || !needsCoverRefresh(row.metadata)) continue
    const gcdIssueId = extractGcdIssueId(row.metadata)
    if (!gcdIssueId) continue
    targets.push({ id: row.id, metadata: row.metadata, gcdIssueId })
    if (targets.length >= limit) break
  }

  const refreshed = []

  for (const entry of targets) {
    try {
      const issue = await gcdGet(`issue/${entry.gcdIssueId}/`)
      const coverOriginal = issue?.cover || entry.metadata.cover_original
      const cover = normalizeCoverUrl(coverOriginal)
      const updatedMetadata = {
        ...entry.metadata,
        cover_original: coverOriginal ?? entry.metadata.cover_original ?? null,
        cover: cover ?? entry.metadata.cover ?? null,
      }
      await updateTimelineMetadata(entry.id, updatedMetadata)
      refreshed.push({ timelineId: entry.id, gcdIssueId: entry.gcdIssueId })
    } catch (refreshError) {
      refreshed.push({ timelineId: entry.id, gcdIssueId: entry.gcdIssueId, error: refreshError.message })
    }
  }

  return {
    examined: data?.length ?? 0,
    attempted: targets.length,
    updated: refreshed.filter((item) => !item.error).length,
    results: refreshed,
  }
}

