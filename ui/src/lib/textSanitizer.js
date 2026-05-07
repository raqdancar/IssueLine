// Normalize common mojibake artifacts coming from mixed text encodings.

const hasMojibakeMarkers = (value) => /[ÃÂâ\uFFFD]/.test(value)

const canDecodeAsLatin1Bytes = (value) => {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0xff) return false
  }
  return true
}

const decodeLatin1AsUtf8 = (value) => {
  if (typeof TextDecoder === 'undefined') return value
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return value
  }
}

const manualReplacements = [
  ['â€¢', '•'],
  ['â€”', '—'],
  ['â€“', '–'],
  ['â€˜', '‘'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€\u009d', '”'],
  ['â€¦', '…'],
]

export const sanitizeMojibakeText = (value) => {
  if (typeof value !== 'string' || !value) return value

  let normalized = value

  if (hasMojibakeMarkers(normalized) && canDecodeAsLatin1Bytes(normalized)) {
    const decoded = decodeLatin1AsUtf8(normalized)
    if (decoded && decoded !== normalized) {
      normalized = decoded
    }
  }

  manualReplacements.forEach(([from, to]) => {
    normalized = normalized.split(from).join(to)
  })

  // Remove stray "Â" artifacts and replace unknown replacement chars with a readable dash.
  normalized = normalized.replace(/Â/g, '').replace(/\uFFFD/g, '-')

  return normalized
}

export const sanitizeMojibakeDeep = (input, seen = new WeakMap()) => {
  if (typeof input === 'string') return sanitizeMojibakeText(input)
  if (input === null || input === undefined) return input
  if (typeof input !== 'object') return input
  if (input instanceof Date) return input

  if (seen.has(input)) return seen.get(input)

  if (Array.isArray(input)) {
    const nextArray = []
    seen.set(input, nextArray)
    input.forEach((item, index) => {
      nextArray[index] = sanitizeMojibakeDeep(item, seen)
    })
    return nextArray
  }

  const nextObject = {}
  seen.set(input, nextObject)
  Object.entries(input).forEach(([key, value]) => {
    nextObject[key] = sanitizeMojibakeDeep(value, seen)
  })
  return nextObject
}
