import { app, ensureDb } from '../server/app.js'

/** Catch-all so Vercel routes every /api/* call through Express. */
export default async function handler(req, res) {
  try {
    await ensureDb()
  } catch {
    // Routes return a clean 503 when the database is down
  }
  return app(req, res)
}
