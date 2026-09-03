import { DEFAULT_TARGETS } from './disciplineShared.js'
import { loadDiscipline, syncDiscipline } from './discipline.js'
import { newId, toClient, toClientList } from './json.js'
import {
  CustomFood,
  FoodLog,
  LegacyWorkoutTemplate,
  Profile,
  Settings,
  Workout,
  WorkoutSet,
  WorkoutType,
} from './models.js'

export { DEFAULT_TARGETS }

export async function ensureUserDefaults(userId) {
  await Settings.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, ...DEFAULT_TARGETS } },
    { upsert: true },
  )
  await Profile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, key: 'xp', totalXp: 0 } },
    { upsert: true },
  )
}

export async function getSettings(userId) {
  const row = await Settings.findOne({ userId }).lean()
  const data = row || { ...DEFAULT_TARGETS }
  return {
    calories: Number(data.calories) || 0,
    protein: Number(data.protein) || 0,
    carbs: Number(data.carbs) || 0,
    fat: Number(data.fat) || 0,
  }
}

export async function saveSettings(userId, targets = {}) {
  const next = {
    calories: Number(targets.calories) || 0,
    protein: Number(targets.protein) || 0,
    carbs: Number(targets.carbs) || 0,
    fat: Number(targets.fat) || 0,
  }
  await Settings.findOneAndUpdate(
    { userId },
    { $set: next, $setOnInsert: { userId } },
    { upsert: true, new: true },
  )
  return getSettings(userId)
}

async function upsertById(Model, userId, entityId, payload) {
  const id = entityId || newId()
  const existing = await Model.findOne({ _id: id, userId })
  if (existing) {
    Object.assign(existing, payload)
    await existing.save()
    return toClient(existing)
  }
  const created = await Model.create({ _id: id, userId, ...payload })
  return toClient(created)
}

export async function listFoods(userId) {
  const rows = await CustomFood.find({ userId }).sort({ name: 1 }).lean()
  return toClientList(rows)
}

export async function createFood(userId, payload, entityId) {
  const body = {
    name: String(payload.name || '').trim(),
    servingLabel: String(payload.servingLabel || '1 serving').trim(),
    calories: Number(payload.calories) || 0,
    protein: Number(payload.protein) || 0,
    carbs: Number(payload.carbs) || 0,
    fat: Number(payload.fat) || 0,
    source: payload.source || 'custom',
    fdcId: payload.fdcId ?? null,
    createdAt: payload.createdAt || Date.now(),
    updatedAt: payload.updatedAt || Date.now(),
  }
  if (!body.name) throw Object.assign(new Error('Name is required'), { status: 400 })
  return upsertById(CustomFood, userId, entityId, body)
}

export async function updateFood(userId, entityId, payload) {
  const row = await CustomFood.findOne({ _id: entityId, userId })
  if (!row) throw Object.assign(new Error('Food not found'), { status: 404 })
  Object.assign(row, {
    name: payload.name != null ? String(payload.name).trim() : row.name,
    servingLabel: payload.servingLabel != null ? String(payload.servingLabel).trim() : row.servingLabel,
    calories: payload.calories != null ? Number(payload.calories) || 0 : row.calories,
    protein: payload.protein != null ? Number(payload.protein) || 0 : row.protein,
    carbs: payload.carbs != null ? Number(payload.carbs) || 0 : row.carbs,
    fat: payload.fat != null ? Number(payload.fat) || 0 : row.fat,
    updatedAt: Date.now(),
  })
  await row.save()
  return toClient(row)
}

export async function deleteFood(userId, entityId) {
  await CustomFood.deleteOne({ _id: entityId, userId })
  return { id: entityId }
}

export async function logsForDate(userId, date) {
  const rows = await FoodLog.find({ userId, date }).sort({ createdAt: 1 }).lean()
  return toClientList(rows)
}

