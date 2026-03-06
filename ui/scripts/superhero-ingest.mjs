#!/usr/bin/env node
/**
 * SuperHero API → Supabase ingestor.
 *
 * Usage examples:
 *   npm --prefix ui run seed:superheroes
 *   npm --prefix ui run seed:superheroes -- --ids=1,70 --search=batman,ironman
 *
 * Looks for env vars in this priority order:
 *   1) Current process env.
 *   2) ui/.env.local
 *   3) ui/.env
 *   4) ../.env.local
 *   5) ../.env
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const WAIT_BETWEEN_CALLS_MS = 350

const argOptions = parseArgs(process.argv.slice(2))

if (argOptions._.length > 0) {
  console.error(
    `Unexpected arguments detected: ${argOptions._.join(', ')}. Wrap comma-separated lists in quotes, e.g. --ids="1,2,3".`
  )
  process.exit(1)
}

if (argOptions.help) {
  printHelp()
  process.exit(0)
}

const env = {
  ...loadEnvFile(path.resolve(process.cwd(), '.env.local')),
  ...loadEnvFile(path.resolve(process.cwd(), '.env')),
  ...loadEnvFile(path.resolve(process.cwd(), '..', '.env.local')),
  ...loadEnvFile(path.resolve(process.cwd(), '..', '.env')),
  ...process.env,
}

const supabaseUrl =
  env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL
const serviceKey =
  env.SUPABASE_SERVICE_ROLE_KEY ??
  env.SUPABASE_SERVICE_KEY ??
  env.SERVICE_ROLE_KEY
const superheroApiKey = env.SUPERHERO_API_KEY

ensure(Boolean(supabaseUrl), 'Falta SUPABASE_URL (usa NEXT_PUBLIC o VITE en .env).')
ensure(Boolean(serviceKey), 'Falta SUPABASE_SERVICE_ROLE_KEY en .env.')
ensure(Boolean(superheroApiKey), 'Falta SUPERHERO_API_KEY en .env.')

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { 'X-Client-Info': 'issueline-superhero-ingest/1.0.0' } },
})

const apiBase = `https://www.superheroapi.com/api.php/${superheroApiKey}`

let providedIds = []
try {
  providedIds = normalizeIds(argOptions.ids)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const searchTerms = argOptions.search ? parseList(argOptions.search) : []
const nameLookups = argOptions.names ? parseList(argOptions.names) : []
const ids =
  providedIds.length > 0
    ? providedIds
    : searchTerms.length > 0 || nameLookups.length > 0
      ? []
      : DEFAULT_IDS

async function main() {
  if (!ids.length && !searchTerms.length && !nameLookups.length) {
    console.warn('No IDs, search terms, or names were provided; nothing to do.')
    process.exit(1)
  }

  const heroes = new Map()

  for (const id of ids) {
    const hero = await fetchHeroById(id)
    if (hero) {
      heroes.set(hero.id, hero)
    }
    await wait(WAIT_BETWEEN_CALLS_MS)
  }

  for (const term of searchTerms) {
    const matches = await searchHeroes(term)
    for (const hero of matches) {
      heroes.set(hero.id, hero)
    }
    await wait(WAIT_BETWEEN_CALLS_MS)
  }

  for (const name of nameLookups) {
    const hero = await fetchHeroByExactName(name)
    if (hero) {
      heroes.set(hero.id, hero)
    }
    await wait(WAIT_BETWEEN_CALLS_MS)
  }

  if (!heroes.size) {
    console.warn('No valid heroes were returned by the API.')
    process.exit(1)
  }

  const rows = Array.from(heroes.values()).map(normalizeHero)
  console.log(`Processing ${rows.length} heroes.`)
  await upsertInChunks(rows, 50)
  console.log('Done ✅')
}

main().catch((error) => {
  console.error('Critical error while syncing heroes.')
  console.error(error)
  process.exitCode = 1
})

async function fetchHeroById(id) {
  if (!Number.isInteger(id) || id <= 0) {
    console.warn(`ID invalido omitido: ${id}`)
    return null
  }

  const url = `${apiBase}/${id}`
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(`Request failed for ${url}: ${response.status}`)
    return null
  }

  const payload = await response.json()
  if (payload.response !== 'success') {
    console.warn(`API returned an error for id=${id}: ${payload.error}`)
    return null
  }
  return payload
}

async function searchHeroes(term) {
  const safeTerm = term.trim()
  if (!safeTerm) return []

  const url = `${apiBase}/search/${encodeURIComponent(safeTerm)}`
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(`Search failed for '${safeTerm}': ${response.status}`)
    return []
  }

  const payload = await response.json()
  if (payload.response !== 'success' || !Array.isArray(payload.results)) {
    console.warn(`Sin resultados para '${safeTerm}'.`)
    return []
  }
  return payload.results
}

async function fetchHeroByExactName(name) {
  const matches = await searchHeroes(name)
  if (!matches.length) {
    console.warn(`No matches for "${name}".`)
    return null
  }
  const normalizedTarget = normalizeName(name)
  const exact = matches.find(
    (candidate) => normalizeName(candidate.name) === normalizedTarget
  )
  if (exact) return exact

  console.warn(
    `No exact match for "${name}". Using "${matches[0].name}".`
  )
  return matches[0]
}

function normalizeHero(hero) {
  const biography = hero.biography ?? {}
  const simpleAlignment =
    biography?.alignment && biography.alignment !== 'null'
      ? biography.alignment
      : null
  const publisher =
    biography?.publisher && biography.publisher !== 'null'
      ? biography.publisher
      : null
  const fullName = biography?.['full-name'] ?? null

  return {
    api_id: Number(hero.id),
    name: hero.name ?? null,
    slug: ensureSlug(hero.slug, hero.name),
    full_name: fullName && fullName !== 'null' ? fullName : null,
    alignment: simpleAlignment,
    publisher,
    powerstats: hero.powerstats ?? null,
    appearance: hero.appearance ?? null,
    biography: hero.biography ?? null,
    work: hero.work ?? null,
    connections: hero.connections ?? null,
    images: hero.images ?? null,
    raw: hero,
    updated_at: new Date().toISOString(),
  }
}

function ensureSlug(slug, fallbackName) {
  if (slug && slug !== 'null') return slug
  const generated = slugify(fallbackName ?? '')
  return generated || null
}

function slugify(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function upsertInChunks(rows, chunkSize) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    const { error } = await supabase.from('superheroes').upsert(chunk, { onConflict: 'api_id' })
    if (error) {
      throw new Error(`Upsert failed for chunk ${index + 1}: ${error.message}`)
    }
    console.log(`✓ Upserted ${chunk.length} heroes (offset ${index})`)
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseList(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function normalizeIds(raw) {
  if (!raw) return []
  const parts = parseList(raw)
  const invalid = parts.filter((part) => Number.isNaN(Number(part)))
  if (invalid.length) {
    throw new Error(`Invalid numeric IDs: ${invalid.join(', ')}`)
  }
  const parsed = parts
    .map((part) => Number(part))
    .filter((value) => Number.isInteger(value) && value > 0)
  if (!parsed.length) {
    throw new Error('No valid IDs were provided.')
  }
  return parsed
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .replace(/[\s\-_'"]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseArgs(args) {
  return args.reduce(
    (acc, arg) => {
      if (arg === '--help' || arg === '-h') {
        acc.help = true
        return acc
      }

      const match = arg.match(/^--([^=]+)=(.*)$/)
      if (match) {
        acc[match[1]] = match[2]
        return acc
      }

      acc._.push(arg)
      return acc
    },
    { _: [] }
  )
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  try {
    const parsed = dotenv.parse(fs.readFileSync(filePath))
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === 'string' && value.trim() !== ''
      )
    )
  } catch (error) {
    console.warn(`Could not load ${filePath}: ${error.message}`)
    return {}
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function printHelp() {
  console.log(`Usage: npm --prefix ui run seed:superheroes [options]

Options:
  --ids=1,2,3         Comma-separated numeric IDs to sync (default 1-10)
  --search=batman     Comma-separated search terms (adds every match)
  --names="Batman"    Comma-separated names (best effort exact match)
  -h, --help          Show this help

Expected environment variables:
  SUPABASE_SERVICE_ROLE_KEY  Service role key with write permissions
  SUPABASE_URL               Project URL (accepts NEXT_PUBLIC_/VITE_)
  SUPERHERO_API_KEY          Token issued by superheroapi.com
`)
}
