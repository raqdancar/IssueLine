// Build timeline inclusion plans that filter duplicate and variant-like issue entries.
const VARIANT_TAG_REGEX =
  /\b(variant|cover\s*[b-z]|alt(\.|ernate)?\s*cover|2nd\s*print|3rd\s*print|second\s*print(ing)?|third\s*print(ing)?|printing|newsstand|direct\s*edition|incentive)\b/i

const normalizeIssueToken = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return null
  return normalized.replace(/[^a-z0-9]+/g, '')
}

const buildCanonicalGroupKey = (entry) => {
  const metadata = entry.metadata ?? {}
  const numberToken = normalizeIssueToken(metadata.number ?? entry.issueCode)
  const issueDateToken = entry.issueDate ?? metadata.keyDate ?? metadata.onSaleDate ?? metadata.publicationDate ?? 'no-date'
  const seriesToken = normalizeIssueToken(metadata.seriesName ?? metadata.series_name) ?? 'unknown-series'
  const issueToken = numberToken ?? normalizeIssueToken(metadata.gcdIssueId) ?? 'unknown-issue'
  return `${seriesToken}::${issueToken}::${issueDateToken}`
}

const detectVariantTag = (entry) => {
  const metadata = entry.metadata ?? {}
  const descriptor = String(metadata.issueLabel ?? '')
  const issueCode = String(entry.issueCode ?? '')
  const headline = String(entry.headline ?? '')
  const joined = [descriptor, issueCode, headline].join(' ')
  return VARIANT_TAG_REGEX.test(joined)
}

const scoreTimelineEntry = (entry) => {
  let score = 0
  const metadata = entry.metadata ?? {}
  if (!detectVariantTag(entry)) score += 50
  if (entry.issueDate) score += 20
  if (metadata.gcdIssueId) score += 10
  if (metadata.coverImagePath || metadata.cover_image_path) score += 2
  if (metadata.cover) score += 1
  return score
}

/**
 * Filters timeline candidates by variant/duplicate-publication rules.
 * Returns both selected rows and excluded rows for reporting/auditing.
 */
export const buildTimelineVisibilityPlan = ({ entries, excludeVariantsFromTimeline }) => {
  const normalizedEntries = Array.isArray(entries) ? entries.filter(Boolean) : []

  if (!excludeVariantsFromTimeline) {
    return {
      selectedEntries: normalizedEntries,
      excludedEntries: [],
      variantFilteringApplied: false,
    }
  }

  const grouped = new Map()
  const selectedEntries = []
  const excludedEntries = []

  // Group possible duplicates by canonical series/issue/date identity.
  for (const entry of normalizedEntries) {
    if (detectVariantTag(entry)) {
      excludedEntries.push(entry)
      continue
    }

    const key = buildCanonicalGroupKey(entry)
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key).push(entry)
  }

  for (const groupEntries of grouped.values()) {
    if (groupEntries.length === 1) {
      selectedEntries.push(groupEntries[0])
      continue
    }

    const ranked = [...groupEntries].sort((a, b) => {
      const scoreDelta = scoreTimelineEntry(b) - scoreTimelineEntry(a)
      if (scoreDelta !== 0) return scoreDelta
      const gcdA = Number(a.metadata?.gcdIssueId ?? 0)
      const gcdB = Number(b.metadata?.gcdIssueId ?? 0)
      return gcdA - gcdB
    })

    selectedEntries.push(ranked[0])
    excludedEntries.push(...ranked.slice(1))
  }

  return {
    selectedEntries,
    excludedEntries,
    variantFilteringApplied: true,
  }
}