export async function createLog(userId, payload, entityId) {
  const body = {
    date: payload.date,
    name: String(payload.name || '').trim(),
    servings: Number(payload.servings) || 1,
    calories: Number(payload.calories) || 0,
    protein: Number(payload.protein) || 0,
    carbs: Number(payload.carbs) || 0,
    fat: Number(payload.fat) || 0,
    source: payload.source || 'manual',
    customFoodId: payload.customFoodId || null,
    fdcId: payload.fdcId ?? null,
  }
  if (!body.date || !body.name) {
    throw Object.assign(new Error('Date and name are required'), { status: 400 })
  }
  return upsertById(FoodLog, userId, entityId, body)
}

export async function deleteLog(userId, entityId) {
  await FoodLog.deleteOne({ _id: entityId, userId })
  return { id: entityId }
}

export async function getOrCreateWorkout(userId, date, name = 'Session', entityId) {
  const existing = await Workout.findOne({ userId, date })
  if (existing) return toClient(existing)
  try {
    const created = await Workout.create({
      _id: entityId || newId(),
      userId,
      date,
      name: name || 'Session',
    })
    return toClient(created)
  } catch (err) {
    if (err?.code === 11000) {
      const again = await Workout.findOne({ userId, date })
      if (again) return toClient(again)
    }
    throw err
  }
}

export async function updateWorkout(userId, entityId, payload) {
  let row = await Workout.findOne({ _id: entityId, userId })
  if (!row && payload?.date) {
    row = await Workout.findOne({ userId, date: payload.date })
  }
  if (!row) throw Object.assign(new Error('Workout not found'), { status: 404 })
  if (payload.name != null) row.name = String(payload.name).trim() || row.name
  await row.save()
  return toClient(row)
}

async function resolveWorkout(userId, payload, entityId) {
  if (payload?.workoutId) {
    const byId = await Workout.findOne({ _id: payload.workoutId, userId })
    if (byId) return byId
  }
  if (entityId) {
    const byEntity = await Workout.findOne({ _id: entityId, userId })
    if (byEntity) return byEntity
  }
  if (payload?.date) {
    return Workout.findOne({ userId, date: payload.date })
  }
  return null
}

export async function setsForWorkout(userId, workoutId) {
  const rows = await WorkoutSet.find({ userId, workoutId }).sort({ createdAt: 1 }).lean()
  return toClientList(rows)
}

export async function createSet(userId, payload, entityId) {
  let workout = await resolveWorkout(userId, payload)
  if (!workout && payload?.date) {
    workout = await Workout.create({
      _id: payload.workoutId || newId(),
      userId,
      date: payload.date,
      name: payload.workoutName || 'Session',
    }).catch(async (err) => {
      if (err?.code === 11000) return Workout.findOne({ userId, date: payload.date })
      throw err
    })
  }
  if (!workout) throw Object.assign(new Error('Workout not found'), { status: 400 })
  const body = {
    workoutId: String(workout._id),
    date: payload.date || workout.date,
    exercise: String(payload.exercise || '').trim(),
    reps: Number(payload.reps) || 0,
    weight: Number(payload.weight) || 0,
    setNumber: Number(payload.setNumber) || 1,
  }
  if (!body.exercise) throw Object.assign(new Error('Exercise is required'), { status: 400 })
  return upsertById(WorkoutSet, userId, entityId, body)
}

export async function updateSet(userId, entityId, payload) {
  const row = await WorkoutSet.findOne({ _id: entityId, userId })
  if (!row) throw Object.assign(new Error('Set not found'), { status: 404 })
  if (payload.reps != null) row.reps = Number(payload.reps) || 0
  if (payload.weight != null) row.weight = Number(payload.weight) || 0
  if (payload.setNumber != null) row.setNumber = Number(payload.setNumber) || row.setNumber
  if (payload.exercise != null) row.exercise = String(payload.exercise).trim() || row.exercise
  await row.save()
  return toClient(row)
}

