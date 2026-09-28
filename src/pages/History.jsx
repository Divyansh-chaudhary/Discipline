import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Spinner } from '../components/BusyButton.jsx'
import { MacroBars } from '../components/MacroBars.jsx'
import { OfflineEmpty, PageHead } from '../components/SyncChip.jsx'
import { WeekReview } from '../components/WeekReview.jsx'
import { totalsFromLogs } from '../db/index.js'
import { formatPrettyDate, localDateKey, shiftDateKey } from '../lib/dates.js'
import { fmtCal, macroSummary } from '../lib/format.js'
import { lastNDates } from '../lib/week.js'
import { exerciseLine } from '../lib/workouts.js'
import { useData, useDateRange, useDay } from '../sync/DataContext.jsx'

export function History() {
  const today = localDateKey()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'week' ? 'week' : 'day'
  const [date, setDate] = useState(today)

  const setView = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'week') params.set('view', 'week')
    else params.delete('view')
    setSearchParams(params, { replace: true })
  }

  const openDay = (pickedDate) => {
    setDate(pickedDate)
    setView('day')
  }

  return (
    <div className="page">
      <PageHead
        kicker="Archive"
        title="Log"
        sub={view === 'week' ? 'Last 7 days, averaged' : formatPrettyDate(date)}
      />

      <div className="view-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={view === 'day'}
          className={view === 'day' ? 'active' : undefined}
          onClick={() => setView('day')}
        >
          Single day
        </button>
        <button
          role="tab"
          aria-selected={view === 'week'}
          className={view === 'week' ? 'active' : undefined}
          onClick={() => setView('week')}
        >
          Week
        </button>
      </div>

      {view === 'week' ? (
        <WeekView today={today} onPickDate={openDay} />
      ) : (
        <DayView date={date} setDate={setDate} />
      )}
    </div>
  )
}

function WeekView({ today, onPickDate }) {
  const { settings } = useData()
  const dates = useMemo(() => lastNDates(today, 7), [today])
  const { rows, loading, unavailable } = useDateRange(dates)

  if (loading && rows.every((row) => !row.loaded)) {
    return (
      <div className="page-loader" style={{ minHeight: '28dvh' }}>
        <Spinner size={24} label="Loading week" />
        <p className="sub">Loading your week…</p>
      </div>
    )
  }

  if (unavailable && rows.every((row) => !row.loaded)) {
    return <div className="empty card">The week needs a connection. Reconnect and pull again.</div>
  }

  return <WeekReview rows={rows} targets={settings} today={today} onPickDate={onPickDate} />
}

function DayView({ date, setDate }) {
  const { settings } = useData()
  const { logs, workout, sets, loaded, unavailable } = useDay(date)
  const totals = totalsFromLogs(logs)
  const exercises = groupExercises(sets)

  return (
    <>
      <div className="date-nav">
        <button className="secondary" onClick={() => setDate((d) => shiftDateKey(d, -1))} aria-label="Previous day">
          ←
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="secondary" onClick={() => setDate((d) => shiftDateKey(d, 1))} aria-label="Next day">
          →
        </button>
      </div>

      {!loaded && !unavailable ? (
        <div className="page-loader" style={{ minHeight: '24dvh' }}>
          <Spinner size={24} label="Loading day" />
          <p className="sub">Loading day…</p>
        </div>
      ) : (
        <OfflineEmpty loaded={loaded && !unavailable}>
          <section className="card" style={{ marginTop: 14 }}>
            <p className="tiny">Food</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, margin: '4px 0 8px' }}>
              {fmtCal(totals.calories)} <span className="tiny">kcal</span>
            </p>
            <MacroBars totals={totals} targets={settings} />
          </section>

          {logs.length === 0 ? (
            <div className="empty card">No food logged this day.</div>
          ) : (
            <div className="log-day-list">
              {logs.map((row) => (
                <div className="log-day-item" key={row.id}>
                  <span className="log-day-name">
                    {row.name}
                    {row.servings > 1 ? <span className="tiny"> ×{row.servings}</span> : null}
                  </span>
                  <span className="meta">{macroSummary(row)}</span>
                </div>
              ))}
            </div>
          )}

          <section className="card log-workout-card">
            <div className="page-head-row">
              <div>
                <p className="tiny">Workout</p>
                <p className="path-count">{workout?.name || 'No session'}</p>
              </div>
              {sets.length ? <span className="chip">{sets.length} sets</span> : null}
            </div>
            {exercises.length === 0 ? (
              <p className="sub log-workout-empty">No lifts this day.</p>
            ) : (
              <div className="session-preview">
                {exercises.map((group) => (
                  <div className="session-exercise" key={group.exercise}>
                    <span className="session-exercise-name">{group.exercise}</span>
                    <span className="session-exercise-meta">{exerciseLine(group.sets)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </OfflineEmpty>
      )}
    </>
  )
}

function groupExercises(sets) {
  const map = new Map()
  for (const set of sets) {
    if (!map.has(set.exercise)) map.set(set.exercise, [])
    map.get(set.exercise).push(set)
  }
  return [...map.entries()].map(([exercise, rows]) => ({ exercise, sets: rows }))
}
