let dbPromise = null

async function getDb() {
  if (!dbPromise) {
    dbPromise = import('dexie').then(({ default: Dexie }) => {
      const db = new Dexie('discipline-workout-drafts')
      db.version(1).stores({ drafts: 'key, updatedAt' })
      return db
    })
  }
  return dbPromise
}

export function draftKey(userId, splitId, date) {
  return `${userId}:${splitId}:${date}`
}

export async function loadDraft(userId, splitId, date) {
  const db = await getDb()
  const key = draftKey(userId, splitId, date)
  return db.drafts.get(key)
}

export async function saveDraft(userId, splitId, date, payload) {
  const db = await getDb()
  const key = draftKey(userId, splitId, date)
  const row = {
    key,
    userId,
    splitId,
    date,
    ...payload,
    updatedAt: Date.now(),
  }
  await db.drafts.put(row)
  return row
}

export async function clearDraft(userId, splitId, date) {
  const db = await getDb()
  await db.drafts.delete(draftKey(userId, splitId, date))
}
