// Expose authenticated endpoints for per-issue and per-stage collection state updates.

import express from 'express'
import { z } from 'zod'
import { authenticateRequest } from '../middlewares/authenticate.js'
import { getHeroBySlug } from '../modules/hero/timelineService.js'
import {
  applyIssueStatePatch,
  getHeroTimelineIssueIds,
  getUserIssueStatesByIssueIds,
  markStageIssuesAsRead,
  toggleCollectedEditionOwnership,
  toggleCollectedEditionReadStatus,
} from '../modules/issue-state/service.js'

const parseIssueIds = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const querySchema = z
  .object({
    heroSlug: z.string().min(1).max(120).optional(),
    heroApiId: z.coerce.number().int().positive().optional(),
    issueIds: z
      .preprocess(parseIssueIds, z.array(z.string().uuid()).optional())
      .optional(),
  })
  .refine((value) => value.heroSlug || value.heroApiId || (value.issueIds && value.issueIds.length > 0), {
    message: 'Provide heroSlug, heroApiId, or at least one issueId.',
    path: ['heroSlug'],
  })

const patchSchema = z
  .object({
    haveIt: z.boolean().optional(),
    readIt: z.boolean().optional(),
    collectedEditionIds: z.array(z.string().uuid()).optional(),
  })
  .refine((value) => value.haveIt !== undefined || value.readIt !== undefined || value.collectedEditionIds !== undefined, {
    message: 'Provide haveIt, readIt, and/or collectedEditionIds fields.',
    path: ['haveIt'],
  })

const paramsSchema = z.object({
  issueId: z.string().uuid(),
})

const stageActionSchema = z
  .object({
    heroSlug: z.string().min(1).max(120).optional(),
    heroApiId: z.coerce.number().int().positive().optional(),
    stageKey: z.string().min(1).max(200),
  })
  .refine((value) => value.heroSlug || value.heroApiId, {
    message: 'Provide heroSlug or heroApiId.',
    path: ['heroSlug'],
  })

const collectedEditionOwnershipSchema = z
  .object({
    heroSlug: z.string().min(1).max(120).optional(),
    heroApiId: z.coerce.number().int().positive().optional(),
    collectedEditionId: z.string().uuid(),
    haveIt: z.boolean(),
  })
  .refine((value) => value.heroSlug || value.heroApiId, {
    message: 'Provide heroSlug or heroApiId.',
    path: ['heroSlug'],
  })

const collectedEditionReadSchema = z
  .object({
    heroSlug: z.string().min(1).max(120).optional(),
    heroApiId: z.coerce.number().int().positive().optional(),
    collectedEditionId: z.string().uuid(),
    readIt: z.boolean(),
  })
  .refine((value) => value.heroSlug || value.heroApiId, {
    message: 'Provide heroSlug or heroApiId.',
    path: ['heroSlug'],
  })

export const issueStatesRouter = express.Router()

issueStatesRouter.use(authenticateRequest)

issueStatesRouter.get('/', async (req, res, next) => {
  // Merge explicit ids with hero timeline ids and deduplicate before querying states.
  try {
    const query = querySchema.parse({
      ...req.query,
      issueIds: req.query.issueId ?? req.query.issueIds,
    })

    let heroApiId = query.heroApiId
    if (!heroApiId && query.heroSlug) {
      const hero = await getHeroBySlug(query.heroSlug)
      if (!hero) {
        return res.status(404).json({ error: `Hero with slug "${query.heroSlug}" was not found.` })
      }
      heroApiId = hero.api_id
    }

    const issueIdSet = new Set(query.issueIds ?? [])

    if (heroApiId) {
      const heroIssueIds = await getHeroTimelineIssueIds(heroApiId)
      heroIssueIds.forEach((id) => issueIdSet.add(id))
    }

    const issueIds = Array.from(issueIdSet)

    if (!issueIds.length) {
      return res.json({ states: [] })
    }

    const states = await getUserIssueStatesByIssueIds({
      userId: req.user.id,
      issueIds,
    })

    return res.json({ states })
  } catch (error) {
    return next(error)
  }
})

issueStatesRouter.patch('/:issueId', async (req, res, next) => {
  try {
    const { issueId } = paramsSchema.parse(req.params)
    const payload = patchSchema.parse(req.body)

    const state = await applyIssueStatePatch({
      userId: req.user.id,
      issueId,
      patch: payload,
    })

    return res.json(state)
  } catch (error) {
    return next(error)
  }
})

issueStatesRouter.post('/stages/read', async (req, res, next) => {
  try {
    const payload = stageActionSchema.parse(req.body ?? {})
    let heroApiId = payload.heroApiId

    if (!heroApiId && payload.heroSlug) {
      const hero = await getHeroBySlug(payload.heroSlug)
      if (!hero) {
        return res.status(404).json({ error: `Hero with slug \"${payload.heroSlug}\" was not found.` })
      }
      heroApiId = hero.api_id
    }

    const result = await markStageIssuesAsRead({
      userId: req.user.id,
      heroApiId,
      stageKey: payload.stageKey,
    })

    return res.json(result)
  } catch (error) {
    if (error?.statusCode === 404) {
      return res.status(404).json({ error: error.message })
    }
    return next(error)
  }
})

issueStatesRouter.post('/collected-editions/ownership', async (req, res, next) => {
  try {
    const payload = collectedEditionOwnershipSchema.parse(req.body ?? {})
    let heroApiId = payload.heroApiId

    if (!heroApiId && payload.heroSlug) {
      const hero = await getHeroBySlug(payload.heroSlug)
      if (!hero) {
        return res.status(404).json({ error: `Hero with slug "${payload.heroSlug}" was not found.` })
      }
      heroApiId = hero.api_id
    }

    const result = await toggleCollectedEditionOwnership({
      userId: req.user.id,
      heroApiId,
      collectedEditionId: payload.collectedEditionId,
      haveIt: payload.haveIt,
    })

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

issueStatesRouter.post('/collected-editions/read', async (req, res, next) => {
  try {
    const payload = collectedEditionReadSchema.parse(req.body ?? {})
    let heroApiId = payload.heroApiId

    if (!heroApiId && payload.heroSlug) {
      const hero = await getHeroBySlug(payload.heroSlug)
      if (!hero) {
        return res.status(404).json({ error: `Hero with slug "${payload.heroSlug}" was not found.` })
      }
      heroApiId = hero.api_id
    }

    const result = await toggleCollectedEditionReadStatus({
      userId: req.user.id,
      heroApiId,
      collectedEditionId: payload.collectedEditionId,
      readIt: payload.readIt,
    })

    return res.json(result)
  } catch (error) {
    return next(error)
  }
})

