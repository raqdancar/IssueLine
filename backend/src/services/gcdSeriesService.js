import { environment } from '../config/environment.js'
import { gcdGet } from './gcdClient.js'

const seriesCache = new Map()

const getNormalizedName = (value) => value?.trim().toLowerCase()

const getCachedSeries = (normalizedName) => {
  const cached = seriesCache.get(normalizedName)
  if (!cached) return null
  if (Date.now() - cached.cachedAt > environment.gcd.seriesCacheTtlMs) {
    seriesCache.delete(normalizedName)
    return null
  }
  return cached.payload
}

const setCachedSeries = (normalizedName, payload) => {
  seriesCache.set(normalizedName, { payload, cachedAt: Date.now() })
}

const encodeSeriesName = (name) => encodeURIComponent(name.trim())

export const searchSeriesByName = async ({ name, page } = {}) => {
  if (!name?.trim()) {
    throw new Error('Series name is required for search.')
  }
  const path = `series/name/${encodeSeriesName(name)}/`
  return gcdGet(path, page ? { search: { page } } : undefined)
}

export const getSeriesMatchesForHero = async (name) => {
  const normalizedName = getNormalizedName(name)
  if (!normalizedName) {
    throw new Error('Hero name is required.')
  }

  const cached = getCachedSeries(normalizedName)
  if (cached) {
    return cached
  }

  const searchResult = await searchSeriesByName({ name: normalizedName })
  if (!searchResult?.results?.length) {
    throw new Error(`GCD series for "${name}" was not found.`)
  }

  const payload = {
    query: normalizedName,
    total: searchResult.count ?? searchResult.results.length,
    results: searchResult.results,
  }

  setCachedSeries(normalizedName, payload)
  return payload
}
