// Collect and validate interactive answers for single-issue import scripts.
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { searchHeroes } from './heroSelectionService.js'
import { parseGcdIssueIdentifier } from './issueIdentifierUtils.js'

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

const parseFolderName = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
  if (!normalized) return null
  if (normalized.includes('..')) return null
  if (!/^[a-zA-Z0-9/_-]+$/.test(normalized)) return null
  return normalized
}

const askUntilValid = async ({ rl, question, parser, errorMessage }) => {
  // Re-prompt in place so import scripts do not continue with invalid input.
  while (true) {
    const answer = await rl.question(question)
    const parsed = parser(answer)
    if (parsed !== null && parsed !== undefined) {
      return parsed
    }
    console.log(errorMessage)
  }
}

const printHeroes = (heroes) => {
  console.log('\nHeroes:')
  heroes.forEach((hero, index) => {
    console.log(`  ${index + 1}. ${hero.name} (slug=${hero.slug ?? 'n/a'}, api_id=${hero.api_id})`)
  })
}

const askHeroSelection = async (rl) => {
  let query = ''
  while (true) {
    const heroes = await searchHeroes({ query, limit: 20 })
    if (!heroes.length) {
      console.log('No heroes matched this search. Try another filter.')
      query = await rl.question('Search heroes by name/slug: ')
      continue
    }

    printHeroes(heroes)
    const selection = await rl.question(
      '\nSelect hero by number, or type "s" to search again: '
    )
    const normalized = selection.trim().toLowerCase()
    if (normalized === 's' || normalized === 'search') {
      query = await rl.question('Search heroes by name/slug: ')
      continue
    }

    const numeric = Number(selection)
    if (!Number.isSafeInteger(numeric) || numeric < 1 || numeric > heroes.length) {
      console.log('Invalid selection. Choose a listed number or type "s" to search.')
      continue
    }

    return heroes[numeric - 1]
  }
}

/**
 * Prompts operator for single-issue import config.
 */
export const promptSingleIssueImportConfig = async ({
  preselectedHero = null,
  preselectedGcdIssueId = null,
  preselectedIncludeInTimeline = null,
  preselectedCoversAvailable = null,
  preselectedCoversFolderName = null,
} = {}) => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const hero = preselectedHero ?? (await askHeroSelection(rl))

    const gcdIssueId =
      preselectedGcdIssueId ??
      (await askUntilValid({
        rl,
        question: '\nEnter GCD issue code/ID (numeric id or issue URL): ',
        parser: parseGcdIssueIdentifier,
        errorMessage: 'Please enter a valid positive GCD issue ID or a valid /issue/<id>/ URL.',
      }))

    const includeInTimeline =
      preselectedIncludeInTimeline ??
      (await askUntilValid({
        rl,
        question: 'Should this issue be visible in hero timeline now? (y/n): ',
        parser: parseYesNo,
        errorMessage: 'Please answer with y or n.',
      }))

    const coversAvailable =
      preselectedCoversAvailable ??
      (await askUntilValid({
        rl,
        question: 'Are cover images already uploaded to the correct bucket? (y/n): ',
        parser: parseYesNo,
        errorMessage: 'Please answer with y or n.',
      }))

    let coversFolderName = preselectedCoversFolderName ?? null
    if (coversAvailable && !coversFolderName) {
      coversFolderName = await askUntilValid({
        rl,
        question: 'Enter cover folder (preferred: relative folder under /covers/<hero-slug>): ',
        parser: parseFolderName,
        errorMessage:
          'Please provide a valid folder path using letters, numbers, "-", "_" or "/" and no "..".',
      })
    }

    return {
      hero,
      gcdIssueId,
      includeInTimeline,
      coversAvailable,
      coversFolderName,
    }
  } finally {
    rl.close()
  }
}

export { parseGcdIssueIdentifier } from './issueIdentifierUtils.js'
