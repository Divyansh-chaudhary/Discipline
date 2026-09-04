import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '../api/client.js'
import { DEFAULT_TARGETS } from '../db/index.js'
import { localDateKey, shiftDateKey } from '../lib/dates.js'
import { drainOutbox, subscribeSyncStatus } from './engine.js'
import { enqueue, subscribeOutbox } from './outbox.js'

const DataContext = createContext(null)
const SESSION_KEY = 'discipline.session'
const SNAPSHOT_KEY = 'discipline.snapshot'

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

/**
 * Last bootstrap payload, kept so a reopen paints real data before the network
 * answers. Cached days are marked stale so they still revalidate in the background.
 */
function readSnapshot(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.userId === userId ? parsed : null
  } catch {
    return null
  }
}

function writeSnapshot(userId, snapshot) {
  if (!userId) return
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ userId, ...snapshot }))
  } catch {
    /* storage full or blocked — cache is optional */
  }
}

function clearSnapshot() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    /* ignore */
  }
}

function staleDays(days) {
  const out = {}
  for (const [date, day] of Object.entries(days || {})) {
    out[date] = { ...day, loaded: true, loading: false, unavailable: false, stale: true }
  }
  return out
}

function emptyDay() {
  return { logs: [], workout: null, sets: [], loaded: false, unavailable: false }
}

function byName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''))
}

function rangeDateKeys(from, to) {
  if (!from || !to) return []
  const keys = []
  let cursor = from
  while (cursor <= to) {
    keys.push(cursor)
    cursor = shiftDateKey(cursor, 1)
  }
  return keys
}

