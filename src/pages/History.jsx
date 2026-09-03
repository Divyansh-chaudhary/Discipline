import { useState } from 'react'
import { Spinner } from '../components/BusyButton.jsx'
import { MacroBars } from '../components/MacroBars.jsx'
import { OfflineEmpty, PageHead } from '../components/SyncChip.jsx'
import { totalsFromLogs } from '../db/index.js'
import { formatPrettyDate, localDateKey, shiftDateKey } from '../lib/dates.js'
import { fmtCal, fmtG } from '../lib/format.js'
import { useData, useDay } from '../sync/DataContext.jsx'

export function History() {
  const [date, setDate] = useState(localDateKey())
  const { settings } = useData()
  const { logs, workout, sets, loaded, unavailable } = useDay(date)
  const totals = totalsFromLogs(logs)
  const exercises = groupExercises(sets)

  return (
    <div className="page">
      <PageHead kicker="Archive" title="History" sub={formatPrettyDate(date)} />

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
            <div className="list" style={{ marginTop: 12 }}>
              {logs.map((row) => (
                <div className="row" key={row.id}>
                  <div className="grow">
                    <div className="name">{row.name}</div>
                    <div className="meta">
                      {row.servings}× · P {fmtG(row.protein)} C {fmtG(row.carbs)} F {fmtG(row.fat)}
                    </div>
                  </div>
                  <div className="kcal">{fmtCal(row.calories)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="section-title">
            <h2>{workout?.name || 'Workout'}</h2>
          </div>
          {exercises.length === 0 ? (
            <div className="empty card">No lifts this day.</div>
          ) : (
            <div className="stack">
              {exercises.map((group) => (
                <div className="card" key={group.exercise}>
                  <h3 style={{ fontSize: 18 }}>{group.exercise}</h3>
                  <p className="meta" style={{ marginTop: 6 }}>
                    {group.sets
                      .map((s) => `${s.reps}×${s.weight}kg`)
                      .join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </OfflineEmpty>
      )}
    </div>
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
