import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData, useDay } from '../sync/DataContext.jsx'

export function activeWorkoutType(types = []) {
  return types.find((type) => type.active) || types[0] || null
}

export function groupSets(sets) {
  const order = []
  const map = new Map()
  for (const set of sets) {
    if (!map.has(set.exercise)) {
      map.set(set.exercise, [])
      order.push(set.exercise)
    }
    map.get(set.exercise).push(set)
  }
  return order.map((exercise) => ({ exercise, sets: map.get(exercise) }))
}

/** Headline numbers for a session: exercises, sets, and total load moved. */
export function sessionSummary(sets = []) {
  const groups = groupSets(sets)
  const volume = sets.reduce(
    (total, set) => total + (Number(set.reps) || 0) * (Number(set.weight) || 0),
    0,
  )
  return { groups, exercises: groups.length, setCount: sets.length, volume }
}

/** "4×8 · 60kg" style line for one exercise. */
export function exerciseLine(sets = []) {
  if (!sets.length) return 'No sets'
  const weights = [...new Set(sets.map((set) => Number(set.weight) || 0))]
  const reps = [...new Set(sets.map((set) => Number(set.reps) || 0))]
  const repPart = reps.length === 1 ? `${sets.length}×${reps[0]}` : sets.map((s) => s.reps).join('/')
  const weightPart = weights.length === 1 ? `${weights[0]}kg` : `${Math.min(...weights)}–${Math.max(...weights)}kg`
  return `${repPart} · ${weightPart}`
}

/**
 * Copies a planned split into the day's session, topping up to the planned set
 * count so re-running it never duplicates sets already logged.
 */
export function useSplitStarter(date, { redirectTo } = {}) {
  const { ensureWorkout, renameWorkout, saveSessionSets } = useData()
  const { workout, sets } = useDay(date)
  const navigate = useNavigate()

  return useCallback(
    async (type, split) => {
      const title = `${type.name} · ${split.name}`
      const session = workout ?? (await ensureWorkout(date, title))
      if (!session) return

      // Build the full target session locally, then persist it in one request.
      const groups = (split.exercises || []).map((exercise) => {
        const logged = sets.filter((set) => set.exercise === exercise.name)
        const target = Math.max(logged.length, Number(exercise.sets) || 1)
        const rows = []
        for (let index = 0; index < target; index += 1) {
          const existing = logged[index]
          rows.push({
            id: existing?.id,
            reps: existing ? existing.reps : Number(exercise.reps) || 0,
            weight: existing ? existing.weight : Number(exercise.weight) || 0,
          })
        }
        return { exercise: exercise.name, sets: rows }
      })

      await Promise.all([
        renameWorkout(date, session.id, title),
        groups.length ? saveSessionSets(date, groups) : Promise.resolve(),
      ])
      if (redirectTo) navigate(redirectTo)
    },
    [date, ensureWorkout, navigate, redirectTo, renameWorkout, saveSessionSets, sets, workout],
  )
}
