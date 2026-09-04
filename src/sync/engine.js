import { api, ApiError } from '../api/client.js'
import { localDateKey } from '../lib/dates.js'
import { nextOutbox, pendingCount, queuedCount, removeOutbox } from './outbox.js'

let draining = false
let drainPromise = null
const statusListeners = new Set()
let syncing = false

export function subscribeSyncStatus(fn) {
  statusListeners.add(fn)
  fn({ syncing, queued: 0 })
  queuedCount().then((queued) => fn({ syncing, queued })).catch(() => {})
  return () => statusListeners.delete(fn)
}

function emit(extra = {}) {
  queuedCount()
    .then((queued) => {
      statusListeners.forEach((fn) => fn({ syncing, queued, ...extra }))
    })
    .catch(() => {})
}

export function drainOutbox(userId) {
  if (drainPromise) return drainPromise
  drainPromise = runDrain(userId).finally(() => {
    drainPromise = null
  })
  return drainPromise
}

async function runDrain(userId) {
  if (draining) return { drained: 0 }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { drained: 0, offline: true }
  }
  // Nothing queued: return without touching the offline database.
  if (pendingCount() === 0) return { drained: 0 }
  draining = true
  syncing = true
  emit()
  let drained = 0
  try {
    let row = await nextOutbox(userId)
    while (row) {
      try {
        await api('/api/mutations', {
          method: 'POST',
          body: {
            op: row.op,
            resource: row.resource,
            entityId: row.entityId,
            payload: row.payload,
            clientDate: localDateKey(),
          },
        })
        await removeOutbox(row.id)
        drained += 1
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          emit({ authLost: true })
          throw err
        }
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
          console.warn('Dropping failed outbox item', row, err.message)
          await removeOutbox(row.id)
        } else {
          throw err
        }
      }
      row = await nextOutbox(userId)
    }
    return { drained }
  } finally {
    draining = false
    syncing = false
    emit()
  }
}
