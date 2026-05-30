// Centralitza la configuracio d'entorn utilitzada pel backend.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../../../')

dotenv.config({ path: path.resolve(repoRoot, '.env') })

const throwIfMissing = (value, name) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL

const gcdBaseUrl = throwIfMissing(process.env.GCD_BASE_URL ?? 'https://www.comics.org', 'GCD_BASE_URL')
const gcdUsername = process.env.GCD_USERNAME
const gcdPassword = process.env.GCD_PASSWORD
const gcdSessionId = process.env.GCD_SESSIONID
const gcdConnectTimeout = Number(process.env.GCD_CONNECT_TIMEOUT ?? '15000')
const rawGcdForceIpv4 = process.env.GCD_FORCE_IPV4
const gcdForceIpv4 =
  rawGcdForceIpv4 === undefined ? true : rawGcdForceIpv4.toLowerCase() === 'true' || rawGcdForceIpv4 === '1'

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

const gcdAllowManualSync = parseBoolean(process.env.GCD_ALLOW_MANUAL_SYNC, false)
const gcdSoftLimitPerMinute = Number(process.env.GCD_SOFT_LIMIT_PER_MIN ?? '18')
const gcdHardLimitPerMinute = Number(process.env.GCD_HARD_LIMIT_PER_MIN ?? '20')
const gcdSoftLimitPerDay = Number(process.env.GCD_SOFT_LIMIT_PER_DAY ?? '9500')
const gcdHardLimitPerDay = Number(process.env.GCD_HARD_LIMIT_PER_DAY ?? '10000')
const gcdSeriesCacheTtlMs = Number(process.env.GCD_SERIES_CACHE_TTL_MS ?? String(6 * 60 * 60 * 1000))
const allowedOrigins = (process.env.BACKEND_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const allowedOriginPatterns = (process.env.BACKEND_ALLOWED_ORIGIN_PATTERNS ?? '')
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean)

// GCD is mostly public, but allow optional credentials/session when rate limits require it.

export const environment = {
  supabaseUrl: throwIfMissing(supabaseUrl, 'SUPABASE_URL or VITE_SUPABASE_URL'),
  supabaseServiceKey: throwIfMissing(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
  bucketName: process.env.HERO_IMAGE_BUCKET ?? 'hero-images',
  maxImagesPerHero: Number(process.env.HERO_IMAGE_MAX_PER_HERO ?? '3'),
  serverHost: process.env.BACKEND_HOST ?? '0.0.0.0',
  serverPort: Number(process.env.PORT ?? process.env.BACKEND_PORT ?? '4600'),
  allowedOrigins,
  allowedOriginPatterns,
  gcd: {
    baseUrl: new URL('/api/', gcdBaseUrl).toString(),
    username: gcdUsername,
    password: gcdPassword,
    sessionId: gcdSessionId,
    connectTimeout: gcdConnectTimeout,
    forceIpv4: gcdForceIpv4,
    allowManualSync: gcdAllowManualSync,
    rateLimitSoftPerMinute: gcdSoftLimitPerMinute,
    rateLimitHardPerMinute: gcdHardLimitPerMinute,
    rateLimitSoftPerDay: gcdSoftLimitPerDay,
    rateLimitHardPerDay: gcdHardLimitPerDay,
    seriesCacheTtlMs: gcdSeriesCacheTtlMs,
  },
}
