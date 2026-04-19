export const parseGcdIssueIdentifier = (value) => {
  const input = String(value ?? '').trim()
  if (!input) return null

  if (/^\d+$/.test(input)) {
    const numeric = Number(input)
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
  }

  const fromUrl = /\/issue\/(\d+)\//i.exec(input)
  if (fromUrl) {
    const numeric = Number(fromUrl[1])
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
  }

  return null
}

export const normalizeGcdIssueIdInput = (value) => {
  const parsed = parseGcdIssueIdentifier(value)
  if (parsed === null) {
    const input = String(value ?? '').trim()
    if (!input) {
      throw new Error('GCD issue ID is required.')
    }
    if (/^\d+$/.test(input) && Number(input) <= 0) {
      throw new Error('GCD issue ID must be a positive integer.')
    }
    throw new Error('Invalid GCD issue identifier. Use numeric ID or /issue/<id>/ URL.')
  }
  return parsed
}

