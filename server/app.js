import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { requireAuth } from './auth.js'
import { connectDb, dbReady, markDbDown } from './db.js'
import { authRouter } from './routes/auth.js'
import { apiRouter } from './routes/api.js'

export const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: dbReady })
})

app.use((req, res, next) => {
  if (!req.path.startsWith('/api') || req.path === '/api/health' || req.path === '/api/auth/logout') {
    next()
    return
  }
  if (!dbReady) {
    res.status(503).json({
      error: 'Service temporarily unavailable. Try again in a moment.',
    })
    return
  }
  next()
})

app.use('/api/auth', authRouter)
app.use('/api', requireAuth, apiRouter)

let connecting = null

/** Connect once and reuse across serverless invocations. */
export async function ensureDb() {
  if (dbReady) return
  if (connecting) return connecting
  const uri = process.env.MONGODB_URI
  if (!uri) {
    markDbDown(new Error('Missing MONGODB_URI'))
    throw new Error('Missing MONGODB_URI')
  }
  connecting = connectDb(uri)
    .then(() => {
      connecting = null
    })
    .catch((err) => {
      connecting = null
      markDbDown(err)
      throw err
    })
  return connecting
}
