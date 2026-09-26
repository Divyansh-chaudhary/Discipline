import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../api/client.js'
import { shiftDateKey, localDateKey } from '../lib/dates.js'
import { fetchCached, writeCache } from './cache.js'
import { clearDraft, loadDraft, saveDraft } from './drafts.js'
import {
  buildDraftFromServer,
  findSplit,
  mergeDraftRows,
  serializeGroups,
  splitExerciseNames,
} from './utils.js'

async function fetchSplitDay(splitId, date, exerciseNames) {
  const query = new URLSearchParams({
    date,
    splitId,
    exercises: exerciseNames.join(','),
  })
  return api(`/api/workouts/split?${query}`)
}

function exercisesFingerprint(split) {
  return (split?.exercises || []).map((row) => `${row.id}:${row.name}`).join('|')
}

export function useWorkoutGroup({ userId, routine, splitId, date, setDate }) {
  const split = useMemo(() => findSplit(routine, splitId), [routine, splitId])
  const templateKey = useMemo(() => `${splitId}:${exercisesFingerprint(split)}`, [split, splitId])
  const exerciseNames = useMemo(() => splitExerciseNames(split), [templateKey, split])

  const splitRef = useRef(split)
  splitRef.current = split
  const exerciseNamesRef = useRef(exerciseNames)
  exerciseNamesRef.current = exerciseNames

  const [exercises, setExercises] = useState([])
  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [dirty, setDirty] = useState(false)
  const activeDateRef = useRef(null)

  const loadDate = useCallback(
    async (targetDate, { silent = false } = {}) => {
      const currentSplit = splitRef.current
      const names = exerciseNamesRef.current
      if (!userId || !splitId || !currentSplit) return

      if (!silent && activeDateRef.current !== targetDate) setLoading(true)

      try {
        const server = await fetchCached(splitId, targetDate, () =>
          fetchSplitDay(splitId, targetDate, names),
        )
        const serverDraft = buildDraftFromServer(currentSplit, server.sets || [], server.previous || {})
        const local = await loadDraft(userId, splitId, targetDate)
        const merged = local?.exercises?.length
          ? mergeDraftRows(serverDraft, local.exercises)
          : serverDraft
        setExercises(merged)
        setWorkout(server.workout)
        setDirty(Boolean(local?.dirty))
        setSyncError(local?.syncError || '')
        activeDateRef.current = targetDate
      } catch (err) {
        const local = await loadDraft(userId, splitId, targetDate)
        if (local?.exercises?.length) {
          setExercises(local.exercises)
          setDirty(true)
          setSyncError(err.message || 'Could not load workout')
          activeDateRef.current = targetDate
        } else {
          setSyncError(err.message || 'Could not load workout')
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [splitId, userId],
  )

  useEffect(() => {
    if (!splitRef.current) return undefined
    activeDateRef.current = null
    loadDate(date)

    const yesterday = shiftDateKey(date, -1)
    const names = exerciseNamesRef.current
    fetchCached(splitId, yesterday, () => fetchSplitDay(splitId, yesterday, names)).catch(() => {})
    return undefined
  }, [date, loadDate, splitId, templateKey])

  const persistLocal = useCallback(
    async (nextExercises, extra = {}) => {
      if (!userId) return
      setDirty(true)
      await saveDraft(userId, splitId, date, {
        exercises: nextExercises,
        dirty: true,
        ...extra,
      })
    },
    [date, splitId, userId],
  )

  const patchExercises = useCallback(
    (updater) => {
      setExercises((current) => {
        const next = updater(current)
        persistLocal(next)
        return next
      })
    },
    [persistLocal],
  )

  const updateSet = useCallback(
    (exerciseName, index, key, value) => {
      patchExercises((rows) =>
        rows.map((row) =>
          row.exercise !== exerciseName
            ? row
            : {
                ...row,
                sets: row.sets.map((set, i) => (i === index ? { ...set, [key]: value } : set)),
              },
        ),
      )
    },
    [patchExercises],
  )

  const addSet = useCallback(
    (exerciseName) => {
      patchExercises((rows) =>
        rows.map((row) => {
          if (row.exercise !== exerciseName) return row
          const last = row.sets[row.sets.length - 1]
          return {
            ...row,
            sets: [...row.sets, { id: null, weight: last?.weight ?? '', reps: last?.reps ?? '' }],
          }
        }),
      )
    },
    [patchExercises],
  )

  const removeSet = useCallback(
    (exerciseName, index) => {
      patchExercises((rows) =>
        rows.map((row) =>
          row.exercise !== exerciseName
            ? row
            : { ...row, sets: row.sets.filter((_, i) => i !== index) },
        ),
      )
    },
    [patchExercises],
  )

  const saveWorkout = useCallback(async () => {
    const currentSplit = splitRef.current
    if (!currentSplit) return { ok: false }
    setSaving(true)
    setSyncError('')
    const groups = serializeGroups(exercises)
    try {
      const result = await api('/api/workouts/split/save', {
        method: 'POST',
        body: {
          date,
          splitId,
          splitName: currentSplit.name,
          workoutId: workout?.id,
          groups,
        },
      })
      writeCache(splitId, date, {
        workout: result.workout,
        sets: result.sets || [],
        previous: {},
        date,
        splitId,
      })
      await clearDraft(userId, splitId, date)
      setWorkout(result.workout)
      setDirty(false)
      return { ok: true, workout: result.workout }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Workout could not be synced. Your changes are saved locally.'
      setSyncError(message)
      await saveDraft(userId, splitId, date, { exercises, dirty: true, syncError: message })
      return { ok: false, error: message }
    } finally {
      setSaving(false)
    }
  }, [date, exercises, splitId, userId, workout])

  const completeWorkout = useCallback(
    async (completed = true) => {
      const saved = dirty ? await saveWorkout() : { ok: true, workout }
      if (!saved.ok) return saved
      const session = saved.workout || workout
      if (!session?.id) return { ok: false, error: 'No workout to complete' }
      try {
        const result = await api(`/api/workouts/${session.id}`, {
          method: 'PUT',
          body: {
            date,
            splitId,
            completed,
            completedAt: completed ? Date.now() : null,
          },
        })
        const nextWorkout = result.entity || result.workout || result
        setWorkout(nextWorkout)
        const fresh = await fetchSplitDay(splitId, date, exerciseNamesRef.current)
        writeCache(splitId, date, fresh)
        return { ok: true }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Could not update completion'
        setSyncError(message)
        return { ok: false, error: message }
      }
    },
    [date, dirty, saveWorkout, splitId, workout],
  )

  const goDate = useCallback(
    (nextDate) => {
      if (nextDate > localDateKey()) return
      setDate(nextDate)
      const prefetch = shiftDateKey(nextDate, -1)
      fetchCached(splitId, prefetch, () =>
        fetchSplitDay(splitId, prefetch, exerciseNamesRef.current),
      ).catch(() => {})
    },
    [setDate, splitId],
  )

  return {
    split,
    exercises,
    workout,
    loading,
    saving,
    dirty,
    syncError,
    completed: Boolean(workout?.completedAt),
    updateSet,
    addSet,
    removeSet,
    saveWorkout,
    completeWorkout,
    goDate,
    reload: () => loadDate(date, { silent: true }),
  }
}
