import { supabaseServiceClient } from '../../../lib/supabaseClient.js'

const DEFAULT_BUCKET = process.env.ISSUE_IMAGE_BUCKET ?? 'issue-images'
const DEFAULT_PREFIX = process.env.ISSUE_IMAGE_PREFIX ?? 'covers'

const sanitizeSegment = (value) => String(value ?? '').replace(/^\/+|\/+$/g, '')

const normalizeToken = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
  return normalized || null
}

const normalizeIssueNumber = (value) => {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw) return null
  const withLetters = normalizeToken(raw)
  const digitsOnly = raw.replace(/[^0-9]+/g, '')
  return {
    withLetters,
    digitsOnly: digitsOnly || null,
  }
}

const extractFilenameKeys = (fileName) => {
  const stem = String(fileName ?? '').replace(/\.[^.]+$/, '')
  if (!stem) return { gcdCandidate: null, issueKeys: [] }

  const compact = stem.replace(/[^0-9a-z]+/gi, '')
  const allDigitTokens = stem.match(/\d+/g) ?? []
  const longestDigitToken = allDigitTokens
    .slice()
    .sort((a, b) => b.length - a.length)[0]
  const gcdCandidate = longestDigitToken && longestDigitToken.length >= 4 ? String(Number(longestDigitToken)) : null

  const issueKeys = new Set()
  const normalizedCompact = normalizeToken(compact)
  if (normalizedCompact) issueKeys.add(normalizedCompact)
  for (const token of allDigitTokens) {
    const normalizedToken = String(Number(token))
    if (normalizedToken && normalizedToken !== 'NaN') {
      issueKeys.add(normalizedToken)
    }
  }

  return {
    gcdCandidate,
    issueKeys: Array.from(issueKeys),
  }
}

const listFolderFiles = async ({ bucket, folder }) => {
  const storage = supabaseServiceClient.storage.from(bucket)
  const prefix = sanitizeSegment(folder)
  if (!prefix) {
    throw new Error('Cover folder is required.')
  }

  const limit = 100
  let offset = 0
  const paths = []

  while (true) {
    const { data, error } = await storage.list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) {
      throw new Error(`Failed to list storage folder "${prefix}": ${error.message}`)
    }

    if (!data?.length) {
      break
    }

    for (const entry of data) {
      const isFile = entry?.metadata && typeof entry.metadata.size === 'number'
      if (!isFile) continue
      paths.push(`${prefix}/${entry.name}`)
    }

    if (data.length < limit) {
      break
    }
    offset += data.length
  }

  return paths
}

const resolveFolderCandidates = ({ prefix, heroSlug, coversFolderName }) => {
  const normalizedPrefix = sanitizeSegment(prefix)
  const normalizedSlug = sanitizeSegment(heroSlug)
  const normalizedFolder = sanitizeSegment(coversFolderName)
  const candidates = []

  const pushUnique = (value) => {
    const normalized = sanitizeSegment(value)
    if (!normalized) return
    if (!candidates.includes(normalized)) {
      candidates.push(normalized)
    }
  }

  // New preferred structure: covers/<hero-slug>/<folder>
  if (normalizedSlug && normalizedFolder) {
    pushUnique(`${normalizedPrefix}/${normalizedSlug}/${normalizedFolder}`)
  }
  // Backward compatible shape: covers/<folder>
  if (normalizedFolder) {
    pushUnique(`${normalizedPrefix}/${normalizedFolder}`)
  }
  // Full path already provided by operator
  if (normalizedFolder.startsWith(`${normalizedPrefix}/`)) {
    pushUnique(normalizedFolder)
  }
  // Already hero-scoped full path
  if (normalizedSlug && normalizedFolder.startsWith(`${normalizedSlug}/`)) {
    pushUnique(`${normalizedPrefix}/${normalizedFolder}`)
  }

  return candidates
}

const resolveFilesFromCandidates = async ({ bucket, candidates }) => {
  let selectedFolder = candidates[0] ?? null
  let selectedFiles = []
  const attempts = []

  for (const folder of candidates) {
    const files = await listFolderFiles({ bucket, folder })
    attempts.push({ folder, filesIndexed: files.length })

    if (!selectedFolder) {
      selectedFolder = folder
    }
    if (files.length > 0) {
      selectedFolder = folder
      selectedFiles = files
      break
    }
  }

  return {
    folder: selectedFolder,
    files: selectedFiles,
    attempts,
  }
}

const buildCoverIndex = (paths) => {
  const byGcdIssueId = new Map()
  const byIssueToken = new Map()

  for (const coverPath of paths) {
    const fileName = coverPath.split('/').at(-1) ?? coverPath
    const parsed = extractFilenameKeys(fileName)
    const payload = { path: coverPath, fileName }

    if (parsed.gcdCandidate) {
      if (!byGcdIssueId.has(parsed.gcdCandidate)) {
        byGcdIssueId.set(parsed.gcdCandidate, [])
      }
      byGcdIssueId.get(parsed.gcdCandidate).push(payload)
    }

    for (const token of parsed.issueKeys) {
      if (!byIssueToken.has(token)) {
        byIssueToken.set(token, [])
      }
      byIssueToken.get(token).push(payload)
    }
  }

  return {
    byGcdIssueId,
    byIssueToken,
    totalFiles: paths.length,
  }
}

const pickDeterministicMatch = (matches) => {
  if (!matches?.length) return null
  const sorted = [...matches].sort((a, b) => a.path.localeCompare(b.path))
  return {
    selected: sorted[0],
    ambiguous: sorted.length > 1 ? sorted : null,
  }
}

