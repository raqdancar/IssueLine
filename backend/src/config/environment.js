import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../../../')

dotenv.config({ path: path.resolve(repoRoot, '.env') })

const throwIfMissing = (value, name) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL

export const environment = {
  supabaseUrl: throwIfMissing(supabaseUrl, 'SUPABASE_URL or VITE_SUPABASE_URL'),
  supabaseServiceKey: throwIfMissing(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
  bucketName: process.env.HERO_IMAGE_BUCKET ?? 'hero-images',
  maxImagesPerHero: Number(process.env.HERO_IMAGE_MAX_PER_HERO ?? '3'),
  serverPort: Number(process.env.BACKEND_PORT ?? '4600'),
  allowedOrigins: (process.env.BACKEND_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
}
