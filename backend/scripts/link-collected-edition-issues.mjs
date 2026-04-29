/**
 * Script operatiu per automatitzar tasques de manteniment, importaci? o verificaci?.
 */

import { askLinkingInputs } from '../src/modules/collected-edition/linkCli/prompts.js'
import { linkCollectedEditionToIssues } from '../src/modules/collected-edition/linkCli/linkService.js'
import { parseNumericSelector } from '../src/modules/collected-edition/linkCli/selectorParser.js'

const parseMode = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'gcd' || normalized === 'gcd_ids') return 'gcd'
  if (normalized === 'number' || normalized === 'numbers') return 'number'
  return null
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const options = {
    collectedEditionId: null,
    mode: null,
    selector: null,
    notes: null,
  }

  for (const token of args) {
    if (token.startsWith('--collected-id=')) {
      options.collectedEditionId = token.split('=').slice(1).join('=').trim()
    } else if (token.startsWith('--mode=')) {
      options.mode = parseMode(token.split('=').slice(1).join('='))
    } else if (token.startsWith('--issues=')) {
      options.selector = parseNumericSelector(token.split('=').slice(1).join('='))
    } else if (token.startsWith('--note=')) {
      options.notes = token.split('=').slice(1).join('=').trim() || null
    }
  }

  if (options.mode === null && args.some((arg) => arg.startsWith('--mode='))) {
    throw new Error('Invalid --mode value. Use "gcd" or "number".')
  }
  if (options.selector === null && args.some((arg) => arg.startsWith('--issues='))) {
    throw new Error('Invalid --issues value. Use comma-separated values/ranges, e.g. 110-111,114.')
  }

  return options
}

const printSummary = (result) => {
  console.log('\nCollected-edition linking summary')
  console.log('---------------------------------')
  console.table({
    collectedEditionId: result.collectedEdition.id,
    collectedEditionTitle: result.collectedEdition.title,
    heroApiId: result.collectedEdition.hero_api_id,
    mode: result.mode,
    requested: result.selector.length,
    matched: result.matched,
    created: result.created,
    alreadyLinked: result.alreadyLinked,
    missing: result.missing.length,
    ambiguous: result.ambiguous.length,
  })

  if (result.missing.length) {
    console.log('\nMissing selectors:')
    console.log(result.missing.join(', '))
  }

  if (result.ambiguous.length) {
    console.log('\nAmbiguous selectors (skipped):')
    result.ambiguous.slice(0, 20).forEach((entry) => {
      const candidates = entry.candidates
        .map((candidate) => `${candidate.gcdIssueId} (${candidate.seriesName ?? 'unknown'} #${candidate.number ?? '?'})`)
        .join(' | ')
      console.log(`  ${entry.issueNumber}: ${candidates}`)
    })
  }
}

const run = async () => {
  console.log('IssueLine Collected Edition Linking CLI')
  console.log('---------------------------------------')

  const options = parseArgs()
  const { rl, collectedEditionId, mode, selector, notes } = await askLinkingInputs({
    preselectedCollectedEditionId: options.collectedEditionId,
    preselectedMode: options.mode,
    preselectedSelector: options.selector,
    preselectedNotes: options.notes,
  })

  try {
    const result = await linkCollectedEditionToIssues({
      collectedEditionId,
      mode,
      selector,
      notes,
    })
    printSummary(result)
  } finally {
    rl.close()
  }
}

run().catch((error) => {
  console.error('\nCollected-edition linking failed.')
  console.error(error.message)
  process.exit(1)
})