export async function deleteSet(userId, entityId) {
  const row = await WorkoutSet.findOne({ _id: entityId, userId })
  if (!row) return { id: entityId }
  const { workoutId, exercise } = row
  await WorkoutSet.deleteOne({ _id: entityId, userId })
  const rest = await WorkoutSet.find({ userId, workoutId, exercise }).sort({ setNumber: 1, createdAt: 1 })
  await Promise.all(rest.map((set, i) => {
    set.setNumber = i + 1
    return set.save()
  }))
  return { id: entityId }
}

export async function deleteExercise(userId, workoutId, exercise) {
  await WorkoutSet.deleteMany({ userId, workoutId, exercise })
  return { workoutId, exercise }
}

function normalizePlannedExercises(exercises = []) {
  return exercises
    .map((exercise) => ({
      id: String(exercise.id || newId()),
      name: String(exercise.name || '').trim(),
      sets: Math.max(1, Number(exercise.sets) || 1),
      reps: Math.max(0, Number(exercise.reps) || 0),
      weight: Math.max(0, Number(exercise.weight) || 0),
    }))
    .filter((exercise) => exercise.name)
}

function normalizeSplits(splits = []) {
  return splits
    .map((split) => ({
      id: String(split.id || newId()),
      name: String(split.name || '').trim(),
      exercises: normalizePlannedExercises(split.exercises),
    }))
    .filter((split) => split.name)
}

/**
 * Folds pre-rewrite templates into workout types, merging rows that share a
 * name so the old duplicate-per-save behaviour collapses into one type.
 */
async function migrateLegacyTemplates(userId) {
  const legacy = await LegacyWorkoutTemplate.find({ userId }).lean()
  if (!legacy.length) return

  const existing = await WorkoutType.find({ userId }).lean()
  const merged = new Map(
    existing.map((row) => [String(row.name).trim().toLowerCase(), { id: row._id, name: row.name, active: row.active, splits: normalizeSplits(row.splits) }]),
  )

  for (const row of legacy) {
    const name = String(row.name || '').trim() || 'Workout'
    const splits = row.days?.length
      ? normalizeSplits(row.days)
      : normalizeSplits(row.exercises?.length ? [{ name, exercises: row.exercises }] : [])
    const key = name.toLowerCase()
    const target = merged.get(key)
    if (!target) {
      merged.set(key, { id: newId(), name, active: false, splits })
      continue
    }
    for (const split of splits) {
      const twin = target.splits.find((item) => item.name.toLowerCase() === split.name.toLowerCase())
      if (!twin) {
        target.splits.push(split)
        continue
      }
      const seen = new Set(twin.exercises.map((exercise) => exercise.name.toLowerCase()))
      twin.exercises.push(...split.exercises.filter((exercise) => !seen.has(exercise.name.toLowerCase())))
    }
  }

  const types = [...merged.values()]
  if (!types.some((type) => type.active) && types.length) types[0].active = true
  await Promise.all(
    types.map((type) =>
      WorkoutType.findOneAndUpdate(
        { _id: type.id, userId },
        { $set: { name: type.name, active: type.active, splits: type.splits }, $setOnInsert: { userId } },
        { upsert: true },
      ),
    ),
  )
  await LegacyWorkoutTemplate.deleteMany({ userId })
}

export async function listWorkoutTypes(userId) {
  await migrateLegacyTemplates(userId)
  const rows = await WorkoutType.find({ userId }).sort({ name: 1 }).lean()
  return toClientList(rows)
}

export async function saveWorkoutType(userId, payload, entityId) {
  const body = {
    name: String(payload.name || '').trim(),
    active: Boolean(payload.active),
    splits: normalizeSplits(payload.splits),
  }
  if (!body.name) throw Object.assign(new Error('Workout type needs a name'), { status: 400 })
  const saved = await upsertById(WorkoutType, userId, entityId, body)
  if (body.active) {
    await WorkoutType.updateMany({ userId, _id: { $ne: saved.id } }, { $set: { active: false } })
  }
  return saved
}

