import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { environment } from './config/environment.js'
import { heroImagesRouter } from './routes/heroImagesRoutes.js'
import { heroTimelineRouter } from './routes/heroTimelineRoutes.js'
import { gcdRouter } from './routes/gcdRoutes.js'
import { issueStatesRouter } from './routes/issueStateRoutes.js'
import { errorHandler } from './middlewares/errorHandler.js'

const app = express()
app.set('trust proxy', 1)

const wildcardToRegExp = (pattern) => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`, 'i')
}

const originPatternRegexes = environment.allowedOriginPatterns.map((pattern) => wildcardToRegExp(pattern))

const isOriginAllowed = (origin) => {
  if (!origin) return true
  if (environment.allowedOrigins.includes(origin)) return true
  return originPatternRegexes.some((regex) => regex.test(origin))
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!environment.allowedOrigins.length && !originPatternRegexes.length) {
        callback(null, true)
        return
      }
      if (isOriginAllowed(origin)) {
        callback(null, true)
        return
      }
      const corsError = new Error(`CORS origin not allowed: ${origin}`)
      corsError.status = 403
      callback(corsError)
    },
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
app.use('/issue-states', issueStatesRouter)
app.use(errorHandler)

app.listen(environment.serverPort, environment.serverHost, () => {
  console.log(`IssueLine backend running on http://${environment.serverHost}:${environment.serverPort}`)
})
