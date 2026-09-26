import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '../components/BusyButton.jsx'
import { api } from '../api/client.js'
import { PageHead } from '../components/SyncChip.jsx'
import { exerciseSlug, formatLastSession } from '../workout/utils.js'

export function ExerciseHistory() {
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/exercises/history')
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => row.name.toLowerCase().includes(needle))
  }, [query, rows])

  return (
    <div className="page">
      <PageHead title="Exercise History" back={{ to: '/workout', label: 'Workout' }} />

      <div className="field history-search">
        <label htmlFor="exercise-search">Search exercise</label>
        <input
          id="exercise-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name…"
          autoComplete="off"
        />
      </div>

      {loading ? (
        <div className="inline-loader" style={{ marginTop: 12 }}>
          <Spinner size={14} /> Loading history…
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <div className="empty card" style={{ marginTop: 12 }}>
          {query.trim() ? 'No exercises match your search.' : 'No exercises logged yet.'}
        </div>
      ) : (
        <div className="history-list">
          {filtered.map((row) => (
            <Link
              className="history-card"
              key={row.name}
              to={`/workout/history/${exerciseSlug(row.name)}`}
            >
              <div className="history-card-head">
                <h3>{row.name}</h3>
                <span className="history-card-chevron" aria-hidden="true">›</span>
              </div>
              <div className="history-card-stats">
                <div className="history-stat">
                  <span className="history-stat-label">Last</span>
                  <span className="history-stat-value">
                    {formatLastSession(row.lastWeight, row.lastReps) || '—'}
                  </span>
                </div>
                <div className="history-stat">
                  <span className="history-stat-label">Best</span>
                  <span className="history-stat-value">
                    {formatLastSession(row.bestWeight, row.bestReps) || '—'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
