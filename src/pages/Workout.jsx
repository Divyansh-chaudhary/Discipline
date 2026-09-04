import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BusyButton, Spinner } from '../components/BusyButton.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { useBusy, useBusyKey } from '../lib/busy.js'
import { formatPrettyDate, localDateKey } from '../lib/dates.js'
import { fmtCal } from '../lib/format.js'
import { activeWorkoutType, exerciseLine, groupSets, sessionSummary, useSplitStarter } from '../lib/workouts.js'
import { useData, useDay } from '../sync/DataContext.jsx'

/** Server sets become editable drafts; exercises with unsaved edits are preserved. */
function mergeDraft(previous, grouped) {
  const dirty = new Map(previous.filter((group) => group.dirty).map((group) => [group.exercise, group]))
  const fromServer = grouped.map(
    (group) =>
      dirty.get(group.exercise) || {
        exercise: group.exercise,
        dirty: false,
        sets: group.sets.map((set) => ({ id: set.id, reps: set.reps, weight: set.weight })),
      },
  )
  const serverNames = new Set(grouped.map((group) => group.exercise))
  const localOnly = previous.filter((group) => group.dirty && !serverNames.has(group.exercise))
  return [...fromServer, ...localOnly]
}

export function Workout() {
  const date = localDateKey()
  const {
    workoutTypes,
    ensureWorkout,
    renameWorkout,
    removeExercise,
    saveExerciseSets,
    completeWorkout,
  } = useData()
  const { workout, sets, loaded } = useDay(date)
  const startSplit = useSplitStarter(date)

  useEffect(() => {
    if (loaded && !workout) ensureWorkout(date)
  }, [date, loaded, workout, ensureWorkout])

  const grouped = useMemo(() => groupSets(sets), [sets])
  const currentType = activeWorkoutType(workoutTypes)
  const completed = Boolean(workout?.completedAt)

  const [draft, setDraft] = useState([])
  useEffect(() => {
    setDraft((previous) => mergeDraft(previous, grouped))
  }, [grouped])

  const [sheet, setSheet] = useState(null)
  const [exerciseName, setExerciseName] = useState('')
  const [reps, setReps] = useState('8')
  const [weight, setWeight] = useState('0')
  const [sessionName, setSessionName] = useState('')
  const [error, setError] = useState('')
  const [renameBusy, runRename] = useBusy()
  const [saveAllBusy, runSaveAll] = useBusy()
  const [doneBusy, runDone] = useBusy()
  const [splitBusy, runSplit] = useBusyKey()
  const [rowBusy, runRow] = useBusyKey()

  const dirtyGroups = draft.filter((group) => group.dirty)

  const patchGroup = (exercise, updater) => {
    setDraft((previous) =>
      previous.map((group) =>
        group.exercise === exercise ? { ...updater(group), exercise, dirty: true } : group,
      ),
    )
  }

  const editSet = (exercise, index, key, value) =>
    patchGroup(exercise, (group) => ({
      ...group,
      sets: group.sets.map((set, i) => (i === index ? { ...set, [key]: value } : set)),
    }))

  const addSetRow = (exercise) =>
    patchGroup(exercise, (group) => {
      const last = group.sets[group.sets.length - 1]
      return {
        ...group,
        sets: [...group.sets, { id: null, reps: last?.reps ?? 8, weight: last?.weight ?? 0 }],
      }
    })

  const dropSetRow = (exercise, index) =>
    patchGroup(exercise, (group) => ({
      ...group,
      sets: group.sets.filter((_, i) => i !== index),
    }))

  const saveGroup = (exercise) =>
    runRow(`save-${exercise}`, async () => {
      const group = draft.find((row) => row.exercise === exercise)
      if (!group) return
      await saveExerciseSets(date, exercise, group.sets)
      setDraft((previous) =>
        previous.map((row) => (row.exercise === exercise ? { ...row, dirty: false } : row)),
      )
    })

  const saveAll = () =>
    runSaveAll(async () => {
      for (const group of dirtyGroups) {
        await saveExerciseSets(date, group.exercise, group.sets)
      }
      setDraft((previous) => previous.map((row) => ({ ...row, dirty: false })))
    })

  const dropExercise = (exercise) =>
    runRow(`drop-${exercise}`, async () => {
      const onServer = grouped.some((group) => group.exercise === exercise)
      if (onServer && workout) await removeExercise(date, workout.id, exercise)
      setDraft((previous) => previous.filter((row) => row.exercise !== exercise))
    })

  const addExercise = () => {
    const name = exerciseName.trim()
    if (!name) {
      setError('Name the movement.')
      return
    }
    if (draft.some((group) => group.exercise.toLowerCase() === name.toLowerCase())) {
      setError('That exercise is already in this session.')
      return
    }
    setDraft((previous) => [
      ...previous,
      {
        exercise: name,
        dirty: true,
        sets: [{ id: null, reps: Number(reps) || 0, weight: Number(weight) || 0 }],
      },
    ])
    setSheet(null)
    setError('')
  }

  const renameSession = () =>
    runRename(async () => {
      if (!workout || !sessionName.trim()) return
      await renameWorkout(date, workout.id, sessionName.trim())
      setSheet(null)
    })

  const finishWorkout = () =>
    runDone(async () => {
      if (dirtyGroups.length) {
        for (const group of dirtyGroups) {
          await saveExerciseSets(date, group.exercise, group.sets)
        }
        setDraft((previous) => previous.map((row) => ({ ...row, dirty: false })))
      }
      const session = workout ?? (await ensureWorkout(date))
      if (session) await completeWorkout(date, session.id, true)
    })

  const reopenWorkout = () =>
    runDone(async () => {
      if (workout) await completeWorkout(date, workout.id, false)
    })

  if (completed) {
    return (
      <div className="page">
        <PageHead kicker="Iron" title={workout?.name || 'Session'} sub={formatPrettyDate(date)} />
        <CompletedSession sets={sets} />
        <BusyButton
          className="secondary full"
          style={{ marginTop: 12 }}
          busy={doneBusy}
          busyLabel="Reopening…"
          onClick={reopenWorkout}
        >
          Reopen to edit
        </BusyButton>
      </div>
    )
  }

  return (
    <div className="page with-action-bar">
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
                <BusyButton
                  key={split.id}
                  className="secondary chip-btn"
                  busy={splitBusy === split.id}
                  busyLabel="Loading…"
                  disabled={Boolean(splitBusy)}
                  onClick={() => runSplit(split.id, () => startSplit(currentType, split))}
                >
                  {split.name}
                </BusyButton>
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

      {!loaded ? (
        <div className="inline-loader" style={{ marginTop: 12 }}>
          <Spinner size={14} /> Loading session…
        </div>
      ) : null}

      {draft.length === 0 ? (
        <div className="empty card" style={{ marginTop: 12 }}>
          Nothing logged yet. Load a split above or add a single exercise.
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          {draft.map((group) => (
            <section className="card exercise" key={group.exercise}>
              <div className="page-head-row" style={{ marginBottom: 8 }}>
                <h3>
                  {group.exercise}
                  {group.dirty ? <span className="chip inline-chip dirty-chip">Unsaved</span> : null}
                </h3>
                <button
                  className={`icon-btn${rowBusy === `drop-${group.exercise}` ? ' is-busy' : ''}`}
                  aria-label={`Remove ${group.exercise}`}
                  disabled={Boolean(rowBusy)}
                  onClick={() => dropExercise(group.exercise)}
                >
                  {rowBusy === `drop-${group.exercise}` ? <Spinner size={12} /> : '✕'}
                </button>
              </div>

              <div className="set-table">
                <div className="set-head">
                  <span>#</span>
                  <span>Reps</span>
                  <span>Kg</span>
                  <span />
                </div>
                {group.sets.map((set, index) => (
                  <div className="set-row" key={set.id || `local-${index}`}>
                    <span className="tiny">{index + 1}</span>
                    <input
                      inputMode="numeric"
                      value={set.reps}
                      onChange={(event) => editSet(group.exercise, index, 'reps', event.target.value)}
                    />
                    <input
                      inputMode="decimal"
                      value={set.weight}
                      onChange={(event) => editSet(group.exercise, index, 'weight', event.target.value)}
                    />
                    <button
                      className="icon-btn"
                      aria-label={`Delete set ${index + 1}`}
                      onClick={() => dropSetRow(group.exercise, index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="btn-row" style={{ marginTop: 10 }}>
                <button className="secondary" onClick={() => addSetRow(group.exercise)}>
                  + Set
                </button>
                <BusyButton
                  className="primary"
                  busy={rowBusy === `save-${group.exercise}`}
                  busyLabel="Saving…"
                  disabled={!group.dirty || Boolean(rowBusy)}
                  onClick={() => saveGroup(group.exercise)}
                >
                  {group.dirty ? 'Save' : 'Saved'}
                </BusyButton>
              </div>
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
                Add to session
              </button>
            </>
          }
        >
          <p className="sub">Added locally — press Save on the card to store it.</p>
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
          onClose={() => !renameBusy && setSheet(null)}
          footer={
            <BusyButton className="primary full" busy={renameBusy} busyLabel="Saving…" onClick={renameSession}>
              Save
            </BusyButton>
          }
        >
          <div className="field">
            <label htmlFor="sess">Name</label>
            <input
              id="sess"
              value={sessionName}
              disabled={renameBusy}
              onChange={(event) => setSessionName(event.target.value)}
              placeholder="PPL · Push"
            />
          </div>
        </Sheet>
      ) : null}

      <div className="action-bar">
        <div className="action-bar-inner">
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
          {dirtyGroups.length ? (
            <BusyButton
              className="secondary"
              busy={saveAllBusy}
              busyLabel="Saving…"
              onClick={saveAll}
            >
              Save {dirtyGroups.length}
            </BusyButton>
          ) : (
            <BusyButton
              className="secondary"
              busy={doneBusy}
              busyLabel="Finishing…"
              disabled={draft.length === 0}
              onClick={finishWorkout}
            >
              Complete
            </BusyButton>
          )}
        </div>
      </div>
    </div>
  )
}

function CompletedSession({ sets }) {
  const { groups, exercises, setCount, volume } = sessionSummary(sets)
  return (
    <>
      <div className="done-banner">
        <span>Workout complete</span>
        <span className="tiny">Read-only</span>
      </div>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="summary-grid">
          <div className="summary-stat">
            <strong>{exercises}</strong>
            <span>Exercises</span>
          </div>
          <div className="summary-stat">
            <strong>{setCount}</strong>
            <span>Sets</span>
          </div>
          <div className="summary-stat">
            <strong>{fmtCal(volume)}</strong>
            <span>kg volume</span>
          </div>
        </div>
        <div className="summary-lines">
          {groups.map((group) => (
            <div className="summary-line" key={group.exercise}>
              <span>{group.exercise}</span>
              <span>{exerciseLine(group.sets)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
