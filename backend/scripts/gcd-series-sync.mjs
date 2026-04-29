/**
 * Script operatiu per automatitzar tasques de manteniment, importaci? o verificaci?.
 */

import { setTimeout as delay } from 'node:timers/promises'
import { environment } from '../src/config/environment.js'
import { getHeroBySlug } from '../src/modules/hero/timelineService.js'
import { syncSeriesIssuesForHero } from '../src/modules/gcd/issueSyncService.js'
import { gcdGet } from '../src/modules/gcd/client.js'

const printUsage = () => {
  console.log(
    'Usage: node ./scripts/gcd-series-sync.mjs <hero-slug> <series-id> [--batch=12] [--delay=65000] [--offset=0] [--issue-start=131] [--issue-end=168] [--direct-only] [--include-newsstand]'
  )
}

const parseArgs = () => {
  const [, , slug = 'doctor-strange', seriesId = '824', ...rest] = process.argv
  const options = {
    batch: 12,
    delay: 65000,
    offset: 0,
    issueStart: null,
    issueEnd: null,
    directOnly: false,
    skipNewsstand: true,
  }

  for (const token of rest) {
    const [key, value] = token.replace(/^--/, '').split('=')
    if (key === 'batch' && value) {
      options.batch = Number(value)
    } else if (key === 'delay' && value) {
      options.delay = Number(value)
    } else if (key === 'start' && value) {
      options.offset = Number(value)
    } else if (key === 'offset' && value) {
      options.offset = Number(value)
    } else if ((key === 'issue' || key === 'issue-start') && value) {
      options.issueStart = value
    } else if ((key === 'issue-end' || key === 'end') && value) {
      options.issueEnd = value
    } else if (key === 'direct-only') {
      options.directOnly = true
    } else if (key === 'include-newsstand') {
      options.skipNewsstand = false
    } else if (key === 'skip-newsstand') {
      options.skipNewsstand = true
    }
  }

  return { slug, seriesId, options }
}

const BRITISH_REGEX = /\[british]/i
const DIRECT_REGEX = /direct/i
const NEWSSTAND_REGEX = /(newsstand|newstand)/i

const shouldIncludeDescriptor = (descriptor, { directOnly, skipNewsstand }) => {
  const label = descriptor ?? ''
  if (BRITISH_REGEX.test(label)) return false
  if (skipNewsstand && NEWSSTAND_REGEX.test(label)) return false
  if (directOnly) {
    return DIRECT_REGEX.test(label)
  }
  return true
}
const findOffsetForIssue = async (seriesId, descriptor) => {
  const series = await gcdGet(`series/${seriesId}/`)
  const descriptors = series?.issue_descriptors ?? []
  const normalized = descriptor.toString().trim().toLowerCase()
  const index = descriptors.findIndex(
    (entry) => entry.replace(/\s*\[.*?\]\s*/g, '').trim().toLowerCase() === normalized
  )
  if (index === -1) {
    throw new Error(`Issue descriptor "${descriptor}" was not found in series ${seriesId}.`)
  }
  return index
}

const normalizeDescriptorNumber = (descriptor) => {
  if (!descriptor) return null
  const normalized = descriptor.replace(/\s*\[.*?\]\s*/g, '').trim()
  const numeric = Number(normalized)
  return Number.isNaN(numeric) ? null : numeric
}

const buildIssueQueue = async (seriesId, startDescriptor, endDescriptor, filters) => {
  const series = await gcdGet(`series/${seriesId}/`)
  const descriptors = series?.issue_descriptors ?? []
  const issues = series?.active_issues ?? []

  if (!descriptors.length || !issues.length) {
    return []
  }

  const normalizedStart = startDescriptor ? Number(startDescriptor) : null
  const normalizedEnd = endDescriptor ? Number(endDescriptor) : null
  const seenNumbers = new Set()
  const queue = []

  descriptors.forEach((descriptor, index) => {
    const number = normalizeDescriptorNumber(descriptor)
    const url = issues[index]
    if (!url || number === null) return
    if (normalizedStart !== null && number < normalizedStart) return
    if (normalizedEnd !== null && number > normalizedEnd) return
    if (seenNumbers.has(number)) return
    if (!shouldIncludeDescriptor(descriptor, filters)) return

    queue.push({
      descriptor,
      number,
      url,
    })
    seenNumbers.add(number)
  })

  return queue
}

