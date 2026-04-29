/**
 * Script operatiu per automatitzar tasques de manteniment, importaci? o verificaci?.
 */

import path from 'node:path'
import process from 'node:process'
import { environment } from '../src/config/environment.js'
import { supabaseServiceClient } from '../src/lib/supabaseClient.js'

const bucket = environment.bucketName ?? 'hero-images'
const storage = supabaseServiceClient.storage.from(bucket)

const parseArgs = () => {
  const options = {
    heroApiId: Number(process.env.HERO_API_ID ?? '226'),
    stageName: process.env.STAGE_NAME ?? 'Strange Tales vol. 2 (Cloak & Dagger / Doctor Strange)',
    folder: process.env.TARGET_FOLDER ?? 'strange_tales_2',
  }

  for (const token of process.argv.slice(2)) {
    const [key, rawValue] = token.replace(/^--/, '').split('=')
    if (key === 'hero' && rawValue) {
      options.heroApiId = Number(rawValue)
    } else if (key === 'stage' && rawValue) {
      options.stageName = rawValue
    } else if (key === 'folder' && rawValue) {
      options.folder = rawValue
    }
  }

  if (!Number.isFinite(options.heroApiId)) {
    throw new Error('hero api id must be numeric')
  }
  if (!options.stageName) {
    throw new Error('stage name is required')
  }
  if (!options.folder) {
    throw new Error('folder is required')
  }
  return options
}

const extractDigits = (value) => {
  if (!value) return null
  const match = value.match(/(\d+)/)
  if (!match) return null
  return match[1].replace(/^0+/, '') || '0'
}

const buildCoverMap = async (folder) => {
  const entries = await storage.list(folder, {
    limit: 1000,
  })
  if (entries.error) {
    throw new Error(`Failed to list storage folder ${folder}: ${entries.error.message}`)
  }

  const gcdMap = new Map()
  const numberMap = new Map()
  for (const file of entries.data ?? []) {
    const stem = path.parse(file.name).name
    const digits = extractDigits(stem)
    if (!digits) continue

    const payload = {
      path: `${folder}/${file.name}`,
      name: file.name,
    }

    if (digits.length >= 4) {
      if (!gcdMap.has(digits)) {
        gcdMap.set(digits, payload)
      }
    } else {
      if (!numberMap.has(digits)) {
        numberMap.set(digits, payload)
      }
    }
  }
  return {
    byGcd: gcdMap,
    byNumber: numberMap,
    total: (entries.data ?? []).length,
  }
}

const fetchTimelineRows = async (heroApiId, stageName) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_timelines')
    .select('id, metadata')
    .eq('hero_api_id', heroApiId)
    .eq('metadata->>stage_name', stageName)

  if (error) {
    throw new Error(`Failed to load hero timelines: ${error.message}`)
  }

  return data ?? []
}

const updateTimelineCover = async (row, coverPath) => {
  const {
    data: { publicUrl },
  } = storage.getPublicUrl(coverPath)

  const nextMetadata = {
    ...row.metadata,
    cover: publicUrl,
    cover_original: row.metadata?.cover_original ?? row.metadata?.cover ?? null,
    coverImagePath: coverPath,
    cover_image_path: coverPath,
  }

  const { error } = await supabaseServiceClient
    .from('hero_timelines')
    .update({ metadata: nextMetadata })
    .eq('id', row.id)

  if (error) {
    throw new Error(`Failed to update hero timeline ${row.id}: ${error.message}`)
  }
}

const normalizeCovers = async ({ heroApiId, stageName, folder }) => {
  const coverMap = await buildCoverMap(folder)
  console.log(
    `Loaded ${coverMap.total} files from ${folder} (gcd matches: ${coverMap.byGcd.size}, number matches: ${coverMap.byNumber.size})`,
  )

  const timelines = await fetchTimelineRows(heroApiId, stageName)
  console.log(`Found ${timelines.length} timeline entries for stage "${stageName}"`)

  let updated = 0
  for (const row of timelines) {
    const metadata = row.metadata ?? {}
    const gcdIssueId = metadata.gcdIssueId ?? metadata.gcd_issue_id
    if (!gcdIssueId) {
      console.warn(`Skipping ${row.id} (no gcdIssueId)`)
      continue
    }

    const coverFromGcd = gcdIssueId ? coverMap.byGcd.get(String(gcdIssueId)) : null
    let cover = coverFromGcd

    if (!cover && metadata.number) {
      const normalizedNumber = extractDigits(String(metadata.number))
      if (normalizedNumber) {
        cover = coverMap.byNumber.get(normalizedNumber)
      }
    }
    if (!cover) {
      console.warn(`No cover file for gcdIssueId ${gcdIssueId}`)
      continue
    }

    await updateTimelineCover(row, cover.path)
    updated += 1
    console.log(`Updated ${row.id} -> ${cover.path}`)
  }

  console.log(`Done. Updated ${updated} hero timeline entries.`)
}

normalizeCovers(parseArgs()).catch((error) => {
  console.error('Timeline cover normalization failed:', error)
  process.exit(1)
})
