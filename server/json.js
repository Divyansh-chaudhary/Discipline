export function toClient(doc) {
  if (!doc) return null
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc }
  const id = raw._id
  delete raw._id
  delete raw.__v
  delete raw.userId
  delete raw.passwordHash
  return { id, ...raw }
}

export function toClientList(docs) {
  return (docs || []).map(toClient)
}

export function newId() {
  return crypto.randomUUID()
}
