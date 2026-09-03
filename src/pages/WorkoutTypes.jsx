import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BusyButton, Spinner } from '../components/BusyButton.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { useBusy, useBusyKey } from '../lib/busy.js'
import { useData } from '../sync/DataContext.jsx'

export function WorkoutTypes() {
  const { workoutTypes, createWorkoutType, activateWorkoutType, removeWorkoutType } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [creating, runCreate] = useBusy()
  const [rowBusy, runRow] = useBusyKey()

  const create = () =>
    runCreate(async () => {
      const created = await createWorkoutType(name)
      if (!created) return
      setName('')
      navigate(`/workout/types/${created.id}`)
    })

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
            disabled={creating}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create()
            }}
            placeholder="PPL"
            autoComplete="off"
          />
        </div>
        <BusyButton
          className="primary full"
          busy={creating}
          busyLabel="Creating…"
          disabled={!name.trim()}
          onClick={create}
        >
          Create workout type
        </BusyButton>
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
                <BusyButton
                  className="secondary compact-btn"
                  busy={rowBusy === `use-${type.id}`}
                  busyLabel="…"
                  disabled={Boolean(rowBusy)}
                  onClick={() => runRow(`use-${type.id}`, () => activateWorkoutType(type.id))}
                >
                  Use
                </BusyButton>
              )}
              <button
                className={`icon-btn${rowBusy === `del-${type.id}` ? ' is-busy' : ''}`}
                aria-label={`Delete ${type.name}`}
                disabled={Boolean(rowBusy)}
                onClick={() => runRow(`del-${type.id}`, () => removeWorkoutType(type.id))}
              >
                {rowBusy === `del-${type.id}` ? <Spinner size={12} /> : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
