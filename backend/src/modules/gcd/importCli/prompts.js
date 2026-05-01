// Collect and validate interactive answers for batch GCD series import scripts.
import process from 'node:process'
import { createInterface } from 'node:readline/promises'

const YES_VALUES = new Set(['y', 'yes'])
const NO_VALUES = new Set(['n', 'no'])

const parseYesNo = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  if (YES_VALUES.has(normalized)) return true
  if (NO_VALUES.has(normalized)) return false
  return null
}

const parseSeriesId = (value) => {
  const normalized = String(value ?? '').trim()
  if (!/^\d+$/.test(normalized)) {
    return null
  }
  const numeric = Number(normalized)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    return null
  }
  return numeric
}

const parseFolderName = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
  if (!normalized) return null
  if (normalized.includes('..')) return null
  if (!/^[a-zA-Z0-9/_-]+$/.test(normalized)) return null
  return normalized
}

const parseHeroSlug = (value) => {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase()
  if (!/^[a-z0-9-]+$/.test(normalized)) return null
  return normalized
}

const askUntilValid = async ({ rl, question, parser, errorMessage }) => {
  // Keep prompting until parser confirms a safe/expected value.
  while (true) {
    const answer = await rl.question(question)
    const parsed = parser(answer)
    if (parsed !== null && parsed !== undefined) {
      return parsed
    }
    console.log(errorMessage)
  }
}

const askOptionalUntilValid = async ({ rl, question, parser, errorMessage }) => {
  while (true) {
    const answer = await rl.question(question)
    if (!String(answer ?? '').trim()) {
      return null
    }
    const parsed = parser(answer)
    if (parsed !== null && parsed !== undefined) {
      return parsed
    }
    console.log(errorMessage)
  }
}

/**
 * Prompts the operator for GCD import parameters.
 */
export const promptImportConfig = async ({ heroSlugOverride: preselectedHeroSlugOverride = null } = {}) => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const seriesId = await askUntilValid({
      rl,
      question: 'Enter GCD series ID: ',
      parser: parseSeriesId,
      errorMessage: 'Please enter a positive numeric GCD series ID.',
    })

    const heroSlugOverride =
      preselectedHeroSlugOverride ??
      (await askOptionalUntilValid({
        rl,
        question: 'Optional: enter hero slug override (press Enter to auto-resolve): ',
        parser: parseHeroSlug,
        errorMessage: 'Hero slug can contain lowercase letters, numbers, and hyphens only.',
      }))

    const excludeVariantsFromTimeline = await askUntilValid({
      rl,
      question: 'Exclude variant-cover items from public timeline? (y/n): ',
      parser: parseYesNo,
      errorMessage: 'Please answer with y or n.',
    })

    const coversAvailable = await askUntilValid({
      rl,
      question: 'Are cover images already uploaded to the correct bucket? (y/n): ',
      parser: parseYesNo,
      errorMessage: 'Please answer with y or n.',
    })

    let coversFolderName = null
    if (coversAvailable) {
      coversFolderName = await askUntilValid({
        rl,
        question: 'Enter cover folder (preferred: relative folder under /covers/<hero-slug>): ',
        parser: parseFolderName,
        errorMessage:
          'Please provide a valid folder path using letters, numbers, "-", "_" or "/" and no "..".',
      })
    }

    return {
      seriesId,
      heroSlugOverride,
      excludeVariantsFromTimeline,
      coversAvailable,
      coversFolderName,
    }
  } finally {
    rl.close()
  }
}
