import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHead } from '../components/SyncChip.jsx'
import { useData } from '../sync/DataContext.jsx'

export function WorkoutTypes() {
  const { workoutTypes, createWorkoutType, activateWorkoutType, removeWorkoutType } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')

  const create = async () => {
    const created = await createWorkoutType(name)
    if (!created) return
    setName('')
    navigate(`/workout/types/${created.id}`)
  }

  return (
    <div className="page">
      <PageHead
        title="Workout types"
        sub="Switch the routine you are running — PPL, Upper / Lower, or your own."
        back={{ to: '/workout', label: 'Lift' }}
      />

      <section className="card stack">
        <div className="field">
          <label htmlFor="type-name">New workout type</label>
          <input
            id="type-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create()
            }}
            placeholder="PPL"
            autoComplete="off"
          />
        </div>
        <button className="primary full" disabled={!name.trim()} onClick={create}>
          Create workout type
        </button>
      </section>

      <div className="section-title">
        <h2>Your types</h2>
        <span className="tiny">{workoutTypes.length}</span>
      </div>

      {workoutTypes.length === 0 ? (
        <div className="empty card">Nothing yet. Create PPL above, then add its splits.</div>
      ) : (
        <div className="list">
          {workoutTypes.map((type) => (
            <div className={`row${type.active ? ' selected' : ''}`} key={type.id}>
              <Link className="grow list-link" to={`/workout/types/${type.id}`}>
                <span className="name">
                  {type.name}
                  {type.active ? <span className="chip inline-chip">In use</span> : null}
                </span>
                <span className="meta">
                  {type.splits?.length
                    ? type.splits.map((split) => split.name).join(' · ')
                    : 'No splits yet'}
                </span>
              </Link>
              {type.active ? null : (
                <button className="secondary compact-btn" onClick={() => activateWorkoutType(type.id)}>
                  Use
                </button>
              )}
              <button
                className="icon-btn"
                aria-label={`Delete ${type.name}`}
                onClick={() => removeWorkoutType(type.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
