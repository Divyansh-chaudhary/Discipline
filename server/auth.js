import jwt from 'jsonwebtoken'
import { User } from './models.js'
import { toClient } from './json.js'

const COOKIE = 'discipline_token'
const WEEK = 7 * 24 * 60 * 60 * 1000

function secret() {
  const value = process.env.JWT_SECRET
  if (!value) throw new Error('Missing JWT_SECRET')
  return value
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, secret(), { expiresIn: '30d' })
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * WEEK,
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' })
}

export function readToken(req) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return req.cookies?.[COOKIE] || null
}

export async function requireAuth(req, res, next) {
  const token = readToken(req)
  if (!token) {
    res.status(401).json({ error: 'Sign in required' })
    return
  }
  try {
    const payload = jwt.verify(token, secret())
    const user = await User.findById(payload.sub)
    if (!user) {
      res.status(401).json({ error: 'Account not found' })
      return
    }
    req.user = user
    req.userId = String(user._id)
    next()
  } catch {
    res.status(401).json({ error: 'Session expired' })
  }
}

export function publicUser(user) {
  return { id: String(user._id), email: user.email }
}

export { toClient, COOKIE }
