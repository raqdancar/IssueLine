// Dona suport al flux CLI d'importacio d'edicions recopilatories.
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { searchHeroes } from '../../hero/heroSelectionService.js'
import { parseGcdIssueIdentifier } from '../../gcd/importCli/issueIdentifierUtils.js'

const parseYesNo = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['y', 'yes'].includes(normalized)) return true
  if (['n', 'no'].includes(normalized)) return false
  return null
}

const askUntilValid = async ({ rl, question, parser, errorMessage }) => {
  // Keep asking until parser returns a valid value for the current prompt.
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
    const publisherLabel = hero.publisher ? `, ${hero.publisher}` : ''
    console.log(`  ${index + 1}. ${hero.name} (api_id=${hero.api_id}, slug=${hero.slug ?? 'n/a'}${publisherLabel})`)
  })
}

export const promptHeroSelection = async (rl) => {
  let query = ''
  while (true) {
    const heroes = await searchHeroes({ query, limit: 20 })
    if (!heroes.length) {
      console.log('No heroes matched this search.')
      query = await rl.question('Search heroes by name/slug: ')
      continue
    }

    printHeroes(heroes)
    const answer = await rl.question('\nSelect hero by number, or type "s" to search again: ')
    const normalized = answer.trim().toLowerCase()
    if (normalized === 's' || normalized === 'search') {
      query = await rl.question('Search heroes by name/slug: ')
      continue
    }

    const numeric = Number(answer)
    if (!Number.isSafeInteger(numeric) || numeric < 1 || numeric > heroes.length) {
      console.log('Invalid selection. Choose a listed number or type "s" to search.')
      continue
    }

    return heroes[numeric - 1]
  }
}

export const askCollectedEditionImportInputs = async () => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const gcdIdentifier = await askUntilValid({
      rl,
      question: 'Enter GCD collected-edition issue ID (or /issue/<id>/ URL): ',
      parser: parseGcdIssueIdentifier,
      errorMessage: 'Please enter a valid numeric GCD issue ID or /issue/<id>/ URL.',
    })

    return { rl, gcdIdentifier }
  } catch (error) {
    rl.close()
    throw error
  }
}

export const askImportConfirmation = async (rl) => {
  return askUntilValid({
    rl,
    question: 'Proceed with import? (y/n): ',
    parser: parseYesNo,
    errorMessage: 'Please answer with y or n.',
  })
}
