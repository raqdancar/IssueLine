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

export const markStageIssuesRead = async ({ heroSlug, heroApiId, stageKey, accessToken }) => {
  if (!backendBaseUrl || !accessToken) {
    throw new Error('Missing backend configuration or authentication.')
  }
  if (!stageKey) {
    throw new Error('Stage key is required.')
  }
  if (!heroSlug && !heroApiId) {
    throw new Error('Provide a hero slug or identifier.')
  }

  const body = {
    stageKey,
  }
  if (heroSlug) {
    body.heroSlug = heroSlug
  } else if (heroApiId) {
    body.heroApiId = heroApiId
  }

  const response = await fetch(`${backendBaseUrl}/issue-states/stages/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return handleResponse(response)
}

export const toggleCollectedEditionOwnership = async ({ heroSlug, heroApiId, collectedEditionId, haveIt, accessToken }) => {
  if (!backendBaseUrl || !accessToken) {
    throw new Error('Missing backend configuration or authentication.')
  }
  if (!collectedEditionId) {
    throw new Error('Collected edition id is required.')
  }
  if (!heroSlug && !heroApiId) {
    throw new Error('Provide a hero slug or identifier.')
  }

  const body = {
    collectedEditionId,
    haveIt: Boolean(haveIt),
  }
  if (heroSlug) {
    body.heroSlug = heroSlug
  } else if (heroApiId) {
    body.heroApiId = heroApiId
  }

  const response = await fetch(`${backendBaseUrl}/issue-states/collected-editions/ownership`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return handleResponse(response)
}