export async function activateWorkoutType(userId, entityId) {
  const row = await WorkoutType.findOne({ _id: entityId, userId })
  if (!row) throw Object.assign(new Error('Workout type not found'), { status: 404 })
  await WorkoutType.updateMany({ userId }, { $set: { active: false } })
  row.active = true
  await row.save()
  return toClient(row)
}

export async function deleteWorkoutType(userId, entityId) {
  await WorkoutType.deleteOne({ _id: entityId, userId })
  const remaining = await WorkoutType.find({ userId }).sort({ name: 1 })
  if (remaining.length && !remaining.some((row) => row.active)) {
    remaining[0].active = true
    await remaining[0].save()
  }
  return { id: entityId }
}

export async function getDay(userId, date) {
  const workoutDoc = await Workout.findOne({ userId, date }).lean()
  const workout = toClient(workoutDoc)
  const sets = workout ? await setsForWorkout(userId, workout.id) : []
  const logs = await logsForDate(userId, date)
  return { date, logs, workout, sets }
}

export async function bootstrap(userId, date) {
  await ensureUserDefaults(userId)
  const [settings, customFoods, workoutTypes, day, discipline] = await Promise.all([
    getSettings(userId),
    listFoods(userId),
    listWorkoutTypes(userId),
    getDay(userId, date),
    loadDiscipline(userId),
  ])
  return { settings, customFoods, workoutTypes, ...day, discipline }
}

export async function applyMutation(userId, mutation, clientDate) {
  const op = mutation.op
  const resource = mutation.resource
  const entityId = mutation.entityId
  const payload = mutation.payload || {}
  let entity = null

  if (resource === 'settings' && (op === 'update' || op === 'upsert')) {
    entity = await saveSettings(userId, payload)
  } else if (resource === 'customFoods' && op === 'create') {
    entity = await createFood(userId, payload, entityId)
  } else if (resource === 'customFoods' && op === 'update') {
    entity = await updateFood(userId, entityId, payload)
  } else if (resource === 'customFoods' && op === 'delete') {
    entity = await deleteFood(userId, entityId)
  } else if (resource === 'foodLogs' && op === 'create') {
    entity = await createLog(userId, payload, entityId)
  } else if (resource === 'foodLogs' && op === 'delete') {
    entity = await deleteLog(userId, entityId)
  } else if (resource === 'workouts' && op === 'create') {
    entity = await getOrCreateWorkout(userId, payload.date, payload.name, entityId)
  } else if (resource === 'workouts' && op === 'update') {
    entity = await updateWorkout(userId, entityId, payload)
  } else if (resource === 'workoutSets' && op === 'create') {
    entity = await createSet(userId, payload, entityId)
  } else if (resource === 'workoutSets' && op === 'update') {
    entity = await updateSet(userId, entityId, payload)
  } else if (resource === 'workoutSets' && op === 'delete') {
    entity = await deleteSet(userId, entityId)
  } else if (resource === 'workoutExercises' && op === 'delete') {
    entity = await deleteExercise(userId, payload.workoutId || entityId, payload.exercise)
  } else if (resource === 'workoutTypes' && (op === 'create' || op === 'update')) {
    entity = await saveWorkoutType(userId, payload, entityId)
  } else if (resource === 'workoutTypes' && op === 'activate') {
    entity = await activateWorkoutType(userId, entityId)
  } else if (resource === 'workoutTypes' && op === 'delete') {
    entity = await deleteWorkoutType(userId, entityId)
  } else {
    throw Object.assign(new Error(`Unknown mutation ${op} ${resource}`), { status: 400 })
  }

  const discipline = await syncDiscipline(userId, clientDate || payload.date)
  return { ok: true, resource, entity, discipline }
}
