import { Router } from 'express'
import { dbError, dbReady } from '../db.js'
import { localDateKey } from '../dates.js'
import {
  applyMutation,
  bootstrap,
  createFood,
  createLog,
  createSet,
  deleteExercise,
  deleteFood,
  deleteLog,
  deleteSet,
  getDay,
  getOrCreateWorkout,
  getSettings,
  listFoods,
  updateFood,
  updateSet,
  updateWorkout,
} from '../store.js'
import { loadDiscipline, syncDiscipline } from '../discipline.js'

export const apiRouter = Router()

function clientDate(req) {
  return String(req.body?.clientDate || req.query.date || req.headers['x-client-date'] || localDateKey())
}

function sendError(res, err) {
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: err.message || 'Server error' })
}

apiRouter.get('/sync/status', (req, res) => {
  res.json({
    ok: dbReady,
    db: dbReady,
    error: dbError,
    userId: req.userId,
  })
})

apiRouter.get('/bootstrap', async (req, res) => {
  try {
    const date = String(req.query.date || localDateKey())
    const data = await bootstrap(req.userId, date)
    res.json(data)
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.get('/days/:date', async (req, res) => {
  try {
    const data = await getDay(req.userId, req.params.date)
    res.json(data)
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.get('/settings', async (req, res) => {
  try {
    res.json(await getSettings(req.userId))
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.put('/settings', async (req, res) => {
  try {
    const result = await applyMutation(
      req.userId,
      { op: 'update', resource: 'settings', payload: req.body },
      clientDate(req),
    )
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.get('/foods', async (req, res) => {
  try {
    res.json(await listFoods(req.userId))
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.post('/foods', async (req, res) => {
  try {
    const entity = await createFood(req.userId, req.body, req.body?.id)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.status(201).json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.put('/foods/:id', async (req, res) => {
  try {
    const entity = await updateFood(req.userId, req.params.id, req.body)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.delete('/foods/:id', async (req, res) => {
  try {
    const entity = await deleteFood(req.userId, req.params.id)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.get('/logs', async (req, res) => {
  try {
    const date = String(req.query.date || localDateKey())
    const day = await getDay(req.userId, date)
    res.json(day.logs)
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.post('/logs', async (req, res) => {
  try {
    const entity = await createLog(req.userId, req.body, req.body?.id)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.status(201).json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.delete('/logs/:id', async (req, res) => {
  try {
    const entity = await deleteLog(req.userId, req.params.id)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.get('/workouts', async (req, res) => {
  try {
    const date = String(req.query.date || localDateKey())
    const day = await getDay(req.userId, date)
    res.json({ workout: day.workout, sets: day.sets })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.post('/workouts', async (req, res) => {
  try {
    const entity = await getOrCreateWorkout(req.userId, req.body.date, req.body.name, req.body.id)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.status(201).json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.put('/workouts/:id', async (req, res) => {
  try {
    const entity = await updateWorkout(req.userId, req.params.id, req.body)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.post('/sets', async (req, res) => {
  try {
    const entity = await createSet(req.userId, req.body, req.body?.id)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.status(201).json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.put('/sets/:id', async (req, res) => {
  try {
    const entity = await updateSet(req.userId, req.params.id, req.body)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.delete('/sets/:id', async (req, res) => {
  try {
    const entity = await deleteSet(req.userId, req.params.id)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.post('/workouts/:id/exercises/delete', async (req, res) => {
  try {
    const entity = await deleteExercise(req.userId, req.params.id, req.body.exercise)
    const discipline = await syncDiscipline(req.userId, clientDate(req))
    res.json({ entity, discipline })
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.get('/discipline', async (req, res) => {
  try {
    res.json(await loadDiscipline(req.userId))
  } catch (err) {
    sendError(res, err)
  }
})

apiRouter.post('/mutations', async (req, res) => {
  try {
    const result = await applyMutation(req.userId, req.body, clientDate(req))
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})
