// Normalize series names into stable labels used across timeline and import flows.
// Override verbose upstream series titles with compact canonical labels.
const SERIES_NAME_OVERRIDES = new Map([
  ['Doctor Strange (1968 series)', 'Doctor Strange 1968'],
  ['Doctor Strange (1974 series)', 'Doctor Strange 1974'],
])

export const normalizeSeriesName = (value) => {
  if (value === null || value === undefined) {
    return value ?? null
  }

  const trimmed = String(value).trim()
  if (!trimmed) {
    return ''
  }

  // Apply explicit aliases before returning passthrough values.
  const override = SERIES_NAME_OVERRIDES.get(trimmed)
  if (override) {
    return override
  }

  return trimmed
}

export const coerceSeriesSlugSource = (value) => {
  // Always return a string so slug builders can operate without extra guards.
  const normalized = normalizeSeriesName(value)
  return normalized ?? value ?? ''
}
