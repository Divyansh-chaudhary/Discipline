/** Local calendar date as YYYY-MM-DD (never UTC). */
export function localDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseLocalDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function formatPrettyDate(key) {
  const date = parseLocalDate(key)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function formatShortDate(key) {
  const date = parseLocalDate(key)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function shiftDateKey(key, days) {
  const date = parseLocalDate(key)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function uniqueSortedDates(keys) {
  return [...new Set(keys.filter(Boolean))].sort()
}

/** Inclusive run of consecutive YYYY-MM-DD keys ending at `end` (or the day before). */
export function streakEndingOn(sortedDates, end) {
  const set = new Set(sortedDates)
  let cursor = set.has(end) ? end : null
  if (!cursor) return { current: 0, lastActiveDate: lastDateOnOrBefore(sortedDates, end) }
  let current = 0
  while (set.has(cursor)) {
    current += 1
    cursor = shiftDateKey(cursor, -1)
  }
  return { current, lastActiveDate: end }
}

export function bestConsecutive(sortedDates) {
  if (!sortedDates.length) return 0
  let best = 1
  let run = 1
  for (let i = 1; i < sortedDates.length; i += 1) {
    if (sortedDates[i] === shiftDateKey(sortedDates[i - 1], 1)) {
      run += 1
      if (run > best) best = run
    } else {
      run = 1
    }
  }
  return best
}

function lastDateOnOrBefore(sortedDates, end) {
  for (let i = sortedDates.length - 1; i >= 0; i -= 1) {
    if (sortedDates[i] <= end) return sortedDates[i]
  }
  return null
}
