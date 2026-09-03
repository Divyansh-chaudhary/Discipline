import { localDateKey } from '../lib/dates.js'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function api(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      'X-Client-Date': localDateKey(),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text }
  }
  if (!res.ok) {
    const raw = data?.error || text || res.statusText
    const message =
      res.status === 404 || /NOT_FOUND|could not be found/i.test(String(raw))
        ? 'Service unavailable. Try again in a minute.'
        : String(raw)
    throw new ApiError(message, res.status, data)
  }
  return data
}
