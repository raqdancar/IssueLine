// Expose hero timeline read/detail/create endpoints for frontend and admin flows.

import express from 'express'
import { z } from 'zod'
import {
  createHeroTimelineEntry,
  getHeroBySlug,
  getHeroCollectedEditionsOverview,
  getHeroTimelineEntries,
  getHeroTimelineIssueDetailById,
} from '../modules/hero/timelineService.js'

const paramsSchema = z.object({
  slug: z.string().min(1).max(120),
})

const issueParamsSchema = z.object({
  slug: z.string().min(1).max(120),
  issueId: z.string().min(1).max(120),
})

const severityEnum = z.enum(['info', 'success', 'warning', 'critical'])

const createSchema = z
  .object({
    heroApiId: z.coerce.number().int().positive().optional(),
    heroSlug: z.string().min(1).max(120).optional(),
    headline: z.string().min(3).max(160),
    summary: z.string().min(1).max(2000).optional(),
    issueCode: z.string().min(1).max(80).optional(),
    issueDate: z.coerce.date(),
    sourceUrl: z.string().url().optional(),
    severity: severityEnum.optional(),
    metadata: z.record(z.any()).optional(),
  })
  .refine((value) => value.heroApiId || value.heroSlug, {
    message: 'Provide heroApiId or heroSlug.',
    path: ['heroApiId'],
  })

export const heroTimelineRouter = express.Router()

heroTimelineRouter.get('/:slug/issues/:issueId', async (req, res, next) => {
  // Return hero identity and issue detail in one payload for the issue-details dialog.
  try {
    const { slug, issueId } = issueParamsSchema.parse(req.params)
    const hero = await getHeroBySlug(slug)

    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }

    const detail = await getHeroTimelineIssueDetailById({
      heroApiId: hero.api_id,
      issueId,
    })

    if (!detail) {
      return res.status(404).json({ error: `Issue "${issueId}" was not found for hero "${slug}".` })
    }

    res.json({
      hero: {
        apiId: hero.api_id,
        slug: hero.slug,
        name: hero.name,
      },
      ...detail,
    })
  } catch (error) {
    next(error)
  }
})

heroTimelineRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = paramsSchema.parse(req.params)
    const hero = await getHeroBySlug(slug)

    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }

    // Timeline rows and collected-edition overview are independent queries.
    const [entries, collectedEditionsOverview] = await Promise.all([
      getHeroTimelineEntries(hero.api_id),
      getHeroCollectedEditionsOverview(hero.api_id),
    ])
    res.json({
      hero,
      entries,
      collectedEditionsOverview,
    })
  } catch (error) {
    next(error)
  }
})

heroTimelineRouter.post('/', async (req, res, next) => {
  try {
    const payload = createSchema.parse(req.body)
    let heroApiId = payload.heroApiId

    if (!heroApiId && payload.heroSlug) {
      const hero = await getHeroBySlug(payload.heroSlug)
      if (!hero) {
        return res.status(404).json({ error: `Hero with slug "${payload.heroSlug}" was not found.` })
      }
      heroApiId = hero.api_id
    }

    const entry = await createHeroTimelineEntry({
      heroApiId,
      headline: payload.headline,
      summary: payload.summary,
      issueCode: payload.issueCode,
      issueDate: payload.issueDate,
      sourceUrl: payload.sourceUrl,
      severity: payload.severity,
      metadata: payload.metadata,
    })

    res.status(201).json(entry)
  } catch (error) {
    next(error)
  }
})

