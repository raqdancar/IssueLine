import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { searchCollectedEditionsByTitle } from '../repository.js'
import { parseNumericSelector } from './selectorParser.js'

const parseMode = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'gcd' || normalized === 'gcd_ids') return 'gcd'
  if (normalized === 'number' || normalized === 'numbers') return 'number'
  return null
}

const askUntilValid = async ({ rl, question, parser, errorMessage }) => {
  while (true) {
    const answer = await rl.question(question)
    const parsed = parser(answer)
    if (parsed !== null && parsed !== undefined) {
      return parsed
    }
    console.log(errorMessage)
  }
}

const printCollectedEditions = (items) => {
  console.log('\nCollected editions:')
  items.forEach((item, index) => {
    console.log(
      `  ${index + 1}. ${item.title} (id=${item.id}, hero_api_id=${item.hero_api_id}, source_external_id=${item.source_external_id})`
    )
  })
}

export const askLinkingInputs = async ({
  preselectedCollectedEditionId = null,
  preselectedMode = null,
  preselectedSelector = null,
  preselectedNotes = null,
} = {}) => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    let collectedEditionId = preselectedCollectedEditionId
    if (!collectedEditionId) {
      let query = ''
      while (true) {
        const results = await searchCollectedEditionsByTitle({ query, limit: 20 })
        if (!results.length) {
          console.log('No collected editions matched this search.')
          query = await rl.question('Search collected editions by title: ')
          continue
        }

        printCollectedEditions(results)
        const selection = await rl.question('\nSelect by number, or type "s" to search again: ')
        const normalized = selection.trim().toLowerCase()
        if (normalized === 's' || normalized === 'search') {
          query = await rl.question('Search collected editions by title: ')
          continue
        }

        const numeric = Number(selection)
        if (!Number.isSafeInteger(numeric) || numeric < 1 || numeric > results.length) {
          console.log('Invalid selection.')
          continue
        }

        collectedEditionId = results[numeric - 1].id
        break
      }
    }

    const mode =
      preselectedMode ??
      (await askUntilValid({
        rl,
        question: 'Link mode ("gcd" IDs or "number" issue numbers): ',
        parser: parseMode,
        errorMessage: 'Please type "gcd" or "number".',
      }))

    const selector =
      preselectedSelector ??
      (await askUntilValid({
        rl,
        question:
          mode === 'gcd'
            ? 'Enter GCD issue IDs list/range (e.g. 17779,17780,18000-18005): '
            : 'Enter issue numbers list/range (e.g. 110-111,114-146): ',
        parser: parseNumericSelector,
        errorMessage: 'Use comma-separated values and ranges like 10,11,20-25.',
      }))

    const notes =
      preselectedNotes !== null && preselectedNotes !== undefined
        ? preselectedNotes
        : (await rl.question('Optional note for created links (press Enter to skip): ')).trim() || null

    return {
      rl,
      collectedEditionId,
      mode,
      selector,
      notes,
    }
  } catch (error) {
    rl.close()
    throw error
  }
}
