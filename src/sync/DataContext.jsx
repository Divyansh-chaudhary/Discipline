import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '../api/client.js'
import { DEFAULT_TARGETS } from '../db/index.js'
import { localDateKey } from '../lib/dates.js'
import { drainOutbox, subscribeSyncStatus } from './engine.js'
import { enqueue, subscribeOutbox } from './outbox.js'

const DataContext = createContext(null)
const SESSION_KEY = 'discipline.session'

function emptyDiscipline() {
  return { profile: { key: 'xp', totalXp: 0 }, streaks: [], badges: [] }
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSession(next) {
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next))
  else localStorage.removeItem(SESSION_KEY)
}

function emptyDay() {
  return { logs: [], workout: null, sets: [], loaded: false, unavailable: false }
}

function byName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''))
}

export function DataProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_TARGETS)
  const [customFoods, setCustomFoods] = useState([])
  const [workoutTypes, setWorkoutTypes] = useState([])
  const [days, setDays] = useState({})
  const [discipline, setDiscipline] = useState(emptyDiscipline)
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [queued, setQueued] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [bootError, setBootError] = useState('')
  const [ready, setReady] = useState(false)
  const userRef = useRef(null)
  const daysRef = useRef({})
  const typesRef = useRef([])
  const setTimers = useRef({})
  const ensuring = useRef({})

  useEffect(() => {
    userRef.current = user
  }, [user])
  useEffect(() => {
    daysRef.current = days
  }, [days])
  useEffect(() => {
    typesRef.current = workoutTypes
  }, [workoutTypes])

  const patchDay = useCallback((date, fn) => {
    setDays((prev) => {
      const cur = prev[date] || emptyDay()
      return { ...prev, [date]: { ...cur, ...fn(cur), loaded: true, unavailable: false } }
    })
  }, [])

  const applyDiscipline = useCallback((next) => {
    if (next) setDiscipline(next)
  }, [])

  const commit = useCallback(
    async (mutation, optimistic) => {
      optimistic?.()
      const body = {
        ...mutation,
        userId: userRef.current?.id,
        clientDate: localDateKey(),
      }
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const result = await api('/api/mutations', { method: 'POST', body })
          applyDiscipline(result.discipline)
          return result
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setUser(null)
            throw err
          }
          await enqueue({ ...body, userId: userRef.current?.id })
          return null
        }
      }
      await enqueue({ ...body, userId: userRef.current?.id })
      return null
    },
    [applyDiscipline],
  )

  const applyBootstrap = useCallback((data, date) => {
    if (data.settings) setSettings(data.settings)
    if (data.customFoods) setCustomFoods([...data.customFoods].sort(byName))
    if (data.workoutTypes) setWorkoutTypes([...data.workoutTypes].sort(byName))
    if (data.discipline) setDiscipline(data.discipline)
    const key = data.date || date
    setDays((prev) => ({
      ...prev,
      [key]: {
        logs: data.logs || [],
        workout: data.workout || null,
        sets: data.sets || [],
        loaded: true,
        unavailable: false,
      },
    }))
  }, [])

  const refresh = useCallback(
    async (date = localDateKey()) => {
      const data = await api(`/api/bootstrap?date=${encodeURIComponent(date)}`)
      applyBootstrap(data, date)
      setBootError('')
      return data
    },
    [applyBootstrap],
  )

  const loadDay = useCallback(
    async (date) => {
      setDays((prev) => {
        const cur = prev[date]
        if (cur?.loaded || cur?.loading) return prev
        return { ...prev, [date]: { ...(cur || emptyDay()), loading: true } }
      })
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setDays((prev) => {
          const cur = prev[date] || emptyDay()
          if (cur.loaded) return { ...prev, [date]: { ...cur, loading: false } }
          return {
            ...prev,
            [date]: { ...emptyDay(), unavailable: true, loading: false },
          }
        })
        return
      }
      try {
        const data = await api(`/api/days/${encodeURIComponent(date)}`)
        setDays((prev) => ({
          ...prev,
          [date]: {
            logs: data.logs || [],
            workout: data.workout || null,
            sets: data.sets || [],
            loaded: true,
            unavailable: false,
            loading: false,
          },
        }))
      } catch (err) {
        setDays((prev) => ({
          ...prev,
          [date]: { ...(prev[date] || emptyDay()), loading: false, unavailable: true },
        }))
        if (err instanceof ApiError && err.status === 401) setUser(null)
      }
    },
    [],
  )

  const loadRange = useCallback(async (from, to) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Offline')
    }
    const data = await api(`/api/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    setDays((prev) => {
      const next = { ...prev }
      for (const [date, day] of Object.entries(data.days || {})) {
        next[date] = {
          logs: day.logs || [],
          workout: day.workout || null,
          sets: day.sets || [],
          loaded: true,
          unavailable: false,
          loading: false,
        }
      }
      return next
    })
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    api('/api/auth/me')
      .then((data) => {
        if (cancelled) return
        setUser(data.user)
        writeSession(data.user)
      })
      .catch((err) => {
        if (cancelled) return
        const cached = readSession()
        if (err instanceof ApiError && err.status === 401) {
          writeSession(null)
          setUser(null)
          return
        }
        setUser(cached)
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setReady(false)
      return undefined
    }
    let cancelled = false
    setReady(false)
    refresh()
      .then(async () => {
        if (cancelled) return
        try {
          await drainOutbox(user.id)
          if (!cancelled) await refresh()
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            writeSession(null)
            setUser(null)
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setBootError(err.message || 'Could not load account data')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [user, refresh])

  useEffect(() => subscribeOutbox(setQueued), [])
  useEffect(
    () =>
      subscribeSyncStatus((status) => {
        setSyncing(Boolean(status.syncing))
        if (typeof status.queued === 'number') setQueued(status.queued)
        if (status.authLost) setUser(null)
      }),
    [],
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!online || !user) return undefined
    let cancelled = false
    drainOutbox(user.id)
      .then(async () => {
        if (!cancelled) await refresh()
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [online, user, refresh])

  const login = useCallback(async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } })
    writeSession(data.user)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (email, password) => {
    const data = await api('/api/auth/register', { method: 'POST', body: { email, password } })
    writeSession(data.user)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      /* cookie clear still happens locally */
    }
    writeSession(null)
    setUser(null)
    setSettings(DEFAULT_TARGETS)
    setCustomFoods([])
    setWorkoutTypes([])
    setDays({})
    setDiscipline(emptyDiscipline())
  }, [])

  const saveTargets = useCallback(
    async (targets) => {
      const next = {
        calories: Number(targets.calories) || 0,
        protein: Number(targets.protein) || 0,
        carbs: Number(targets.carbs) || 0,
        fat: Number(targets.fat) || 0,
      }
      await commit(
        { op: 'update', resource: 'settings', entityId: 'targets', payload: next },
        () => setSettings(next),
      )
    },
    [commit],
  )

  const addLog = useCallback(
    async (payload) => {
      const id = crypto.randomUUID()
      const row = { id, ...payload }
      await commit(
        { op: 'create', resource: 'foodLogs', entityId: id, payload: row },
        () => patchDay(payload.date, (d) => ({ logs: [...d.logs, row] })),
      )
      return row
    },
    [commit, patchDay],
  )

  const removeLog = useCallback(
    async (date, id) => {
      await commit(
        { op: 'delete', resource: 'foodLogs', entityId: id, payload: { date } },
        () => patchDay(date, (d) => ({ logs: d.logs.filter((row) => row.id !== id) })),
      )
    },
    [commit, patchDay],
  )

  const saveFood = useCallback(
    async (payload, editingId) => {
      if (editingId) {
        const next = { ...payload, updatedAt: Date.now() }
        await commit(
          { op: 'update', resource: 'customFoods', entityId: editingId, payload: next },
          () =>
            setCustomFoods((prev) =>
              prev.map((food) => (food.id === editingId ? { ...food, ...next } : food)).sort(byName),
            ),
        )
        return editingId
      }
      const id = crypto.randomUUID()
      const row = { id, ...payload, createdAt: Date.now(), updatedAt: Date.now() }
      await commit(
        { op: 'create', resource: 'customFoods', entityId: id, payload: row },
        () => setCustomFoods((prev) => [...prev, row].sort(byName)),
      )
      return id
    },
    [commit],
  )

  const removeFood = useCallback(
    async (id) => {
      await commit(
        { op: 'delete', resource: 'customFoods', entityId: id, payload: {} },
        () => setCustomFoods((prev) => prev.filter((food) => food.id !== id)),
      )
    },
    [commit],
  )

  const ensureWorkout = useCallback(
    async (date, name = 'Session') => {
      const existing = daysRef.current[date]?.workout
      if (existing) return existing
      if (ensuring.current[date]) return ensuring.current[date]
      const id = crypto.randomUUID()
      const workout = { id, date, name }
      const pending = commit(
        { op: 'create', resource: 'workouts', entityId: id, payload: workout },
        () =>
          patchDay(date, (d) => ({
            workout: d.workout || workout,
            sets: d.sets || [],
          })),
      ).then(() => daysRef.current[date]?.workout || workout)
      ensuring.current[date] = pending
      try {
        return await pending
      } finally {
        delete ensuring.current[date]
      }
    },
    [commit, patchDay],
  )

  const renameWorkout = useCallback(
    async (date, id, name) => {
      await commit(
        { op: 'update', resource: 'workouts', entityId: id, payload: { date, name } },
        () => patchDay(date, (d) => ({ workout: d.workout ? { ...d.workout, name } : d.workout })),
      )
    },
    [commit, patchDay],
  )

  const addSet = useCallback(
    async (date, payload) => {
      const session = payload.workoutId
        ? { id: payload.workoutId }
        : await ensureWorkout(date)
      const id = crypto.randomUUID()
      const row = {
        id,
        workoutId: session.id,
        date,
        exercise: payload.exercise,
        reps: payload.reps,
        weight: payload.weight,
        setNumber: payload.setNumber,
      }
      await commit(
        { op: 'create', resource: 'workoutSets', entityId: id, payload: row },
        () => patchDay(date, (d) => ({ sets: [...d.sets, row], workout: d.workout || session })),
      )
      return row
    },
    [commit, ensureWorkout, patchDay],
  )

  const updateSet = useCallback(
    (date, id, patch) => {
      patchDay(date, (d) => ({
        sets: d.sets.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      }))
      const mutation = {
        op: 'update',
        resource: 'workoutSets',
        entityId: id,
        payload: { ...patch, date },
        userId: userRef.current?.id,
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueue(mutation)
        return
      }
      window.clearTimeout(setTimers.current[id])
      setTimers.current[id] = window.setTimeout(() => {
        commit(mutation)
      }, 400)
    },
    [commit, patchDay],
  )

  const removeSet = useCallback(
    async (date, set) => {
      await commit(
        { op: 'delete', resource: 'workoutSets', entityId: set.id, payload: { date, workoutId: set.workoutId } },
        () =>
          patchDay(date, (d) => {
            const rest = d.sets.filter((row) => row.id !== set.id)
            const renumbered = rest.map((row) =>
              row.exercise === set.exercise
                ? row
                : row,
            )
            const same = renumbered.filter((row) => row.exercise === set.exercise)
            const others = renumbered.filter((row) => row.exercise !== set.exercise)
            return {
              sets: [
                ...others,
                ...same.map((row, i) => ({ ...row, setNumber: i + 1 })),
              ],
            }
          }),
      )
    },
    [commit, patchDay],
  )

  const removeExercise = useCallback(
    async (date, workoutId, exercise) => {
      await commit(
        {
          op: 'delete',
          resource: 'workoutExercises',
          entityId: workoutId,
          payload: { workoutId, exercise, date },
        },
        () => patchDay(date, (d) => ({ sets: d.sets.filter((row) => row.exercise !== exercise) })),
      )
    },
    [commit, patchDay],
  )

  const createWorkoutType = useCallback(
    async (name) => {
      const clean = String(name || '').trim()
      if (!clean) return null
      const id = crypto.randomUUID()
      const row = { id, name: clean, active: typesRef.current.length === 0, splits: [] }
      await commit(
        { op: 'create', resource: 'workoutTypes', entityId: id, payload: row },
        () => setWorkoutTypes((prev) => [...prev, row].sort(byName)),
      )
      return row
    },
    [commit],
  )

  const updateWorkoutType = useCallback(
    async (id, updater) => {
      const current = typesRef.current.find((type) => type.id === id)
      if (!current) return null
      const next = { ...current, ...updater(current), id }
      await commit(
        { op: 'update', resource: 'workoutTypes', entityId: id, payload: next },
        () => setWorkoutTypes((prev) => prev.map((type) => (type.id === id ? next : type)).sort(byName)),
      )
      return next
    },
    [commit],
  )

  const activateWorkoutType = useCallback(
    async (id) => {
      await commit(
        { op: 'activate', resource: 'workoutTypes', entityId: id, payload: {} },
        () => setWorkoutTypes((prev) => prev.map((type) => ({ ...type, active: type.id === id }))),
      )
    },
    [commit],
  )

  const removeWorkoutType = useCallback(
    async (id) => {
      await commit(
        { op: 'delete', resource: 'workoutTypes', entityId: id, payload: {} },
        () =>
          setWorkoutTypes((prev) => {
            const rest = prev.filter((type) => type.id !== id)
            if (rest.length && !rest.some((type) => type.active)) rest[0] = { ...rest[0], active: true }
            return rest
          }),
      )
    },
    [commit],
  )

  const syncLabel = useMemo(() => {
    if (!online) return queued > 0 ? `Offline · ${queued} queued` : 'Offline'
    if (syncing || queued > 0) return 'Syncing…'
    return 'Synced'
  }, [online, queued, syncing])

  const value = useMemo(
    () => ({
      user,
      authReady,
      ready,
      bootError,
      settings,
      customFoods,
      workoutTypes,
      days,
      discipline,
      online,
      queued,
      syncing,
      syncLabel,
      login,
      register,
      logout,
      refresh,
      loadDay,
      loadRange,
      saveTargets,
      addLog,
      removeLog,
      saveFood,
      removeFood,
      ensureWorkout,
      renameWorkout,
      addSet,
      updateSet,
      removeSet,
      removeExercise,
      createWorkoutType,
      updateWorkoutType,
      activateWorkoutType,
      removeWorkoutType,
    }),
    [
      user,
      authReady,
      ready,
      bootError,
      settings,
      customFoods,
      workoutTypes,
      days,
      discipline,
      online,
      queued,
      syncing,
      syncLabel,
      login,
      register,
      logout,
      refresh,
      loadDay,
      loadRange,
      saveTargets,
      addLog,
      removeLog,
      saveFood,
      removeFood,
      ensureWorkout,
      renameWorkout,
      addSet,
      updateSet,
      removeSet,
      removeExercise,
      createWorkoutType,
      updateWorkoutType,
      activateWorkoutType,
      removeWorkoutType,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

export function useDay(date) {
  const { days, loadDay, online, queued } = useData()
  useEffect(() => {
    loadDay(date)
  }, [date, loadDay])
  const day = days[date] || emptyDay()
  return {
    logs: day.logs || [],
    workout: day.workout || null,
    sets: day.sets || [],
    loaded: Boolean(day.loaded),
    unavailable: Boolean(day.unavailable),
    online,
    queued,
  }
}

/** Loads an inclusive date span in one request and returns each day in order. */
export function useDateRange(dates) {
  const { days, loadRange } = useData()
  const from = dates[0]
  const to = dates[dates.length - 1]
  const [status, setStatus] = useState({ loading: true, unavailable: false })

  useEffect(() => {
    let cancelled = false
    setStatus({ loading: true, unavailable: false })
    loadRange(from, to)
      .then(() => {
        if (!cancelled) setStatus({ loading: false, unavailable: false })
      })
      .catch(() => {
        if (!cancelled) setStatus({ loading: false, unavailable: true })
      })
    return () => {
      cancelled = true
    }
  }, [from, to, loadRange])

  const rows = dates.map((date) => {
    const day = days[date] || emptyDay()
    return {
      date,
      logs: day.logs || [],
      workout: day.workout || null,
      sets: day.sets || [],
      loaded: Boolean(day.loaded),
    }
  })

  return { rows, loading: status.loading, unavailable: status.unavailable }
}
