// Provide the numberFormatters utility helpers.
export const normalizeIntegerText = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalized =
    typeof value === 'string'
      ? value
          .trim()
          // Remove comma thousands separators while keeping decimals.
          .replace(/,/g, '')
      : value

  const parsed = Number(normalized)
  if (Number.isFinite(parsed)) {
    return String(Math.round(parsed))
  }

  if (typeof value === 'string') {
    const match = value.match(/\d+/)
    return match ? match[0] : value
  }

  return value
}