const getIssueRowsByGcdIds = async ({ heroApiId, gcdIssueIds }) => {
  const normalizedIds = Array.from(
    new Set((gcdIssueIds ?? []).map((value) => Number(value)).filter((value) => Number.isSafeInteger(value) && value > 0))
  )
  if (!normalizedIds.length) return []

  const { data, error } = await supabaseServiceClient
    .from('hero_issues')
    .select('id, gcd_issue_id, number, cover_image_path')
    .eq('hero_api_id', heroApiId)
    .in('gcd_issue_id', normalizedIds)

  if (error) {
    throw new Error(`Failed to load hero issues for cover linking: ${error.message}`)
  }

  return data ?? []
}

const updateHeroIssueCoverPath = async ({ issueId, coverPath }) => {
  const { error } = await supabaseServiceClient.from('hero_issues').update({ cover_image_path: coverPath }).eq('id', issueId)
  if (error) {
    throw new Error(`Failed to update hero_issues(${issueId}) cover path: ${error.message}`)
  }
}

const loadTimelineRows = async (heroApiId) => {
  const { data: timelineRows, error: loadError } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)

  if (loadError) {
    throw new Error(`Failed to load timeline rows for cover updates: ${loadError.message}`)
  }

  return timelineRows ?? []
}

const applyCoverToTimelineMetadata = async ({ timelineRows, gcdIssueId, coverPath, bucket }) => {
  const rows = timelineRows ?? []

  const storage = supabaseServiceClient.storage.from(bucket)
  const {
    data: { publicUrl },
  } = storage.getPublicUrl(coverPath)

  const targets = rows.filter((row) => {
    const rowIssueId = Number(row?.metadata?.gcdIssueId ?? row?.metadata?.gcd_issue_id)
    return Number.isFinite(rowIssueId) && rowIssueId === Number(gcdIssueId)
  })

  for (const row of targets) {
    const nextMetadata = {
      ...(row.metadata ?? {}),
      cover: publicUrl,
      coverImagePath: coverPath,
      cover_image_path: coverPath,
    }

    const { error: updateError } = await supabaseServiceClient
      .from('hero_timelines')
      .update({ metadata: nextMetadata })
      .eq('id', row.id)

    if (updateError) {
      throw new Error(`Failed to update timeline row ${row.id} cover metadata: ${updateError.message}`)
    }
  }
}

/**
 * Links existing storage covers to imported issues without failing the whole import on misses.
 */
export const linkImportedIssueCovers = async ({
  heroApiId,
  gcdIssueIds,
  coversFolderName,
  heroSlug = null,
  bucket = DEFAULT_BUCKET,
  prefix = DEFAULT_PREFIX,
}) => {
  const folder = sanitizeSegment(coversFolderName)
  if (!folder) {
    throw new Error('coversFolderName is required when linking covers.')
  }

  const folderCandidates = resolveFolderCandidates({
    prefix,
    heroSlug,
    coversFolderName: folder,
  })
  if (!folderCandidates.length) {
    throw new Error('Unable to resolve a valid cover folder path.')
  }

  const resolved = await resolveFilesFromCandidates({
    bucket,
    candidates: folderCandidates,
  })
  const fullFolder = resolved.folder
  const files = resolved.files
  const index = buildCoverIndex(files)
  const issueRows = await getIssueRowsByGcdIds({ heroApiId, gcdIssueIds })
  const timelineRows = await loadTimelineRows(heroApiId)

  const summary = {
    bucket,
    folder: fullFolder,
    folderCandidates: folderCandidates,
    folderResolutionAttempts: resolved.attempts,
    filesIndexed: index.totalFiles,
    issuesConsidered: issueRows.length,
    matched: 0,
    missing: [],
    ambiguous: [],
    updatedRows: 0,
    unchangedRows: 0,
    failed: [],
  }

  for (const row of issueRows) {
    const gcdKey = String(row.gcd_issue_id)
    const numberKeys = normalizeIssueNumber(row.number)
    const directMatches = index.byGcdIssueId.get(gcdKey) ?? []
    const fallbackMatches = []
    if (numberKeys?.withLetters) {
      fallbackMatches.push(...(index.byIssueToken.get(numberKeys.withLetters) ?? []))
    }
    if (numberKeys?.digitsOnly) {
      fallbackMatches.push(...(index.byIssueToken.get(numberKeys.digitsOnly) ?? []))
    }

    const allCandidates = directMatches.length ? directMatches : fallbackMatches
    const match = pickDeterministicMatch(allCandidates)

    if (!match?.selected) {
      summary.missing.push({
        gcdIssueId: row.gcd_issue_id,
        issueNumber: row.number,
      })
      continue
    }

    if (match.ambiguous) {
      summary.ambiguous.push({
        gcdIssueId: row.gcd_issue_id,
        issueNumber: row.number,
        candidates: match.ambiguous.map((entry) => entry.path),
        selected: match.selected.path,
      })
    }

    summary.matched += 1
    if (row.cover_image_path === match.selected.path) {
      summary.unchangedRows += 1
      continue
    }

    try {
      await updateHeroIssueCoverPath({ issueId: row.id, coverPath: match.selected.path })
      await applyCoverToTimelineMetadata({
        timelineRows,
        gcdIssueId: row.gcd_issue_id,
        coverPath: match.selected.path,
        bucket,
      })
      summary.updatedRows += 1
    } catch (error) {
      summary.failed.push({
        gcdIssueId: row.gcd_issue_id,
        issueNumber: row.number,
        message: error.message,
      })
    }
  }

  return summary
}
