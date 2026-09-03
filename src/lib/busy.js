import { useCallback, useRef, useState } from 'react'

/** Tracks in-flight async work so buttons can show a loader and ignore double taps. */
export function useBusy() {
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)

  const run = useCallback(async (fn) => {
    if (locked.current) return undefined
    locked.current = true
    setBusy(true)
    try {
      return await fn()
    } finally {
      locked.current = false
      setBusy(false)
    }
  }, [])

  return [busy, run]
}

/** Same as useBusy, but keyed so several actions on one screen can load independently. */
export function useBusyKey() {
  const [busyKey, setBusyKey] = useState(null)
  const locked = useRef(null)

  const run = useCallback(async (key, fn) => {
    if (locked.current) return undefined
    locked.current = key
    setBusyKey(key)
    try {
      return await fn()
    } finally {
      locked.current = null
      setBusyKey(null)
    }
  }, [])

  return [busyKey, run]
}
