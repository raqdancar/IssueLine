import crypto from 'node:crypto'
import path from 'node:path'
import { promisify } from 'node:util'
import sizeOf from 'image-size'
import { environment } from '../config/environment.js'
import { supabaseServiceClient } from './supabaseClient.js'

const randomBytesAsync = promisify(crypto.randomBytes)

export const ensureBucket = async () => {
  const { data: buckets, error } = await supabaseServiceClient.storage.listBuckets()
  if (error) {
    throw new Error(`Unable to list storage buckets: ${error.message}`)
  }

  const exists = buckets.some((bucket) => bucket.name === environment.bucketName)
  if (!exists) {
    const { error: bucketError } = await supabaseServiceClient.storage.createBucket(environment.bucketName, {
      public: true,
    })
    if (bucketError) {
      throw new Error(`Unable to create storage bucket: ${bucketError.message}`)
    }
  }
}

export const verifyHeroExists = async (heroApiId) => {
  const { count, error } = await supabaseServiceClient
    .from('superheroes')
    .select('api_id', { count: 'exact', head: true })
    .eq('api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to verify hero existence: ${error.message}`)
  }

  return (count ?? 0) > 0
}

export const enforceHeroQuota = async (heroApiId) => {
  const { count, error } = await supabaseServiceClient
    .from('hero_images')
    .select('id', { count: 'exact', head: true })
    .eq('hero_api_id', heroApiId)

  if (error) {
    throw new Error(`Failed to check hero image quota: ${error.message}`)
  }

  if ((count ?? 0) >= environment.maxImagesPerHero) {
    throw new Error(`Hero ${heroApiId} already has ${count} images (limit ${environment.maxImagesPerHero}).`)
  }
}

const buildStoragePath = async (heroApiId, originalName) => {
  const random = (await randomBytesAsync(8)).toString('hex')
  const extension = path.extname(originalName?.toLowerCase() ?? '') || '.jpg'
  return `hero-${heroApiId}/${Date.now()}-${random}${extension}`
}

const extractImageMetadata = (buffer) => {
  try {
    const { width, height, type } = sizeOf(buffer)
    return { width, height, format: type }
  } catch (error) {
    throw new Error(`Unable to read image metadata: ${error.message}`)
  }
}

export const uploadHeroImage = async ({ file, heroApiId, alt, variant }) => {
  const storagePath = await buildStoragePath(heroApiId, file.originalname)
  const metadata = extractImageMetadata(file.buffer)

  const { error: uploadError } = await supabaseServiceClient.storage
    .from(environment.bucketName)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`)
  }

  const {
    data: { publicUrl },
  } = supabaseServiceClient.storage.from(environment.bucketName).getPublicUrl(storagePath)

  const { data, error: insertError } = await supabaseServiceClient
    .from('hero_images')
    .insert({
      hero_api_id: heroApiId,
      variant: variant ?? 'default',
      alt,
      storage_path: storagePath,
      public_url: publicUrl,
      width: metadata.width,
      height: metadata.height,
      size_bytes: file.size,
      content_type: file.mimetype,
    })
    .select('*')
    .single()

  if (insertError) {
    throw new Error(`Failed to insert hero image metadata: ${insertError.message}`)
  }

  return data
}

export const listHeroImages = async ({ heroApiId, onlyActive = true }) => {
  let query = supabaseServiceClient.from('hero_images').select('*').order('created_at', { ascending: false })

  if (heroApiId) {
    query = query.eq('hero_api_id', heroApiId)
  }

  if (onlyActive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to list hero images: ${error.message}`)
  }

  return data
}

export const updateHeroImage = async (id, payload) => {
  const { data, error } = await supabaseServiceClient
    .from('hero_images')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update hero image: ${error.message}`)
  }

  return data
}
