import path from 'node:path'
import process from 'node:process'
import { environment } from '../src/config/environment.js'
import { supabaseServiceClient } from '../src/lib/supabaseClient.js'

const parseArgs = () => {
  const options = {
    heroApiId: Number(process.env.HERO_API_ID ?? '226'),
    targetFolder: process.env.TARGET_FOLDER ?? 'strange_tales_2',
    variant: process.env.IMAGE_VARIANT ?? null,
  }

  for (const token of process.argv.slice(2)) {
    const [key, rawValue] = token.replace(/^--/, '').split('=')
    if (key === 'hero' && rawValue) {
      options.heroApiId = Number(rawValue)
    } else if (key === 'folder' && rawValue) {
      options.targetFolder = rawValue
    } else if (key === 'variant') {
      options.variant = rawValue || null
    }
  }

  if (!Number.isFinite(options.heroApiId)) {
    throw new Error('hero api id must be numeric')
  }
  if (!options.targetFolder) {
    throw new Error('target folder is required')
  }
  return options
}

const bucket = environment.bucketName ?? 'hero-images'
const storage = supabaseServiceClient.storage.from(bucket)

const moveImage = async (row, targetFolder) => {
  if (!row.storage_path) {
    return { skipped: true }
  }

  const filename = path.posix.basename(row.storage_path)
  const nextPath = `${targetFolder}/${filename}`
  if (row.storage_path === nextPath) {
    return { skipped: true }
  }

  const { error: moveError } = await storage.move(row.storage_path, nextPath)
  if (moveError) {
    throw new Error(`Failed to move ${row.storage_path} -> ${nextPath}: ${moveError.message}`)
  }

  const {
    data: { publicUrl },
  } = storage.getPublicUrl(nextPath)

  const { error: updateError } = await supabaseServiceClient
    .from('hero_images')
    .update({ storage_path: nextPath, public_url: publicUrl })
    .eq('id', row.id)
  if (updateError) {
    throw new Error(`Failed to update hero_images row ${row.id}: ${updateError.message}`)
  }

  return { moved: true, nextPath }
}

const main = async () => {
  const { heroApiId, targetFolder, variant } = parseArgs()

  let query = supabaseServiceClient
    .from('hero_images')
    .select('id, storage_path, public_url, variant')
    .eq('hero_api_id', heroApiId)

  if (variant) {
    query = query.eq('variant', variant)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load hero images: ${error.message}`)
  }

  const rows = (data ?? []).filter((row) => !row.storage_path?.startsWith(`${targetFolder}/`))
  console.log(`Found ${rows.length} images to normalize for hero ${heroApiId}.`)

  let moved = 0
  for (const row of rows) {
    const result = await moveImage(row, targetFolder)
    if (result.moved) {
      moved += 1
      console.log(`Moved ${row.storage_path} -> ${result.nextPath}`)
    }
  }

  console.log(`Done. ${moved} paths updated in bucket "${bucket}" to folder "${targetFolder}".`)
}

main().catch((error) => {
  console.error('Image normalization failed:', error)
  process.exit(1)
})
