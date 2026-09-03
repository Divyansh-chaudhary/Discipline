import 'dotenv/config'
import { app, ensureDb } from './app.js'
import { markDbDown } from './db.js'

const PORT = Number(process.env.PORT) || 8787

async function start() {
  try {
    await ensureDb()
    console.log('Database connected')
  } catch (err) {
    markDbDown(err)
    console.error('Database connection failed.')
    console.error(err.message)
  }
  app.listen(PORT, () => {
    console.log(`Discipline API http://127.0.0.1:${PORT}`)
  })
}

start()
