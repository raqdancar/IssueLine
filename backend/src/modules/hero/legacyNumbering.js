// Gestiona dades de personatges, imatges i cronologies dins del backend.
const legacySeriesRules = [
  {
    test: (row) => row.series_name === 'Doctor Strange (2018 series)',
    base: 390,
    start: 1,
  },
  {
    test: (row) => row.series_name === 'Dr. Strange (2020 series)',
    base: 410,
    start: 1,
  },
]

const extractLegacyFromNotes = (notes) => {
  if (!notes || typeof notes !== 'string') return null
  const normalized = notes.replace(/\s+/g, ' ').trim()
  const legacyPattern = /Legacy(?:\s+numbering)?/gi
  let match
  // Scan every "Legacy" mention because notes can include multiple numbered references.
  while ((match = legacyPattern.exec(normalized))) {
    const snippet = normalized.slice(match.index + match[0].length, match.index + match[0].length + 80)
    const numberMatch = snippet.match(/(\d{1,4})/)
    if (numberMatch) {
      const value = Number(numberMatch[1])
      if (Number.isFinite(value)) {
        return value
      }
    }
  }
  return null
}

export const resolveLegacyNumber = (row) => {
  if (!row) return null
  const notesLegacy = extractLegacyFromNotes(row.raw?.notes)
  if (notesLegacy) return notesLegacy

  const numericNumber = Number(row.number)
  if (!Number.isFinite(numericNumber)) {
    return null
  }

  for (const rule of legacySeriesRules) {
    if (rule.test(row)) {
      const base = Number(rule.base ?? 0)
      const start = Number(rule.start ?? 1)
      if (!Number.isFinite(base) || !Number.isFinite(start)) {
        continue
      }
      const legacy = base + (numericNumber - start + 1)
      if (Number.isFinite(legacy)) {
        return legacy
      }
    }
  }

  return null
}


