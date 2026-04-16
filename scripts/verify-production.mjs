#!/usr/bin/env node

const backendBaseUrl = process.env.PROD_BACKEND_URL || process.env.VITE_BACKEND_URL
const frontendBaseUrl = process.env.PROD_FRONTEND_URL || process.env.VERCEL_URL
const timeoutMs = Number(process.env.PROD_TIMEOUT_MS || 15000)

const errors = []

const normalizeUrl = (value) => {
  if (!value) return null
  try {
    return new URL(value).toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

const backendUrl = normalizeUrl(backendBaseUrl)
const frontendUrl = normalizeUrl(frontendBaseUrl)

if (!backendUrl) {
  errors.push('Missing PROD_BACKEND_URL (or VITE_BACKEND_URL) with a valid absolute URL.')
}

if (!frontendUrl) {
  errors.push('Missing PROD_FRONTEND_URL (or VERCEL_URL) with a valid absolute URL.')
}

if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
  errors.push('PROD_TIMEOUT_MS must be a number >= 1000.')
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const check = async (name, fn) => {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`)
    process.exitCode = 1
  }
}

const fetchWithTimeout = async (url, options = {}) => {
  const signal = AbortSignal.timeout(timeoutMs)
  const response = await fetch(url, { ...options, signal })
  return response
}

await check('Backend health endpoint', async () => {
  const url = `${backendUrl}/health`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Expected 2xx from ${url}, got ${response.status}`)
  }
  const body = await response.json()
  if (body.status !== 'ok') {
    throw new Error(`Expected {"status":"ok"} body, got ${JSON.stringify(body)}`)
  }
})

await check('Backend CORS for frontend origin', async () => {
  const url = `${backendUrl}/health`
  const response = await fetchWithTimeout(url, {
    method: 'OPTIONS',
    headers: {
      Origin: frontendUrl,
      'Access-Control-Request-Method': 'GET',
    },
  })
  if (response.status >= 500) {
    throw new Error(`OPTIONS ${url} returned ${response.status}`)
  }
  const allowedOrigin = response.headers.get('access-control-allow-origin')
  if (!allowedOrigin) {
    throw new Error('Missing access-control-allow-origin header.')
  }
  if (allowedOrigin !== '*' && allowedOrigin !== frontendUrl) {
    throw new Error(`Unexpected access-control-allow-origin: ${allowedOrigin}`)
  }
})

await check('Frontend entrypoint', async () => {
  const response = await fetchWithTimeout(frontendUrl)
  if (!response.ok) {
    throw new Error(`Expected 2xx from ${frontendUrl}, got ${response.status}`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('text/html')) {
    throw new Error(`Expected text/html content-type, got "${contentType}"`)
  }
  const html = await response.text()
  if (!html.includes('id="root"') && !html.includes("id='root'")) {
    throw new Error('Could not find root element in HTML response.')
  }
})

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}

console.log('Production smoke checks completed successfully.')
