// Agrupa funcions compartides per accedir a dades i normalitzar informacio.
import { sanitizeMojibakeDeep } from '@/lib/textSanitizer.js'

const buildRequestError = (payload, response) => {
  const message = payload?.error || `Request failed with status ${response.status}`
  const error = new Error(message)
  error.status = response.status
  return error
}

export const parseJsonResponse = async (response) => {
  const payload = sanitizeMojibakeDeep(await response.json().catch(() => ({})))
  if (!response.ok) {
    throw buildRequestError(payload, response)
  }
  return payload
}
