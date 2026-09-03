import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { requireAuth } from './auth.js'
import { connectDb, dbReady, markDbDown } from './db.js'
import { authRouter } from './routes/auth.js'
import { apiRouter } from './routes/api.js'

export const app = express()

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

app.use(cors({ origin: true, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

/**
 * When Vercel rewrites /api/auth/login → /api, restore the original path so
 * Express route matching still works.
 */
app.use((req, _res, next) => {
  const candidates = [
    req.headers['x-forwarded-uri'],
    req.headers['x-invoke-path'],
    req.headers['x-vercel-forwarded-path'],
  ]
  for (const value of candidates) {
    const path = String(value || '').split('?')[0]
    if (path.startsWith('/api/') && !String(req.url || '').startsWith('/api/')) {
      const query = String(req.url || '').includes('?') ? `?${String(req.url).split('?')[1]}` : ''
      req.url = path + query
      break
    }
  }
  next()
})

app.use(async (_req, _res, next) => {
  try {
    await ensureDb()
  } catch {
    // Routes return a clean 503 when the database is down
  }
  next()
})

function isPublicPath(path) {
  return (
    path === '/api/health' ||
    path === '/health' ||
    path === '/api/auth/logout' ||
    path === '/auth/logout'
  )
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: dbReady })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, db: dbReady })
})

app.use((req, res, next) => {
  if (isPublicPath(req.path)) {
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

// After rewrite to /api, some invocations only see paths without the /api prefix.
app.use('/auth', authRouter)
app.use(requireAuth, apiRouter)
