// Retry GCD requests on minute limits with configurable backoff and attempt caps.
import { setTimeout as delay } from 'node:timers/promises'
import { gcdGet } from '../client.js'

const MINUTE_LIMIT_REGEX = /GCD minute limit reached \((\d+)\/(\d+)\)/i
const DAILY_LIMIT_REGEX = /GCD daily limit reached/i
const DEFAULT_WAIT_MS = Number(process.env.GCD_MINUTE_RETRY_WAIT_MS ?? '61000')
const DEFAULT_MAX_RETRIES = Number(process.env.GCD_MINUTE_RETRY_MAX ?? '10')

const isMinuteLimitError = (error) => MINUTE_LIMIT_REGEX.test(String(error?.message ?? ''))
const isDailyLimitError = (error) => DAILY_LIMIT_REGEX.test(String(error?.message ?? ''))

const parseMinuteLimit = (error) => {
  const match = MINUTE_LIMIT_REGEX.exec(String(error?.message ?? ''))
  if (!match) return null
  return {
    count: Number(match[1]),
    hardLimit: Number(match[2]),
  }
}

/**
 * Executes gcdGet and retries when minute rate limit is reached.
 */
export const gcdGetWithRateLimitRetry = async (
  path,
  {
    logger = console,
    maxRetries = DEFAULT_MAX_RETRIES,
    waitMs = DEFAULT_WAIT_MS,
    search,
    headers,
    signal,
    label = null,
  } = {}
) => {
  let attempts = 0
  let pauses = 0
  let waitedMs = 0

  while (true) {
    try {
      const data = await gcdGet(path, { search, headers, signal })
      return {
        data,
        attempts,
        pauses,
        waitedMs,
      }
    } catch (error) {
      if (isDailyLimitError(error)) {
        throw error
      }

      if (!isMinuteLimitError(error)) {
        throw error
      }

      // Stop retrying when callers hit their configured cap.
      if (attempts >= maxRetries) {
        throw new Error(
          `Rate-limit retry budget exhausted for ${label ?? path} after ${attempts} retries: ${error.message}`
        )
      }

      const detail = parseMinuteLimit(error)
      const waitSeconds = Math.ceil(waitMs / 1000)
      logger.warn(
        `[gcd-import] minute limit hit for ${label ?? path}` +
          `${detail ? ` (${detail.count}/${detail.hardLimit})` : ''}. ` +
          `Waiting ${waitSeconds}s before retry ${attempts + 1}/${maxRetries}...`
      )

      attempts += 1
      pauses += 1
      waitedMs += waitMs
      await delay(waitMs)
    }
  }
}

