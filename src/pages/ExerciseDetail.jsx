import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { MiniChart } from '../components/workout/MiniChart.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { formatShortDate } from '../lib/dates.js'
import { decodeExerciseSlug } from '../workout/utils.js'

export function ExerciseDetail() {
  const { slug } = useParams()
  const exercise = decodeExerciseSlug(slug || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!exercise) return undefined
    const query = new URLSearchParams({ name: exercise })
    api(`/api/exercises/progression?${query}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
    return undefined
  }, [exercise])

  if (!exercise) return <Navigate to="/workout/history" replace />

  const sessions = [...(data?.sessions || [])].reverse()
  const last = sessions[0]
  const best = sessions.reduce(
    (top, session) => (session.maxWeight > (top?.maxWeight || 0) ? session : top),
    null,
  )

  return (
    <div className="page">
      <PageHead title={exercise} back={{ to: '/workout/history', label: 'History' }} />

      {loading ? <p className="sub">Loading progression…</p> : null}

      <section className="card stack">
        <div>
          <p className="tiny">Last workout</p>
          <p className="path-count">
            {last ? `${last.maxWeight}kg · ${last.totalReps} total reps` : 'No sessions yet'}
          </p>
        </div>
        <div>
          <p className="tiny">Best weight</p>
          <p className="path-count">{best ? `${best.maxWeight}kg` : '—'}</p>
        </div>
      </section>

      <MiniChart title="Weight" series={data?.weightSeries || []} unit="kg" />
      <MiniChart title="Reps" series={data?.repsSeries || []} unit=" reps" />

      <div className="section-title">
        <h2>Recent sessions</h2>
      </div>

      {sessions.length === 0 ? (
        <div className="empty card">No history for this exercise yet.</div>
      ) : (
        <div className="list">
          {sessions.map((session) => (
            <div className="row" key={session.date}>
              <span className="grow">
                <span className="name">{formatShortDate(session.date)}</span>
                <span className="meta">
                  {session.sets.map((set) => `${set.weight}kg × ${set.reps}`).join(' · ')}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
