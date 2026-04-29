/**
 * Script operatiu per automatitzar tasques de manteniment, importaci? o verificaci?.
 */

import path from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { supabaseServiceClient } from '../src/lib/supabaseClient.js'
import { getHeroByApiId } from '../src/modules/hero/heroSelectionService.js'
import {
  getCollectedEditionById,
  updateCollectedEditionCoverImageUrl,
} from '../src/modules/collected-edition/repository.js'

const DEFAULT_BUCKET = process.env.COLLECTED_EDITION_IMAGE_BUCKET ?? 'collected-edition-images'
const DEFAULT_PREFIX = process.env.COLLECTED_EDITION_IMAGE_PREFIX ?? 'covers'
const MAX_FILE_BYTES = 10 * 1024 * 1024

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const sanitizeSegment = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/-+/g, '-')

const parseArgs = () => {
  const args = process.argv.slice(2)
  const options = {
    collectedEditionId: null,
    filePath: null,
    bucket: DEFAULT_BUCKET,
    prefix: DEFAULT_PREFIX,
    overwrite: true,
  }

  for (const token of args) {
    if (token.startsWith('--collected-id=')) {
      options.collectedEditionId = token.split('=').slice(1).join('=').trim()
    } else if (token.startsWith('--file=')) {
      options.filePath = token.split('=').slice(1).join('=').trim()
    } else if (token.startsWith('--bucket=')) {
      options.bucket = token.split('=').slice(1).join('=').trim()
    } else if (token.startsWith('--prefix=')) {
      options.prefix = token.split('=').slice(1).join('=').trim()
    } else if (token === '--no-overwrite') {
      options.overwrite = false
    }
  }

  if (!options.collectedEditionId) {
    throw new Error('Missing required argument --collected-id=<uuid>.')
  }
  if (!options.filePath) {
    throw new Error('Missing required argument --file=<local-path>.')
  }

  options.bucket = sanitizeSegment(options.bucket)
  options.prefix = sanitizeSegment(options.prefix)
  return options
}

const ensureFileIsValid = async (filePath) => {
  const info = await stat(filePath)
  if (!info.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`)
  }
  if (info.size <= 0) {
    throw new Error('File is empty.')
  }
  if (info.size > MAX_FILE_BYTES) {
    throw new Error(`File exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB limit.`)
  }
}

const resolveContentType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase()
  const mime = MIME_BY_EXTENSION[extension]
  if (!mime) {
    throw new Error(`Unsupported image extension "${extension}". Use jpg/jpeg/png/webp/gif.`)
  }
  return { extension, mime }
}

const buildStoragePath = ({ prefix, heroSlug, collectedEdition, extension }) => {
  const sourceId = sanitizeSegment(collectedEdition.source_external_id ?? collectedEdition.id)
  const filename = `cover${extension}`
  return [prefix, sanitizeSegment(heroSlug), sourceId, filename].filter(Boolean).join('/')
}

const run = async () => {
  const options = parseArgs()
  const absolutePath = path.resolve(options.filePath)

  await ensureFileIsValid(absolutePath)
  const { extension, mime } = resolveContentType(absolutePath)
  const fileBuffer = await readFile(absolutePath)

  const collectedEdition = await getCollectedEditionById(options.collectedEditionId)
  if (!collectedEdition) {
    throw new Error(`Collected edition "${options.collectedEditionId}" was not found.`)
  }

  const hero = await getHeroByApiId(collectedEdition.hero_api_id)
  const storagePath = buildStoragePath({
    prefix: options.prefix,
    heroSlug: hero.slug ?? `hero-${hero.api_id}`,
    collectedEdition,
    extension,
  })

  const storage = supabaseServiceClient.storage.from(options.bucket)
  const { error: uploadError } = await storage.upload(storagePath, fileBuffer, {
    contentType: mime,
    upsert: options.overwrite,
  })

  if (uploadError) {
    throw new Error(`Failed to upload image to storage: ${uploadError.message}`)
  }

  const { data: publicData } = storage.getPublicUrl(storagePath)
  const publicUrl = publicData?.publicUrl
  if (!publicUrl) {
    throw new Error('Failed to resolve public URL for uploaded image.')
  }

  const updated = await updateCollectedEditionCoverImageUrl({
    collectedEditionId: collectedEdition.id,
    coverImageUrl: publicUrl,
  })

  console.log('\nCollected edition cover uploaded successfully.')
  console.table({
    collectedEditionId: updated.id,
    title: updated.title,
    hero: `${hero.name} (slug=${hero.slug ?? 'n/a'})`,
    bucket: options.bucket,
    storagePath,
    coverImageUrl: updated.cover_image_url,
  })
}

await run().catch((error) => {
  console.error('\nUpload collected cover failed.')
  console.error(error.message)
  process.exit(1)
})
