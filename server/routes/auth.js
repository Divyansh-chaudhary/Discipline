import { requireAuth, clearAuthCookie, publicUser, setAuthCookie, signToken } from '../auth.js'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { User } from '../models.js'
import { ensureUserDefaults } from '../store.js'

export const authRouter = Router()

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

authRouter.post('/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Use a valid email' })
      return
    }
    if (!password) {
      res.status(400).json({ error: 'Password is required' })
      return
    }
    const exists = await User.findOne({ email })
    if (exists) {
      res.status(409).json({ error: 'That email is already registered' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ email, passwordHash })
    await ensureUserDefaults(String(user._id))
    const token = signToken(String(user._id))
    setAuthCookie(res, token)
    res.status(201).json({ user: publicUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not register' })
  }
})

authRouter.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = String(req.body?.password || '')
    const user = await User.findOne({ email })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Wrong email or password' })
      return
    }
    const token = signToken(String(user._id))
    setAuthCookie(res, token)
    res.json({ user: publicUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not sign in' })
  }
})

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})
