// Centralize backend reads for hero timeline payloads.
import { parseJsonResponse } from '@/lib/httpClient.js'
import { backendBaseUrl } from '@/utils/backend.js'

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
