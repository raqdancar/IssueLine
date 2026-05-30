// Agrupa funcions compartides per accedir a dades i normalitzar informacio.
import { backendBaseUrl } from '@/utils/backend.js'
import { parseJsonResponse } from '@/lib/httpClient.js'

export const fetchIssueDetails = async ({ heroSlug, issueId, signal }) => {
  if (!backendBaseUrl || !heroSlug || !issueId) {
    throw new Error('Missing backend configuration or issue identifier.')
  }

  const response = await fetch(
    `${backendBaseUrl}/hero-timelines/${encodeURIComponent(heroSlug)}/issues/${encodeURIComponent(issueId)}`,
    { signal }
  )

  return parseJsonResponse(response)
}
