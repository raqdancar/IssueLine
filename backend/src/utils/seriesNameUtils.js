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

  const override = SERIES_NAME_OVERRIDES.get(trimmed)
  if (override) {
    return override
  }

  return trimmed
}

export const coerceSeriesSlugSource = (value) => {
  const normalized = normalizeSeriesName(value)
  return normalized ?? value ?? ''
}
