import { Agent, fetch, Headers, Request, Response } from 'undici'
import { environment } from '../../config/environment.js'
import { registerGcdRequest } from './requestTracker.js'

if (!globalThis.fetch) {
  globalThis.fetch = fetch
}
if (!globalThis.Headers) {
  globalThis.Headers = Headers
}
if (!globalThis.Request) {
  globalThis.Request = Request
}
if (!globalThis.Response) {
  globalThis.Response = Response
}

const gcdAgent = new Agent({
  connect: {
    timeout: environment.gcd.connectTimeout,
    ...(environment.gcd.forceIpv4 ? { family: 4 } : {}),
  },
})

const {
  baseUrl: gcdApiBase,
  username: gcdUsername,
  password: gcdPassword,
  sessionId: gcdSessionId,
} = environment.gcd

const basicToken =
  gcdUsername && gcdPassword ? Buffer.from(`${gcdUsername}:${gcdPassword}`).toString('base64') : null

const defaultHeaders = {
  Accept: 'application/json',
  'User-Agent': 'issueline-srv/0.2.0',
}

const buildAuthHeaders = () => {
  if (basicToken) {
    return { Authorization: `Basic ${basicToken}` }
  }
  if (gcdSessionId) {
    return { Cookie: `sessionid=${gcdSessionId}` }
  }
  return {}
}

const ABSOLUTE_URL_REGEX = /^https?:\/\//i

const createUrl = (path, search) => {
  let url
  if (ABSOLUTE_URL_REGEX.test(path)) {
    url = new URL(path)
  } else {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path
    url = new URL(normalizedPath, gcdApiBase)
  }
  if (search) {
    Object.entries(search).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      url.searchParams.set(key, String(value))
    })
  }
  if (!url.searchParams.has('format')) {
    url.searchParams.set('format', 'json')
  }
  return url
}

export const gcdGet = async (path, { search, headers, signal } = {}) => {
  const url = createUrl(path, search)
  registerGcdRequest(url.pathname)
  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        ...defaultHeaders,
        ...buildAuthHeaders(),
        ...headers,
      },
      signal,
      dispatcher: gcdAgent,
    })
  } catch (error) {
    throw new Error(`Failed to reach GCD API: ${error.message}`)
  }

  if (!response.ok) {
    const body = await safeParseJson(response)
    const detail = body?.detail ?? body?.error ?? JSON.stringify(body)
    throw new Error(`GCD API error (${response.status}): ${detail}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

const safeParseJson = async (response) => {
  try {
    return await response.clone().json()
  } catch {
    return null
  }
}
