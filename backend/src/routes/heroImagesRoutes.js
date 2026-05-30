// Exposa rutes REST del backend i delega la logica als serveis corresponents.
import express from 'express'
import multer from 'multer'
import { z } from 'zod'
import {
  enforceHeroQuota,
  ensureBucket,
  listHeroImages,
  updateHeroImage,
  uploadHeroImage,
  verifyHeroExists,
} from '../modules/hero/imagesService.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.HERO_IMAGE_MAX_FILE_SIZE ?? 5 * 1024 * 1024),
  },
})

const createImageSchema = z.object({
  heroApiId: z.coerce.number().int().positive(),
  alt: z.string().min(1).max(160),
  variant: z.string().min(1).max(32).optional(),
})

const updateImageSchema = z.object({
  alt: z.string().min(1).max(160).optional(),
  is_active: z.boolean().optional(),
  variant: z.string().min(1).max(32).optional(),
})

const listQuerySchema = z.object({
  heroApiId: z.coerce.number().int().positive().optional(),
  onlyActive: z
    .preprocess((value) => (value === 'false' ? false : true), z.boolean())
    .optional(),
})

export const heroImagesRouter = express.Router()

heroImagesRouter.post('/', upload.single('image'), async (req, res, next) => {
  try {
    // Ensure storage target exists before validating/uploading incoming files.
    await ensureBucket()
    const { heroApiId, alt, variant } = createImageSchema.parse(req.body)

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required.' })
    }

    const heroExists = await verifyHeroExists(heroApiId)
    if (!heroExists) {
      return res.status(404).json({ error: `Hero ${heroApiId} was not found in the cache.` })
    }

    // Enforce per-hero image caps to keep gallery size bounded.
    await enforceHeroQuota(heroApiId)
    const image = await uploadHeroImage({ file: req.file, heroApiId, alt, variant })
    res.status(201).json(image)
  } catch (error) {
    next(error)
  }
})

heroImagesRouter.get('/', async (req, res, next) => {
  try {
    const { heroApiId, onlyActive } = listQuerySchema.parse({
      heroApiId: req.query.heroApiId,
      onlyActive: req.query.onlyActive,
    })
    const images = await listHeroImages({
      heroApiId,
      onlyActive: onlyActive ?? true,
    })
    res.json(images)
  } catch (error) {
    next(error)
  }
})

heroImagesRouter.get('/:heroApiId', async (req, res, next) => {
  try {
    const heroApiId = Number(req.params.heroApiId)
    if (Number.isNaN(heroApiId)) {
      return res.status(400).json({ error: 'heroApiId must be numeric.' })
    }
    const images = await listHeroImages({ heroApiId, onlyActive: true })
    res.json(images)
  } catch (error) {
    next(error)
  }
})

heroImagesRouter.patch('/:id', async (req, res, next) => {
  try {
    const payload = updateImageSchema.parse(req.body)
    const image = await updateHeroImage(req.params.id, payload)
    res.json(image)
  } catch (error) {
    next(error)
  }
})
