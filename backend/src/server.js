import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { environment } from './config/environment.js'
import { heroImagesRouter } from './routes/heroImagesRoutes.js'
import { heroTimelineRouter } from './routes/heroTimelineRoutes.js'
import { gcdRouter } from './routes/gcdRoutes.js'
import { errorHandler } from './middlewares/errorHandler.js'

const app = express()

app.use(
  cors({
    origin: environment.allowedOrigins.length ? environment.allowedOrigins : undefined,
  })
)
app.use(express.json())
app.use(morgan('tiny'))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/hero-images', heroImagesRouter)
app.use('/hero-timelines', heroTimelineRouter)
app.use('/gcd', gcdRouter)
app.use(errorHandler)

app.listen(environment.serverPort, () => {
  console.log(`Hero image backend running on http://localhost:${environment.serverPort}`)
})
