/**
 * Script operatiu per automatitzar tasques de manteniment, importaci? o verificaci?.
 */

import { askCollectedEditionImportInputs, askImportConfirmation, promptHeroSelection } from '../src/modules/collected-edition/importCli/prompts.js'
import {
  formatEditionPreview,
  persistCollectedEditionImport,
  prepareCollectedEditionImportByGcdIdentifier,
} from '../src/modules/collected-edition/importCli/importService.js'

const printEditionPreview = (edition) => {
  console.log('\nCollected edition candidate')
  console.log('--------------------------')
  console.table(formatEditionPreview(edition))

  if (edition.description) {
    console.log('\nDescription preview:')
    const preview = edition.description.length > 360 ? `${edition.description.slice(0, 357)}...` : edition.description
    console.log(preview)
  }
}

const printDuplicateMessage = (duplicate) => {
  console.log('\nCollected edition already exists. Import skipped.')
  console.log('Existing row:')
  console.table({
    id: duplicate.id,
    heroApiId: duplicate.hero_api_id,
    title: duplicate.title,
    source: duplicate.source,
    sourceExternalId: duplicate.source_external_id,
    sourceSeriesId: duplicate.source_series_id,
    isbn: duplicate.isbn,
    createdAt: duplicate.created_at,
  })
}

const printSuccessSummary = ({ inserted, hero, edition }) => {
  console.log('\nCollected edition imported successfully.')
  console.log('--------------------------------------')
  console.table({
    id: inserted.id,
    title: inserted.title,
    hero: `${hero.name} (api_id=${hero.api_id})`,
    source: inserted.source,
    sourceExternalId: inserted.source_external_id,
    sourceSeriesId: inserted.source_series_id,
    isbn: inserted.isbn,
    format: edition.format,
  })
}

const run = async () => {
  console.log('IssueLine Collected Edition Import CLI')
  console.log('--------------------------------------')

  const { rl, gcdIdentifier } = await askCollectedEditionImportInputs()

  try {
    const prepared = await prepareCollectedEditionImportByGcdIdentifier({ gcdIdentifier })

    if (prepared.status === 'not_found') {
      console.log(`\nNo GCD result found for issue id ${prepared.gcdIssueId}.`)
      return
    }

    printEditionPreview(prepared.edition)

    if (prepared.status === 'duplicate') {
      printDuplicateMessage(prepared.duplicate)
      return
    }

    const hero = await promptHeroSelection(rl)
    console.log(`\nSelected hero: ${hero.name} (api_id=${hero.api_id}, slug=${hero.slug ?? 'n/a'})`)

    const confirmed = await askImportConfirmation(rl)
    if (!confirmed) {
      console.log('\nImport cancelled.')
      return
    }

    const result = await persistCollectedEditionImport({
      hero,
      edition: prepared.edition,
    })
    printSuccessSummary(result)
  } finally {
    rl.close()
  }
}

run().catch((error) => {
  console.error('\nCollected edition import failed.')
  console.error(error.message)
  process.exit(1)
})
