const COUNT_KEY = 'discipline.outbox.count'
const listeners = new Set()

/**
 * Dexie is only pulled in when something actually needs queueing, so a normal
 * online session never pays for the IndexedDB layer.
 */
let dbPromise = null

async function getDb() {
  if (!dbPromise) {
    dbPromise = import('dexie').then(({ default: Dexie }) => {
      const db = new Dexie('discipline-outbox')
      db.version(1).stores({
        outbox: '++id, createdAt, resource, entityId, op, userId',
      })
      return db
    })
  }
  return dbPromise
}

/** Synchronous mirror of the queue length, so boot can skip IndexedDB entirely. */
export function pendingCount() {
  try {
    return Number(localStorage.getItem(COUNT_KEY)) || 0
  } catch {
    return 0
  }
}

function rememberCount(n) {
  try {
    if (n > 0) localStorage.setItem(COUNT_KEY, String(n))
    else localStorage.removeItem(COUNT_KEY)
  } catch {
    /* ignore */
  }
}

export function subscribeOutbox(fn) {
  listeners.add(fn)
  fn(pendingCount())
  return () => listeners.delete(fn)
}

export async function queuedCount() {
  if (!dbPromise && pendingCount() === 0) return 0
  const db = await getDb()
  return db.outbox.count()
}

async function notify() {
  const n = await queuedCount()
  rememberCount(n)
  listeners.forEach((fn) => fn(n))
}

export async function enqueue(entry) {
  const { op, resource, entityId, payload } = entry
  const db = await getDb()
  const pending = await db.outbox.where('entityId').equals(String(entityId)).toArray()
  const same = pending
    .filter((row) => row.resource === resource)
    .sort((a, b) => a.id - b.id)
  const last = same[same.length - 1]

  if (op === 'update' && last && (last.op === 'create' || last.op === 'update')) {
    await db.outbox.update(last.id, {
      payload: { ...last.payload, ...payload },
    })
    await notify()
    return
  }

  if (op === 'delete') {
    if (last?.op === 'create') {
      await Promise.all(same.map((row) => db.outbox.delete(row.id)))
      await notify()
      return
    }
    await Promise.all(
      same.filter((row) => row.op === 'update').map((row) => db.outbox.delete(row.id)),
    )
  }

  await db.outbox.add({
    op,
    resource,
    entityId: String(entityId),
    userId: entry.userId || '',
    payload: payload || {},
    createdAt: Date.now(),
  })
  await notify()
}

export async function nextOutbox(userId) {
  if (!dbPromise && pendingCount() === 0) return undefined
  const db = await getDb()
  const all = await db.outbox.orderBy('id').toArray()
  if (!userId) return all[0] || undefined
  return all.find((row) => !row.userId || row.userId === userId)
}

export async function removeOutbox(id) {
  const db = await getDb()
  await db.outbox.delete(id)
  await notify()
}

export async function clearOutbox() {
  const db = await getDb()
  await db.outbox.clear()
  await notify()
}
