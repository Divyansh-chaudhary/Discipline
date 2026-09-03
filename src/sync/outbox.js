import Dexie from 'dexie'

export const outboxDb = new Dexie('discipline-outbox')

outboxDb.version(1).stores({
  outbox: '++id, createdAt, resource, entityId, op, userId',
})

const listeners = new Set()

export function subscribeOutbox(fn) {
  listeners.add(fn)
  queuedCount().then((n) => fn(n)).catch(() => {})
  return () => listeners.delete(fn)
}

export async function queuedCount() {
  return outboxDb.outbox.count()
}

async function notify() {
  const n = await queuedCount()
  listeners.forEach((fn) => fn(n))
}

export async function enqueue(entry) {
  const { op, resource, entityId, payload } = entry
  const pending = await outboxDb.outbox.where('entityId').equals(String(entityId)).toArray()
  const same = pending
    .filter((row) => row.resource === resource)
    .sort((a, b) => a.id - b.id)
  const last = same[same.length - 1]

  if (op === 'update' && last && (last.op === 'create' || last.op === 'update')) {
    await outboxDb.outbox.update(last.id, {
      payload: { ...last.payload, ...payload },
    })
    await notify()
    return
  }

  if (op === 'delete') {
    if (last?.op === 'create') {
      await Promise.all(same.map((row) => outboxDb.outbox.delete(row.id)))
      await notify()
      return
    }
    await Promise.all(
      same.filter((row) => row.op === 'update').map((row) => outboxDb.outbox.delete(row.id)),
    )
  }

  await outboxDb.outbox.add({
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
  const all = await outboxDb.outbox.orderBy('id').toArray()
  if (!userId) return all[0] || undefined
  return all.find((row) => !row.userId || row.userId === userId)
}

export async function removeOutbox(id) {
  await outboxDb.outbox.delete(id)
  await notify()
}

export async function clearOutbox() {
  await outboxDb.outbox.clear()
  await notify()
}
