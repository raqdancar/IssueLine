import { backendBaseUrl } from '@/utils/backend.js'

const buildQueryString = (params) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, value)
  })
  return search.toString()
}

const handleResponse = async (response) => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error || `Request failed with status ${response.status}`
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return payload
}

export const fetchIssueStates = async ({ heroSlug, accessToken }) => {
  if (!backendBaseUrl || !heroSlug || !accessToken) {
    return []
  }

  const query = buildQueryString({ heroSlug })
  const response = await fetch(`${backendBaseUrl}/issue-states?${query}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const payload = await handleResponse(response)
  return payload.states ?? []
}

export const patchIssueState = async ({ issueId, patch, accessToken }) => {
  if (!backendBaseUrl || !issueId || !accessToken) {
    throw new Error('Missing backend configuration or authentication.')
  }

  const response = await fetch(`${backendBaseUrl}/issue-states/${issueId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  })

  return handleResponse(response)
}
