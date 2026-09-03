import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { requireAuth } from './auth.js'
import { connectDb, dbReady, markDbDown } from './db.js'
import { authRouter } from './routes/auth.js'
import { apiRouter } from './routes/api.js'

const PORT = Number(process.env.PORT) || 8787
const app = express()

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
      error: 'Database unavailable. In MongoDB Atlas → Network Access, allow your IP or 0.0.0.0/0.',
    })
    return
  }
  next()
})

app.use('/api/auth', authRouter)
app.use('/api', requireAuth, apiRouter)

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('Missing MONGODB_URI in .env')
  process.exit(1)
}

async function start() {
  try {
    await connectDb(uri)
    console.log('Connected to MongoDB Atlas')
  } catch (err) {
    markDbDown(err)
    console.error('MongoDB connection failed. Allow your IP (or 0.0.0.0/0) in Atlas Network Access.')
    console.error(err.message)
  }
  app.listen(PORT, () => {
    console.log(`Discipline API http://127.0.0.1:${PORT}`)
  })
}

start()
