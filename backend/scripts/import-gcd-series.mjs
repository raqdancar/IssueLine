import { promptImportConfig } from '../src/modules/gcd/importCli/prompts.js'
import { importGcdSeriesIntoSupabase } from '../src/modules/gcd/importCli/gcdSeriesImportService.js'

const parseCliOverrides = () => {
  const args = process.argv.slice(2)
  const overrides = {
    heroSlugOverride: null,
    heroApiIdOverride: null,
  }

  for (const token of args) {
    if (token.startsWith('--hero-slug=')) {
      const slug = token.split('=').slice(1).join('=').trim().toLowerCase()
      if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new Error('Invalid --hero-slug value. Use lowercase letters, numbers, and hyphens only.')
      }
      overrides.heroSlugOverride = slug
    } else if (token.startsWith('--hero-api-id=')) {
      const raw = token.split('=').slice(1).join('=').trim()
      const numeric = Number(raw)
      if (!Number.isSafeInteger(numeric) || numeric <= 0) {
        throw new Error('Invalid --hero-api-id value. It must be a positive integer.')
      }
      overrides.heroApiIdOverride = numeric
    }
  }

  if (overrides.heroSlugOverride && overrides.heroApiIdOverride) {
    throw new Error('Use either --hero-slug or --hero-api-id, not both.')
  }

  return overrides
}

const printSummary = (summary) => {
  console.log('\nImport summary')
  console.log('--------------')
  console.log(`Series: ${summary.seriesLabel} (ID ${summary.seriesId})`)
  console.log(`Hero: ${summary.hero.name} (api_id=${summary.hero.api_id})`)
  console.log(`Issues fetched from GCD: ${summary.fetchedIssues}`)
  console.log(`Issue rows persisted: ${summary.persistedIssueRows}`)
  console.log(`Timeline candidates generated: ${summary.timelineCandidates}`)
  console.log(`Timeline inserted: ${summary.timelineInserted}`)
  console.log(`Timeline updated on re-import: ${summary.timelineUpdated}`)
  console.log(`Timeline skipped due to update errors: ${summary.timelineSkipped}`)
  console.log(`Variant filtering applied: ${summary.variantFilteringApplied ? 'yes' : 'no'}`)
  console.log(`Timeline variant/duplicate entries filtered out: ${summary.timelineVariantFilteredOut}`)
  console.log(`Existing variant timeline rows deleted: ${summary.timelineVariantRowsDeleted}`)
  console.log(`Variant timeline delete failures: ${summary.timelineVariantDeleteFailures}`)
  console.log(`Cover linking attempted: ${summary.coversAttempted ? 'yes' : 'no'}`)
  console.log(`Rate-limit pauses: ${summary.rateLimitPauses ?? 0}`)
  console.log(`Rate-limit wait time (s): ${Math.round((summary.rateLimitWaitedMs ?? 0) / 1000)}`)

  if (summary.coverSummary) {
    console.log(`Cover folder used: ${summary.coverSummary.folder}`)
    console.log(`Cover files indexed: ${summary.coverSummary.filesIndexed}`)
    console.log(`Cover matches: ${summary.coverSummary.matched}`)
    console.log(`Cover rows updated: ${summary.coverSummary.updatedRows}`)
    console.log(`Cover rows unchanged: ${summary.coverSummary.unchangedRows}`)
    console.log(`Cover missing matches: ${summary.coverSummary.missing.length}`)
    console.log(`Cover ambiguous matches: ${summary.coverSummary.ambiguous.length}`)
    console.log(`Cover link failures: ${summary.coverSummary.failed.length}`)
  }

  console.log(`Issue fetch failures: ${summary.fetchFailures.length}`)
}

const printDetailedWarnings = (summary) => {
  if (summary.fetchFailures.length) {
    console.log('\nIssue fetch failures')
    console.table(
      summary.fetchFailures.map((item) => ({
        issueUrl: item.issueUrl,
        error: item.message,
      }))
    )
  }

  if (summary.coverSummary?.missing?.length) {
    console.log('\nMissing covers')
    console.table(summary.coverSummary.missing.slice(0, 20))
  }

  if (summary.coverSummary?.ambiguous?.length) {
    console.log('\nAmbiguous cover matches')
    console.table(
      summary.coverSummary.ambiguous.slice(0, 20).map((item) => ({
        gcdIssueId: item.gcdIssueId,
        issueNumber: item.issueNumber,
        selected: item.selected,
        candidates: item.candidates.join(' | '),
      }))
    )
  }

  if (summary.coverSummary?.failed?.length) {
    console.log('\nCover update failures')
    console.table(summary.coverSummary.failed.slice(0, 20))
  }

  if (summary.coverSummary?.folderResolutionAttempts?.length) {
    console.log('\nCover folder resolution attempts')
    console.table(summary.coverSummary.folderResolutionAttempts)
  }
}

const run = async () => {
  console.log('IssueLine GCD Import CLI')
  console.log('------------------------')

  const cliOverrides = parseCliOverrides()
  const config = await promptImportConfig({ heroSlugOverride: cliOverrides.heroSlugOverride })
  const resolvedHeroSlugOverride = cliOverrides.heroSlugOverride ?? config.heroSlugOverride

  const summary = await importGcdSeriesIntoSupabase({
    seriesId: config.seriesId,
    excludeVariantsFromTimeline: config.excludeVariantsFromTimeline,
    coversAvailable: config.coversAvailable,
    coversFolderName: config.coversFolderName,
    heroSlugOverride: resolvedHeroSlugOverride,
    heroApiIdOverride: cliOverrides.heroApiIdOverride,
    logger: console,
  })

  printSummary(summary)
  printDetailedWarnings(summary)
}

run().catch((error) => {
  console.error('\nGCD import failed.')
  console.error(error.message)
  process.exit(1)
})
