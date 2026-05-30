// Dona suport al flux CLI que vincula recopilatoris amb issues individuals.
const parsePositiveInteger = (value) => {
  const numeric = Number(value)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return null
  return numeric
}

const expandRange = (fromValue, toValue) => {
  const from = parsePositiveInteger(fromValue)
  const to = parsePositiveInteger(toValue)
  if (!from || !to || to < from) return null
  const values = []
  for (let current = from; current <= to; current += 1) {
    values.push(current)
  }
  return values
}

export const parseNumericSelector = (value) => {
  const source = String(value ?? '').trim()
  if (!source) return null

  const output = new Set()
  const tokens = source
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)

  if (!tokens.length) return null

  for (const token of tokens) {
    if (token.includes('-')) {
      // Expand numeric ranges like "10-14" into explicit ids.
      const [fromValue, toValue] = token.split('-').map((part) => part.trim())
      const rangeValues = expandRange(fromValue, toValue)
      if (!rangeValues) return null
      rangeValues.forEach((item) => output.add(item))
      continue
    }

    const numeric = parsePositiveInteger(token)
    if (!numeric) return null
    output.add(numeric)
  }

  return Array.from(output).sort((a, b) => a - b)
}
