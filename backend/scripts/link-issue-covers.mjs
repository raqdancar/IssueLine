import process from 'node:process'
import { supabaseServiceClient } from '../src/lib/supabaseClient.js'
import { coerceSeriesSlugSource } from '../src/utils/seriesNameUtils.js'

const DEFAULT_BUCKET = process.env.ISSUE_IMAGE_BUCKET ?? 'issue-images'
const DEFAULT_PREFIX = process.env.ISSUE_IMAGE_PREFIX ?? 'covers'

const parseArgs = () => {
  const args = process.argv.slice(2)
  const options = {
    bucket: DEFAULT_BUCKET,
    prefix: DEFAULT_PREFIX,
    apply: false,
    verbose: false,
    seriesFilter: null,
  }

  for (const token of args) {
    if (token === '--apply' || token === '--commit') {
      options.apply = true
    } else if (token === '--verbose') {
      options.verbose = true
    } else if (token.startsWith('--bucket=')) {
      options.bucket = token.split('=').slice(1).join('=')
    } else if (token.startsWith('--prefix=')) {
      options.prefix = token.split('=').slice(1).join('=')
    } else if (token.startsWith('--series=')) {
      options.seriesFilter = token.split('=').slice(1).join('=')
    }
  }

  options.bucket = sanitizeSegment(options.bucket)
  options.prefix = sanitizeSegment(options.prefix)

  return options
}

const sanitizeSegment = (value) => value?.replace(/^\/+|\/+$/g, '') ?? ''

const slugifySeriesName = (value) => {
  const source = coerceSeriesSlugSource(value)
  if (!source) return null
  const withoutParens = source.replace(/\([^)]*\)/g, ' ')
  return withoutParens
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}


const buildFolderCandidates = (slug) => {
  const candidates = new Set()
  if (!slug) return candidates

  const enqueue = (value) => {
    const normalized = value.replace(/^_+|_+$/g, '')
    if (normalized) {
      candidates.add(normalized)
    }
  }

  enqueue(slug)

  const transforms = [
    (value) => value.replace(/_series$/, ''),
    (value) => value.replace(/_volume_\d+$/, ''),
    (value) => value.replace(/_vol_\d+$/, ''),
    (value) => value.replace(/_volume$/, ''),
    (value) => value.replace(/_\d{4}$/, ''),
  ]

  for (const transform of transforms) {
    const next = transform(slug)
    if (next !== slug) {
      enqueue(next)
    }
  }

  return candidates
}
const normalizeIssueKey = (value) => {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase().replace(/[^0-9a-z]+/g, '')
  return normalized || null
}

const extractFilenameKeys = (filename) => {
  const withoutExtension = filename.replace(/\.[^.]+$/, '')
  const alphaNumeric = normalizeIssueKey(withoutExtension)
  const digitsOnly = withoutExtension.replace(/[^0-9]+/g, '')
  const keys = new Set()
  if (alphaNumeric) {
    keys.add(alphaNumeric)
  }
  if (digitsOnly && digitsOnly !== alphaNumeric) {
    keys.add(digitsOnly)
  }
  return Array.from(keys)
}

const listBucketObjects = async (bucket, prefix = '') => {
  const storage = supabaseServiceClient.storage.from(bucket)
  const traverse = async (folder = '') => {
    const limit = 100
    let offset = 0
    const entries = []

    while (true) {
      const { data, error } = await storage.list(folder, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })

      if (error) {
        throw new Error(`Unable to list storage folder "${folder || '/'}": ${error.message}`)
      }

      if (!data?.length) {
        break
      }

      for (const entry of data) {
        const entryPath = folder ? `${folder}/${entry.name}` : entry.name
        const isFile = entry.metadata && typeof entry.metadata.size === 'number'
        if (isFile) {
          entries.push(entryPath)
        } else {
          const nested = await traverse(entryPath)
          entries.push(...nested)
        }
      }

      if (data.length < limit) {
        break
      }

      offset += data.length
    }

    return entries
  }

  const sanitizedPrefix = sanitizeSegment(prefix)
  return traverse(sanitizedPrefix)
}

const buildCoverIndex = (paths) => {
  const index = new Map()

  for (const fullPath of paths) {
    const segments = fullPath.split('/').filter(Boolean)
    if (segments.length < 2) continue

    const seriesFolder = segments.at(-2)
    const filename = segments.at(-1)
    if (!seriesFolder || !filename) continue

    const keys = extractFilenameKeys(filename)
    if (!keys.length) continue

    if (!index.has(seriesFolder)) {
      index.set(seriesFolder, new Map())
    }

    const folderMap = index.get(seriesFolder)
    for (const key of keys) {
      if (!folderMap.has(key)) {
        folderMap.set(key, fullPath)
      }
    }
  }

  return index
}

