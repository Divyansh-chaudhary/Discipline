import { totalsFromLogs } from '../db/index.js'
import { shiftDateKey } from './dates.js'

export const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat']

/** Inclusive list of the last `count` date keys, oldest first, ending on `endDate`. */
export function lastNDates(endDate, count = 7) {
  const dates = []
  for (let back = count - 1; back >= 0; back -= 1) dates.push(shiftDateKey(endDate, -back))
  return dates
}

function sumTotals(rows) {
  return MACRO_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: rows.reduce((total, row) => total + row.totals[key], 0) }),
    {},
  )
}

/**
 * Rolling-window review used to balance today against the days already logged.
 *
 * Averages and allowances only count days that actually have entries, so a
 * skipped day does not read as a zero-calorie day and inflate the numbers.
 */
export function weekReview({ rows, targets, today }) {
  const dayRows = rows.map((row) => ({
    date: row.date,
    totals: totalsFromLogs(row.logs),
    logged: (row.logs || []).length > 0,
    lifted: (row.sets || []).length > 0,
  }))

  const loggedRows = dayRows.filter((row) => row.logged)
  const total = sumTotals(dayRows)
  const average = MACRO_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: loggedRows.length ? total[key] / loggedRows.length : 0 }),
    {},
  )

  const priorLogged = loggedRows.filter((row) => row.date !== today)
  const priorTotal = sumTotals(priorLogged)
  // Budget for today that pulls the average across tracked days back to target.
  const allowance = MACRO_KEYS.reduce((acc, key) => {
    const target = Number(targets[key]) || 0
    return { ...acc, [key]: target * (priorLogged.length + 1) - priorTotal[key] }
  }, {})

  const balance = MACRO_KEYS.reduce((acc, key) => {
    const target = Number(targets[key]) || 0
    return { ...acc, [key]: total[key] - target * loggedRows.length }
  }, {})

  return {
    dayRows,
    total,
    average,
    allowance,
    balance,
    loggedDays: loggedRows.length,
    trackedBefore: priorLogged.length,
  }
}
