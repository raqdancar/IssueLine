import { environment } from '../../config/environment.js'

const minuteWindowMs = 60 * 1000
const perMinuteTimestamps = []

let currentDayKey = new Date().toISOString().slice(0, 10)
let dayCount = 0

const pruneMinuteWindow = (now) => {
  while (perMinuteTimestamps.length && now - perMinuteTimestamps[0] > minuteWindowMs) {
    perMinuteTimestamps.shift()
  }
}

const ensureDayWindow = (now) => {
  const todayKey = new Date(now).toISOString().slice(0, 10)
  if (todayKey !== currentDayKey) {
    currentDayKey = todayKey
    dayCount = 0
  }
}

export const registerGcdRequest = (label) => {
  const now = Date.now()
  pruneMinuteWindow(now)
  perMinuteTimestamps.push(now)
  ensureDayWindow(now)
  dayCount += 1

  const perMinuteCount = perMinuteTimestamps.length
  const perMinuteSoft = environment.gcd.rateLimitSoftPerMinute
  const perMinuteHard = environment.gcd.rateLimitHardPerMinute
  const perDaySoft = environment.gcd.rateLimitSoftPerDay
  const perDayHard = environment.gcd.rateLimitHardPerDay

  if (perMinuteCount >= perMinuteHard) {
    throw new Error(
      `GCD minute limit reached (${perMinuteCount}/${perMinuteHard}). Wait before retrying.`
    )
  }

  if (dayCount >= perDayHard) {
    throw new Error(
      `GCD daily limit reached (${dayCount}/${perDayHard}). Pause ingestion for the day.`
    )
  }

  if (perMinuteCount >= perMinuteSoft) {
    console.warn(
      `[gcd] Warning: ${perMinuteCount} requests/min (soft ${perMinuteSoft}). Consider pausing until the next minute.`
    )
  }

  if (dayCount >= perDaySoft) {
    console.warn(
      `[gcd] Warning: ${dayCount} requests today (soft ${perDaySoft}). Approaching daily quota.`
    )
  }

  console.log(
    `[gcd] ${label ?? 'request'} @ ${new Date(now).toISOString()} (minute=${perMinuteCount}, day=${dayCount})`
  )
}
