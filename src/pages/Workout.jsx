import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sheet } from '../components/Sheet.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { formatPrettyDate, localDateKey } from '../lib/dates.js'
import { activeWorkoutType, groupSets, useSplitStarter } from '../lib/workouts.js'
import { useData, useDay } from '../sync/DataContext.jsx'

export function Workout() {
  const date = localDateKey()
  const {
    workoutTypes,
    ensureWorkout,
    renameWorkout,
    addSet,
    updateSet,
    removeSet,
    removeExercise,
  } = useData()
  const { workout, sets, loaded } = useDay(date)
  const startSplit = useSplitStarter(date)

  useEffect(() => {
    if (loaded && !workout) ensureWorkout(date)
  }, [date, loaded, workout, ensureWorkout])

  const grouped = useMemo(() => groupSets(sets), [sets])
  const currentType = activeWorkoutType(workoutTypes)

  const [sheet, setSheet] = useState(null)
  const [exerciseName, setExerciseName] = useState('')
  const [reps, setReps] = useState('8')
  const [weight, setWeight] = useState('0')
  const [sessionName, setSessionName] = useState('')
  const [error, setError] = useState('')

  const renameSession = async () => {
    if (!workout || !sessionName.trim()) return
    await renameWorkout(date, workout.id, sessionName.trim())
    setSheet(null)
  }

  const addExercise = async () => {
    const name = exerciseName.trim()
    if (!name) {
      setError('Name the movement.')
      return
    }
    const session = workout ?? (await ensureWorkout(date))
    if (!session) return
    const existing = sets.filter((set) => set.exercise === name)
    await addSet(date, {
      workoutId: session.id,
      exercise: name,
      reps: Number(reps) || 0,
      weight: Number(weight) || 0,
      setNumber: existing.length + 1,
    })
    setSheet(null)
  }

  const plusSet = async (exercise) => {
    const session = workout ?? (await ensureWorkout(date))
    if (!session) return
    const existing = sets.filter((set) => set.exercise === exercise)
    const last = existing[existing.length - 1]
    await addSet(date, {
      workoutId: session.id,
      exercise,
      reps: last?.reps ?? 8,
      weight: last?.weight ?? 0,
      setNumber: existing.length + 1,
    })
  }

  return (
    <div className="page">
      <PageHead
        kicker="Iron"
        title={workout?.name || 'Session'}
        sub={formatPrettyDate(date)}
        extra={
          <button
            className="secondary"
            onClick={() => {
              setSessionName(workout?.name || 'Session')
              setSheet('rename')
            }}
          >
            Rename
          </button>
        }
      />

      <section className="card">
        <div className="page-head-row">
          <div>
            <p className="tiny">Workout type</p>
            <p className="path-count">{currentType?.name || 'None yet'}</p>
          </div>
          <Link className="chip" to="/workout/types">
            {workoutTypes.length ? 'Change' : 'Set up'} ›
          </Link>
        </div>

        {currentType?.splits?.length ? (
          <>
            <p className="tiny" style={{ marginTop: 12 }}>Load a split into today</p>
            <div className="chip-row">
              {currentType.splits.map((split) => (
                <button key={split.id} className="secondary chip-btn" onClick={() => startSplit(currentType, split)}>
                  {split.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="sub" style={{ marginTop: 10 }}>
            {currentType
              ? 'This type has no splits yet. Open it to add Push, Pull, or Legs.'
              : 'Create a type such as PPL or Upper / Lower, then add your splits.'}
          </p>
        )}
      </section>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          className="primary"
          onClick={() => {
            setExerciseName('')
            setReps('8')
            setWeight('0')
            setError('')
            setSheet('exercise')
          }}
        >
          Add exercise
        </button>
        <Link className="secondary btn-link" to="/workout/types">
          My workout types
        </Link>
      </div>

      {grouped.length === 0 ? (
        <div className="empty card" style={{ marginTop: 12 }}>
          Nothing logged yet. Load a split above or add a single exercise.
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          {grouped.map((group) => (
            <section className="card exercise" key={group.exercise}>
              <div className="page-head-row" style={{ marginBottom: 8 }}>
                <h3>{group.exercise}</h3>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${group.exercise}`}
                  onClick={() => workout && removeExercise(date, workout.id, group.exercise)}
                >
                  ✕
                </button>
              </div>
              <div className="set-table">
                <div className="set-head">
                  <span>#</span>
                  <span>Reps</span>
                  <span>Kg</span>
                  <span />
                </div>
                {group.sets.map((set) => (
                  <div className="set-row" key={set.id}>
                    <span className="tiny">{set.setNumber}</span>
                    <input
                      inputMode="numeric"
                      value={set.reps}
                      onChange={(event) => updateSet(date, set.id, { reps: Number(event.target.value) || 0 })}
                    />
                    <input
                      inputMode="decimal"
                      value={set.weight}
                      onChange={(event) => updateSet(date, set.id, { weight: Number(event.target.value) || 0 })}
                    />
                    <button className="icon-btn" aria-label="Delete set" onClick={() => removeSet(date, set)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button className="secondary full" style={{ marginTop: 10 }} onClick={() => plusSet(group.exercise)}>
                + Set
              </button>
            </section>
          ))}
        </div>
      )}

      {sheet === 'exercise' ? (
        <Sheet
          title="Add exercise"
          onClose={() => setSheet(null)}
          footer={
            <>
              {error ? <p className="warn">{error}</p> : null}
              <button className="primary full" onClick={addExercise}>
                Add with first set
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="ex-name">Exercise</label>
            <input
              id="ex-name"
              value={exerciseName}
              onChange={(event) => setExerciseName(event.target.value)}
              placeholder="Bench press"
              autoComplete="off"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="ex-reps">Reps</label>
              <input id="ex-reps" inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ex-w">Weight (kg)</label>
              <input id="ex-w" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} />
            </div>
          </div>
        </Sheet>
      ) : null}

      {sheet === 'rename' ? (
        <Sheet
          title="Session name"
          onClose={() => setSheet(null)}
          footer={
            <button className="primary full" onClick={renameSession}>
              Save
            </button>
          }
        >
          <div className="field">
            <label htmlFor="sess">Name</label>
            <input
              id="sess"
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
              placeholder="PPL · Push"
            />
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}
