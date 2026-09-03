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

/**
 * Copies a planned split into the day's session, topping up to the planned set
 * count so re-running it never duplicates sets already logged.
 */
export function useSplitStarter(date, { redirectTo } = {}) {
  const { ensureWorkout, renameWorkout, addSet } = useData()
  const { workout, sets } = useDay(date)
  const navigate = useNavigate()

  return useCallback(
    async (type, split) => {
      const title = `${type.name} · ${split.name}`
      const session = workout ?? (await ensureWorkout(date, title))
      if (!session) return
      await renameWorkout(date, session.id, title)
      for (const exercise of split.exercises || []) {
        const logged = sets.filter((set) => set.exercise === exercise.name).length
        const missing = Math.max(0, (Number(exercise.sets) || 1) - logged)
        for (let index = 0; index < missing; index += 1) {
          await addSet(date, {
            workoutId: session.id,
            exercise: exercise.name,
            reps: Number(exercise.reps) || 0,
            weight: Number(exercise.weight) || 0,
            setNumber: logged + index + 1,
          })
        }
      }
      if (redirectTo) navigate(redirectTo)
    },
    [addSet, date, ensureWorkout, navigate, redirectTo, renameWorkout, sets, workout],
  )
}