const main = async () => {
  if (!environment.gcd.allowManualSync) {
    throw new Error('GCD_ALLOW_MANUAL_SYNC must be true to run the sync script.')
  }

  const { slug, seriesId, options } = parseArgs()

  if (!slug || !seriesId) {
    printUsage()
    process.exit(1)
  }

  const hero = await getHeroBySlug(slug)
  if (!hero) {
    throw new Error(`Hero with slug "${slug}" was not found.`)
  }

  const descriptorRangeSpecified = options.issueStart || options.issueEnd

  if (descriptorRangeSpecified) {
    const queue = await buildIssueQueue(seriesId, options.issueStart, options.issueEnd, options)
    if (!queue.length) {
      throw new Error('No issues found for the requested descriptor range.')
    }

    console.log(
      `Syncing descriptors ${options.issueStart ?? queue[0].number} to ${options.issueEnd ?? queue.at(-1).number} ` +
        `for ${hero.name} in batches of ${options.batch}.`
    )

    let processed = 0
    let batchNumber = 0

    while (processed < queue.length) {
      const chunk = queue.slice(processed, processed + options.batch)
      const chunkUrls = chunk.map((entry) => entry.url)
      const chunkLabels = `${chunk[0].descriptor}â€“${chunk.at(-1).descriptor}`
      const result = await syncSeriesIssuesForHero({
        hero,
        seriesId,
        issueUrlsOverride: chunkUrls,
        directOnly: options.directOnly,
        skipNewsstand: options.skipNewsstand,
      })

      console.log(
        `Batch ${++batchNumber} (${chunkLabels}): fetched ${result.fetchedIssues}, ` +
          `upserted ${result.upsertedIssues}, timeline entries ${result.timelineInserted}.`
      )

      processed += chunk.length
      if (processed >= queue.length) {
        console.log('Requested descriptor range completed.')
        break
      }
      console.log(`Waiting ${options.delay} ms before next batch...`)
      await delay(options.delay)
    }
    return
  }

  let resolvedOffset = options.offset
  if (options.issueStart) {
    resolvedOffset = await findOffsetForIssue(seriesId, options.issueStart)
    console.log(`Resolved issue descriptor "${options.issueStart}" to offset ${resolvedOffset}.`)
  }

  console.log(
    `Syncing GCD series ${seriesId} for ${hero.name} in batches of ${options.batch} issues starting at index ${resolvedOffset}.`
  )
  console.log(`Respecting ~${environment.gcd.rateLimitSoftPerMinute}/min by waiting ${options.delay} ms between requests.`)

  let nextOffset = resolvedOffset
  let batches = 0

  while (nextOffset !== null) {
    const result = await syncSeriesIssuesForHero({
      hero,
      seriesId,
      limit: options.batch,
      offset: nextOffset,
      directOnly: options.directOnly,
      skipNewsstand: options.skipNewsstand,
    })

    console.log(
      `Batch ${++batches}: fetched ${result.fetchedIssues}, upserted ${result.upsertedIssues},` +
        ` timeline entries ${result.timelineInserted}.`
    )

    if (result.nextOffset === null) {
      console.log('Series exhausted or target reached. Sync complete.')
      break
    }

    nextOffset = result.nextOffset
    console.log(`Waiting ${options.delay} ms before requesting next batch starting at index ${nextOffset}...`)
    await delay(options.delay)
  }
}

main().catch((error) => {
  console.error('GCD series sync failed:', error)
  process.exit(1)
})