export function DataProvider({ children }) {
  const [boot] = useState(() => {
    const cachedUser = readSession()
    return { user: cachedUser, snapshot: readSnapshot(cachedUser?.id) }
  })
  const cached = boot.snapshot

  const [user, setUser] = useState(boot.user)
  // A cached session lets the shell render before /api/auth/me answers.
  const [authReady, setAuthReady] = useState(Boolean(boot.user))
  const [settings, setSettings] = useState(cached?.settings || DEFAULT_TARGETS)
  const [customFoods, setCustomFoods] = useState(cached?.customFoods || [])
  const [workoutTypes, setWorkoutTypes] = useState(cached?.workoutTypes || [])
  const [days, setDays] = useState(() => staleDays(cached?.days))
  const [discipline, setDiscipline] = useState(cached?.discipline || emptyDiscipline)
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [queued, setQueued] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [bootError, setBootError] = useState('')
  const [ready, setReady] = useState(Boolean(cached))
  const userRef = useRef(null)
  const daysRef = useRef({})
  const typesRef = useRef([])
  const setTimers = useRef({})
  const ensuring = useRef({})
  const didInitialSync = useRef(false)

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
    const settingsNext = data.settings || DEFAULT_TARGETS
    const foodsNext = data.customFoods ? [...data.customFoods].sort(byName) : []
    const typesNext = data.workoutTypes ? [...data.workoutTypes].sort(byName) : []
    if (data.settings) setSettings(settingsNext)
    if (data.customFoods) setCustomFoods(foodsNext)
    if (data.workoutTypes) setWorkoutTypes(typesNext)
    if (data.discipline) setDiscipline(data.discipline)

    const key = data.date || date
    const fresh = {}
    for (const [rangeDate, day] of Object.entries(data.range?.days || {})) {
      fresh[rangeDate] = {
        logs: day.logs || [],
        workout: day.workout || null,
        sets: day.sets || [],
        loaded: true,
        loading: false,
        unavailable: false,
      }
    }
    fresh[key] = {
      logs: data.logs || [],
      workout: data.workout || null,
      sets: data.sets || [],
      loaded: true,
      loading: false,
      unavailable: false,
    }
    // Empty days inside the window are known-empty, not missing.
    if (data.range) {
      for (const rangeDate of rangeDateKeys(data.range.from, data.range.to)) {
        if (!fresh[rangeDate]) {
          fresh[rangeDate] = { ...emptyDay(), loaded: true, loading: false }
        }
      }
    }
    setDays((prev) => ({ ...prev, ...fresh }))

    writeSnapshot(userRef.current?.id, {
      settings: settingsNext,
      customFoods: foodsNext,
      workoutTypes: typesNext,
      discipline: data.discipline || emptyDiscipline(),
      days: fresh,
    })
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
      let shouldFetch = true
      setDays((prev) => {
        const cur = prev[date]
        // Stale cache still renders, but revalidates behind the scenes.
        if (cur?.loading || (cur?.loaded && !cur.stale)) {
          shouldFetch = false
          return prev
        }
        return { ...prev, [date]: { ...(cur || emptyDay()), loading: true } }
      })
      if (!shouldFetch) return
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

  const loadRange = useCallback(async (from, to, { force = false } = {}) => {
    if (!force) {
      const known = rangeDateKeys(from, to)
      const cache = daysRef.current || {}
      const covered = known.every((date) => cache[date]?.loaded && !cache[date]?.stale)
      // Bootstrap already ships the trailing week, so skip the duplicate call.
      if (covered) return { days: {}, from, to, cached: true }
    }
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

  // Validates the cached session without blocking the first paint.
  useEffect(() => {
    let cancelled = false
    api('/api/auth/me')
      .then((data) => {
        if (cancelled) return
        setUser((prev) => (prev?.id === data.user?.id ? prev : data.user))
        writeSession(data.user)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          writeSession(null)
          clearSnapshot()
          setUser(null)
        }
        // Any other failure keeps the cached session so offline opens still work.
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
      didInitialSync.current = false
      setReady(false)
      return undefined
    }
    if (didInitialSync.current) return undefined
    didInitialSync.current = true

    let cancelled = false
    const hadCache = daysRef.current && Object.keys(daysRef.current).length > 0
    if (!hadCache) setReady(false)

    refresh()
      .then(async () => {
        if (cancelled) return
        try {
          const result = await drainOutbox(user.id)
          // Only pay for a second bootstrap when queued writes actually landed.
          if (!cancelled && result?.drained > 0) await refresh()
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            writeSession(null)
            clearSnapshot()
            setUser(null)
          }
        }
      })
      .catch((err) => {
        if (!cancelled && !hadCache) setBootError(err.message || 'Could not load account data')
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

  // Flush queued writes when the connection comes back, not on every mount.
  const wasOffline = useRef(!online)
  useEffect(() => {
    if (!user) return undefined
    if (!online) {
      wasOffline.current = true
      return undefined
    }
    if (!wasOffline.current) return undefined
    wasOffline.current = false

    let cancelled = false
    drainOutbox(user.id)
      .then(async (result) => {
        if (!cancelled && result?.drained > 0) await refresh()
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
    clearSnapshot()
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

  /** One request for a whole pantry selection instead of one per food. */
  const addLogs = useCallback(
    async (date, items) => {
      const rows = items.map((item) => ({ id: crypto.randomUUID(), date, ...item }))
      if (!rows.length) return []
      await commit(
        {
          op: 'createMany',
          resource: 'foodLogs',
          entityId: rows[0].id,
          payload: { date, items: rows },
        },
        () => patchDay(date, (d) => ({ logs: [...d.logs, ...rows] })),
      )
      return rows
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

  /** Commits every set of one exercise at once, after local editing. */
  const saveExerciseSets = useCallback(
    async (date, exercise, draftSets) => {
      const session = await ensureWorkout(date)
      if (!session) return null
      const rows = draftSets.map((set, index) => ({
        id: set.id && !set.local ? set.id : crypto.randomUUID(),
        workoutId: session.id,
        date,
        exercise,
        reps: Number(set.reps) || 0,
        weight: Number(set.weight) || 0,
        setNumber: index + 1,
      }))
      await commit(
        {
          op: 'replaceExercise',
          resource: 'workoutSets',
          entityId: `${session.id}:${exercise}`,
          payload: { workoutId: session.id, date, exercise, sets: rows },
        },
        () =>
          patchDay(date, (d) => ({
            sets: [...d.sets.filter((row) => row.exercise !== exercise), ...rows],
          })),
      )
      return rows
    },
    [commit, ensureWorkout, patchDay],
  )

  /** Replaces several exercises at once — used when loading a planned split. */
  const saveSessionSets = useCallback(
    async (date, groups) => {
      const session = await ensureWorkout(date)
      if (!session || !groups.length) return null
      const payloadGroups = groups.map((group) => ({
        exercise: group.exercise,
        sets: group.sets.map((set, index) => ({
          id: set.id && !set.local ? set.id : crypto.randomUUID(),
          reps: Number(set.reps) || 0,
          weight: Number(set.weight) || 0,
          setNumber: index + 1,
        })),
      }))
      const rows = payloadGroups.flatMap((group) =>
        group.sets.map((set) => ({
          ...set,
          workoutId: session.id,
          date,
          exercise: group.exercise,
        })),
      )
      const names = new Set(payloadGroups.map((group) => group.exercise))
      await commit(
        {
          op: 'replaceSession',
          resource: 'workoutSets',
          entityId: session.id,
          payload: { workoutId: session.id, date, groups: payloadGroups },
        },
        () =>
          patchDay(date, (d) => ({
            sets: [...d.sets.filter((row) => !names.has(row.exercise)), ...rows],
          })),
      )
      return rows
    },
    [commit, ensureWorkout, patchDay],
  )

  const completeWorkout = useCallback(
    async (date, workoutId, completed) => {
      const completedAt = completed ? Date.now() : null
      await commit(
        {
          op: 'complete',
          resource: 'workouts',
          entityId: workoutId,
          payload: { workoutId, date, completed, completedAt },
        },
        () => patchDay(date, (d) => ({ workout: d.workout ? { ...d.workout, completedAt } : d.workout })),
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
      addLogs,
      removeLog,
      saveFood,
      removeFood,
      ensureWorkout,
      renameWorkout,
      addSet,
      updateSet,
      removeSet,
      removeExercise,
      saveExerciseSets,
      saveSessionSets,
      completeWorkout,
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
      addLogs,
      removeLog,
      saveFood,
      removeFood,
      ensureWorkout,
      renameWorkout,
      addSet,
      updateSet,
      removeSet,
      removeExercise,
      saveExerciseSets,
      saveSessionSets,
      completeWorkout,
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
