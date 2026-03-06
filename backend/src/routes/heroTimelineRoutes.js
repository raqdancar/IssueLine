import express from 'express'
import { z } from 'zod'
import { createHeroTimelineEntry, getHeroBySlug, getHeroTimelineEntries } from '../services/heroTimelineService.js'

const paramsSchema = z.object({
  slug: z.string().min(1).max(120),
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

heroTimelineRouter.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = paramsSchema.parse(req.params)
    const hero = await getHeroBySlug(slug)

    if (!hero) {
      return res.status(404).json({ error: `Hero with slug "${slug}" was not found.` })
    }

    const entries = await getHeroTimelineEntries(hero.api_id)
    res.json({
      hero,
      entries,
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
