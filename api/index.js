import { app } from '../server/app.js'

/** Single entry so every /api/* path hits Express (Vercel catch-alls only matched one segment). */
export default app