const fetchHeroIssues = async (seriesFilter = null) => {
  const rows = []
  const pageSize = 1000
  let from = 0

  while (true) {
    let query = supabaseServiceClient
      .from('hero_issues')
      .select('id, series_name, number, cover_image_path')
      .order('id', { ascending: true })

    if (seriesFilter) {
      const filterValue = seriesFilter.includes('%') ? seriesFilter : `%${seriesFilter}%`
      query = query.ilike('series_name', filterValue)
    }

    query = query.range(from, from + pageSize - 1)

    const { data, error } = await query
    if (error) {
      throw new Error(`Failed to load hero issues: ${error.message}`)
    }

    if (!data?.length) {
      break
    }

    rows.push(...data)

    if (data.length < pageSize) {
      break
    }

    from += pageSize
  }

  return rows
}

const chunk = (items, size) => {
  const batches = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

const updateIssueCoverPaths = async (updates, apply) => {
  if (!updates.length || !apply) {
    return
  }

  const batches = chunk(updates, 25)
  for (const batch of batches) {
    await Promise.all(
      batch.map(async ({ id, coverPath }) => {
        const { error } = await supabaseServiceClient
          .from('hero_issues')
          .update({ cover_image_path: coverPath })
          .eq('id', id)

        if (error) {
          throw new Error(`Failed to update hero_issues(${id}): ${error.message}`)
        }
      })
    )
  }
}

const main = async () => {
  const options = parseArgs()
  const dryRun = !options.apply

  console.log(
    `Linking issue covers using bucket="${options.bucket}" prefix="${options.prefix || '<root>'}" (${
      dryRun ? 'dry-run' : 'apply mode'
    })`
  )

  const objectPaths = await listBucketObjects(options.bucket, options.prefix)
  console.log(`Indexed ${objectPaths.length} objects from storage.`)

  const coverIndex = buildCoverIndex(objectPaths)
  console.log(`Prepared cover index for ${coverIndex.size} series folders.`)

  const issues = await fetchHeroIssues(options.seriesFilter)
  console.log(`Loaded ${issues.length} hero issue rows${options.seriesFilter ? ` (filter: ${options.seriesFilter})` : ''}.`)

  const stats = {
    linked: 0,
    skippedExisting: 0,
    missingSeriesFolder: 0,
    missingIssueFile: 0,
  }

  const pendingUpdates = []

  for (const row of issues) {
    const folder = slugifySeriesName(row.series_name)
    if (!folder) {
      stats.missingSeriesFolder += 1
      continue
    }

    const folderCandidates = buildFolderCandidates(folder)
    let folderMap = null
    for (const candidate of folderCandidates) {
      const candidateMap = coverIndex.get(candidate)
      if (candidateMap) {
        folderMap = candidateMap
        break
      }
    }

    if (!folderMap) {
      stats.missingSeriesFolder += 1
      continue
    }

    const candidateKeys = new Set()
    const normalizedNumber = normalizeIssueKey(row.number)
    const digitsOnly = row.number ? String(row.number).replace(/[^0-9]+/g, '') : null
    if (normalizedNumber) candidateKeys.add(normalizedNumber)
    if (digitsOnly && digitsOnly !== normalizedNumber) candidateKeys.add(digitsOnly)

    let selectedPath = null
    for (const key of candidateKeys) {
      if (folderMap.has(key)) {
        selectedPath = folderMap.get(key)
        break
      }
    }

    if (!selectedPath) {
      stats.missingIssueFile += 1
      continue
    }

    if (row.cover_image_path === selectedPath) {
      stats.skippedExisting += 1
      continue
    }

    pendingUpdates.push({ id: row.id, coverPath: selectedPath })
  }

  if (pendingUpdates.length) {
    if (dryRun) {
      console.log(`Dry-run: ${pendingUpdates.length} issue rows would be updated.`)
    } else {
      await updateIssueCoverPaths(pendingUpdates, true)
      console.log(`Updated ${pendingUpdates.length} issue rows with new cover paths.`)
    }
  } else {
    console.log('No issue rows required updates.')
  }

  stats.linked = pendingUpdates.length

  console.table(stats)

  if (options.verbose && pendingUpdates.length) {
    console.log('Sample updates:')
    console.table(pendingUpdates.slice(0, 10))
  }
}

await main().catch((error) => {
  console.error(error)
  process.exit(1)
})




