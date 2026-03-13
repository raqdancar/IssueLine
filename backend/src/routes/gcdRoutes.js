import express from 'express'
import { z } from 'zod'
import { environment } from '../config/environment.js'
import { getHeroBySlug, getExistingGcdIssueIds, insertHeroTimelineEntries } from '../services/heroTimelineService.js'
import { getSeriesMatchesForHero, searchSeriesByName } from '../services/gcdSeriesService.js'
import { fetchSeriesIssues, getIssueById } from '../services/gcdIssueService.js'
import { refreshHeroTimelineCovers } from '../services/gcdTimelineMaintenanceService.js'
import { mapIssueToTimelineEntry } from '../services/gcdIssueMapper.js'
import { syncSeriesIssuesForHero } from '../services/gcdIssueSyncService.js'
import { getHeroIssuesByNumberRange, mapHeroIssueRowToTimelineEntry } from '../services/heroIssuesService.js'

const searchSchema = z.object({
  name: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).optional(),
})

const slugSchema = z.object({
  slug: z.string().min(1).max(160),
})

const syncSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(40),
  seriesLimit: z.coerce.number().int().min(1).max(10).default(3),
})

const singleIssueSchema = z.object({
  issueId: z.coerce.number().int().positive(),
})

const coverRefreshSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

const seriesIdParamsSchema = z.object({
  seriesId: z.coerce.number().int().positive(),
})

const seriesSyncSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).optional(),
})

const timelineCacheSchema = z.object({
  startNumber: z.coerce.number().int().min(1).optional(),
  endNumber: z.coerce.number().int().min(1).optional(),
})

export const gcdRouter = express.Router()

gcdRouter.get('/series', async (req, res, next) => {
  try {
    const params = searchSchema.parse(req.query)
    const payload = await searchSeriesByName(params)
    res.json(payload)
  } catch (error) {
    next(error)
  }
})

gcdRouter.get('/issues/:issueId', async (req, res, next) => {
  try {
    const { issueId } = singleIssueSchema.parse(req.params)
    const issue = await getIssueById(issueId)
    res.json(issue)
  } catch (error) {
    next(error)
  }
})

gcdRouter.get('/heroes/:slug', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params)
    const hero = await getHeroBySlug(slug)
    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }
    const seriesProfile = await getSeriesMatchesForHero(hero.name)
    res.json({ hero, series: seriesProfile })
  } catch (error) {
    next(error)
  }
})

gcdRouter.post('/heroes/:slug/issues', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params)
    const { issueId } = singleIssueSchema.parse(req.body ?? {})

    const hero = await getHeroBySlug(slug)
    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }

    const existingIds = await getExistingGcdIssueIds(hero.api_id)
    if (existingIds.has(issueId)) {
      return res.status(409).json({ error: `Issue ${issueId} already exists in the hero timeline.` })
    }

    const issue = await getIssueById(issueId)
    const entry = mapIssueToTimelineEntry(issue)

    if (!entry) {
      return res
        .status(422)
        .json({ error: `Issue ${issueId} is missing enough date data to appear on the timeline.` })
    }

    const inserted = await insertHeroTimelineEntries(hero.api_id, [entry])

    res.status(201).json({
      hero,
      issue,
      insertedEntry: inserted[0] ?? null,
    })
  } catch (error) {
    next(error)
  }
})

gcdRouter.post('/heroes/:slug/issues/sync', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params)
    const options = syncSchema.parse(req.body ?? {})

    if (!environment.gcd.allowManualSync) {
      return res.status(423).json({
        error: 'Manual GCD syncs are disabled. Set GCD_ALLOW_MANUAL_SYNC=true once automated jobs are paused.',
      })
    }

    const hero = await getHeroBySlug(slug)
    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }

    const seriesProfile = await getSeriesMatchesForHero(hero.name)
    const seriesSubset = seriesProfile.results.slice(0, options.seriesLimit)
    const issues = await fetchSeriesIssues({ seriesResults: seriesSubset, limit: options.limit })
    const existingIds = await getExistingGcdIssueIds(hero.api_id)

    const newEntries = issues
      .map(mapIssueToTimelineEntry)
      .filter((entry) => entry && !existingIds.has(entry.metadata?.gcdIssueId))

    const inserted = await insertHeroTimelineEntries(hero.api_id, newEntries)

    res.json({
      hero,
      seriesSampled: seriesSubset.length,
      requestedIssues: issues.length,
      preparedEntries: newEntries.length,
      insertedEntries: inserted.length,
    })
  } catch (error) {
    next(error)
  }
})

gcdRouter.post('/heroes/:slug/timeline/refresh-covers', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params)
    const { limit } = coverRefreshSchema.parse(req.body ?? {})

    const hero = await getHeroBySlug(slug)
    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }

    const result = await refreshHeroTimelineCovers({ heroApiId: hero.api_id, limit })

    res.json({ hero, ...result })
  } catch (error) {
    next(error)
  }
})

gcdRouter.post('/heroes/:slug/timeline/from-cache', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params)
    const range = timelineCacheSchema.parse(req.body ?? {})

    const hero = await getHeroBySlug(slug)
    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }

    const issues = await getHeroIssuesByNumberRange({
      heroApiId: hero.api_id,
      startNumber: range.startNumber,
      endNumber: range.endNumber,
    })

    if (!issues.length) {
      return res.status(404).json({ error: 'No cached issues found for the requested range.' })
    }

    const existingIds = await getExistingGcdIssueIds(hero.api_id)
    const entries = issues.map(mapHeroIssueRowToTimelineEntry).filter(Boolean)
    const newEntries = entries.filter((entry) => {
      const gcdIssueId = entry.metadata?.gcdIssueId
      return gcdIssueId ? !existingIds.has(gcdIssueId) : true
    })

    if (!newEntries.length) {
      return res.json({
        hero,
        requestedIssues: entries.length,
        insertedEntries: 0,
        skippedEntries: entries.length,
      })
    }

    const inserted = await insertHeroTimelineEntries(hero.api_id, newEntries)

    res.json({
      hero,
      requestedIssues: entries.length,
      insertedEntries: inserted.length,
      skippedEntries: entries.length - inserted.length,
    })
  } catch (error) {
    next(error)
  }
})

gcdRouter.post('/heroes/:slug/series/:seriesId/sync', async (req, res, next) => {
  try {
    if (!environment.gcd.allowManualSync) {
      return res.status(423).json({
        error: 'Manual GCD syncs are disabled. Set GCD_ALLOW_MANUAL_SYNC=true once automated jobs are paused.',
      })
    }

    const { slug } = slugSchema.parse(req.params)
    const { seriesId } = seriesIdParamsSchema.parse(req.params)
    const options = seriesSyncSchema.parse(req.body ?? {})

    const hero = await getHeroBySlug(slug)
    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }

    const result = await syncSeriesIssuesForHero({
      hero,
      seriesId,
      limit: options.limit,
      offset: options.offset ?? 0,
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})
