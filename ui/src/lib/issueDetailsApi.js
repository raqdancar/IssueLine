// Provide the issueDetailsApi shared library helpers.
import { backendBaseUrl } from '@/utils/backend.js'

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error || `Request failed with status ${response.status}`
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return payload
}

export const fetchIssueDetails = async ({ heroSlug, issueId, signal }) => {
  if (!backendBaseUrl || !heroSlug || !issueId) {
    throw new Error('Missing backend configuration or issue identifier.')
  }

  const response = await fetch(
    `${backendBaseUrl}/hero-timelines/${encodeURIComponent(heroSlug)}/issues/${encodeURIComponent(issueId)}`,
    { signal }
  )

  return parseResponse(response)
}
