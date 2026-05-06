// Provide shared helpers for JSON HTTP requests to backend endpoints.

const buildRequestError = (payload, response) => {
  const message = payload?.error || `Request failed with status ${response.status}`
  const error = new Error(message)
  error.status = response.status
  return error
}

export const parseJsonResponse = async (response) => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw buildRequestError(payload, response)
  }
  return payload
}
