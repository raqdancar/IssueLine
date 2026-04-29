import { promptSingleIssueImportConfig, parseGcdIssueIdentifier } from '../src/modules/gcd/importCli/singleIssuePrompts.js'
import { getHeroByApiId, getHeroBySlug } from '../src/modules/gcd/importCli/heroSelectionService.js'
import { importSingleGcdIssueIntoSupabase } from '../src/modules/gcd/importCli/gcdSingleIssueImportService.js'

const parseYesNoFlag = (value) => {
  if (value === undefined || value === null || value === '') return null
  const normalized = String(value).trim().toLowerCase()
  if (['y', 'yes', 'true', '1'].includes(normalized)) return true
  if (['n', 'no', 'false', '0'].includes(normalized)) return false
  throw new Error(`Invalid yes/no value "${value}". Use y/n, true/false, or 1/0.`)
}

const parseArgs = async () => {
  const args = process.argv.slice(2)
  let heroSlug = null
  let heroApiId = null
  let issueId = null
  let includeInTimeline = null
  let coversAvailable = null
  let coversFolderName = null

  for (const token of args) {
    if (token.startsWith('--hero-slug=')) {
      heroSlug = token.split('=').slice(1).join('=').trim().toLowerCase()
    } else if (token.startsWith('--hero-api-id=')) {
      const raw = token.split('=').slice(1).join('=').trim()
      const numeric = Number(raw)
      if (!Number.isSafeInteger(numeric) || numeric <= 0) {
        throw new Error('Invalid --hero-api-id value. It must be a positive integer.')
      }
      heroApiId = numeric
    } else if (token.startsWith('--issue-id=')) {
      const parsed = parseGcdIssueIdentifier(token.split('=').slice(1).join('='))
      if (parsed === null) {
        throw new Error('Invalid --issue-id value. Use a positive numeric ID or /issue/<id>/ URL.')
      }
      issueId = parsed
    } else if (token.startsWith('--timeline=')) {
      includeInTimeline = parseYesNoFlag(token.split('=').slice(1).join('='))
    } else if (token.startsWith('--covers=')) {
      coversAvailable = parseYesNoFlag(token.split('=').slice(1).join('='))
    } else if (token.startsWith('--covers-folder=')) {
      coversFolderName = token.split('=').slice(1).join('=').trim().replace(/^\/+|\/+$/g, '')
    }
  }

  if (heroSlug && heroApiId) {
    throw new Error('Use either --hero-slug or --hero-api-id, not both.')
  }

  let preselectedHero = null
  if (heroApiId) {
    preselectedHero = await getHeroByApiId(heroApiId)
  } else if (heroSlug) {
    preselectedHero = await getHeroBySlug(heroSlug)
  }

  if (coversFolderName && coversAvailable === false) {
    throw new Error('--covers-folder cannot be used with --covers=false.')
  }
  if (coversFolderName && coversAvailable === null) {
    coversAvailable = true
  }

  return {
    preselectedHero,
    preselectedGcdIssueId: issueId,
    preselectedIncludeInTimeline: includeInTimeline,
    preselectedCoversAvailable: coversAvailable,
    preselectedCoversFolderName: coversFolderName,
  }
}

const printSummary = (summary) => {
  console.log('\nSingle issue import summary')
  console.log('---------------------------')
  console.log(`Hero: ${summary.hero.name} (slug=${summary.hero.slug ?? 'n/a'}, api_id=${summary.hero.api_id})`)
  console.log(`GCD issue ID: ${summary.gcdIssueId}`)
  console.log(`Issue: ${summary.issueDisplayName}`)
  console.log(`Issue persistence: ${summary.issueStatus}`)
  console.log(`Issue rows persisted: ${summary.persistedIssueRows}`)
  console.log(`Timeline requested: ${summary.includeInTimeline ? 'yes' : 'no'}`)
  console.log(`Timeline status: ${summary.timelineStatus}`)
  console.log(`Timeline inserted: ${summary.timelineInserted}`)
  console.log(`Timeline updated: ${summary.timelineUpdated}`)
  console.log(`Timeline skipped/errors: ${summary.timelineSkipped}`)
  console.log(`Cover linking attempted: ${summary.coversAttempted ? 'yes' : 'no'}`)
  console.log(`Rate-limit pauses: ${summary.rateLimitPauses ?? 0}`)
  console.log(`Rate-limit wait time (s): ${Math.round((summary.rateLimitWaitedMs ?? 0) / 1000)}`)

  if (summary.coverSummary) {
    console.log(`Cover folder used: ${summary.coverSummary.folder}`)
    console.log(`Cover matches: ${summary.coverSummary.matched}`)
    console.log(`Cover missing matches: ${summary.coverSummary.missing.length}`)
    console.log(`Cover ambiguous matches: ${summary.coverSummary.ambiguous.length}`)
    console.log(`Cover link failures: ${summary.coverSummary.failed.length}`)
  }
}

const printWarnings = (summary) => {
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
  console.log('IssueLine GCD Single-Issue Import CLI')
  console.log('--------------------------------------')

  const cliOptions = await parseArgs()
  const config = await promptSingleIssueImportConfig(cliOptions)

  const summary = await importSingleGcdIssueIntoSupabase({
    hero: config.hero,
    gcdIssueId: config.gcdIssueId,
    includeInTimeline: config.includeInTimeline,
    coversAvailable: config.coversAvailable,
    coversFolderName: config.coversFolderName,
    logger: console,
  })

  printSummary(summary)
  printWarnings(summary)
}

run().catch((error) => {
  console.error('\nSingle issue import failed.')
  console.error(error.message)
  process.exit(1)
})
