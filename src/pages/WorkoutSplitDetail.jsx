import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { PageHead } from '../components/SyncChip.jsx'
import { localDateKey } from '../lib/dates.js'
import { useSplitStarter } from '../lib/workouts.js'
import { useData } from '../sync/DataContext.jsx'

const BLANK_EXERCISE = { name: '', sets: '3', reps: '8', weight: '0' }

export function WorkoutSplitDetail() {
  const { typeId, splitId } = useParams()
  const { workoutTypes, updateWorkoutType } = useData()
  const startSplit = useSplitStarter(localDateKey(), { redirectTo: '/workout' })

  const type = workoutTypes.find((row) => row.id === typeId)
  const split = type?.splits?.find((row) => row.id === splitId)

  const [draft, setDraft] = useState(BLANK_EXERCISE)
  const [renaming, setRenaming] = useState(null)

  if (!type || !split) return <Navigate to="/workout/types" replace />

  const patchSplit = (updater) =>
    updateWorkoutType(type.id, (current) => ({
      splits: (current.splits || []).map((row) => (row.id === split.id ? updater(row) : row)),
    }))

  const addExercise = async () => {
    const name = draft.name.trim()
    if (!name) return
    setDraft(BLANK_EXERCISE)
    await patchSplit((row) => ({
      ...row,
      exercises: [
        ...(row.exercises || []),
        {
          id: crypto.randomUUID(),
          name,
          sets: Math.max(1, Number(draft.sets) || 1),
          reps: Math.max(0, Number(draft.reps) || 0),
          weight: Math.max(0, Number(draft.weight) || 0),
        },
      ],
    }))
  }

  const saveExercise = (exerciseId, patch) =>
    patchSplit((row) => ({
      ...row,
      exercises: row.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, ...patch } : exercise,
      ),
    }))

  const removeExercise = (exerciseId) =>
    patchSplit((row) => ({
      ...row,
      exercises: row.exercises.filter((exercise) => exercise.id !== exerciseId),
    }))

  const saveName = async () => {
    const clean = renaming.trim()
    if (clean) await patchSplit((row) => ({ ...row, name: clean }))
    setRenaming(null)
  }

  return (
    <div className="page">
      <PageHead
        kicker={type.name}
        title={split.name}
        sub={`${split.exercises?.length || 0} exercise${split.exercises?.length === 1 ? '' : 's'}`}
        back={{ to: `/workout/types/${type.id}`, label: type.name }}
      />

      <div className="btn-row">
        <button className="primary" onClick={() => startSplit(type, split)}>
          Start today
        </button>
        <button className="secondary" onClick={() => setRenaming(split.name)}>
          Rename split
        </button>
      </div>

      {renaming === null ? null : (
        <section className="card stack" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="rename-split">Split name</label>
            <input
              id="rename-split"
              value={renaming}
              onChange={(event) => setRenaming(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveName()
              }}
              autoFocus
            />
          </div>
          <div className="btn-row">
            <button className="secondary" onClick={() => setRenaming(null)}>
              Cancel
            </button>
            <button className="primary" onClick={saveName}>
              Save name
            </button>
          </div>
        </section>
      )}

      <div className="section-title">
        <h2>Exercises</h2>
        <span className="tiny">Sets · reps · kg</span>
      </div>

      {(split.exercises || []).length === 0 ? (
        <div className="empty card">Nothing planned yet. Add your first movement below.</div>
      ) : (
        <div className="stack">
          {split.exercises.map((exercise) => (
            <PlannedExercise
              key={exercise.id}
              exercise={exercise}
              onSave={(patch) => saveExercise(exercise.id, patch)}
              onRemove={() => removeExercise(exercise.id)}
            />
          ))}
        </div>
      )}

      <section className="card stack" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="new-exercise">Add exercise</label>
          <input
            id="new-exercise"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Bench press"
            autoComplete="off"
          />
        </div>
        <div className="grid-3">
          <NumberField label="Sets" value={draft.sets} onChange={(sets) => setDraft((c) => ({ ...c, sets }))} />
          <NumberField label="Reps" value={draft.reps} onChange={(reps) => setDraft((c) => ({ ...c, reps }))} />
          <NumberField label="Kg" decimal value={draft.weight} onChange={(weight) => setDraft((c) => ({ ...c, weight }))} />
        </div>
        <button className="secondary full" disabled={!draft.name.trim()} onClick={addExercise}>
          + Add exercise
        </button>
      </section>
    </div>
  )
}

function PlannedExercise({ exercise, onSave, onRemove }) {
  const [local, setLocal] = useState({
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weight: String(exercise.weight),
  })

  const commit = (key, min) => {
    const value = Math.max(min, Number(local[key]) || min)
    setLocal((current) => ({ ...current, [key]: String(value) }))
    if (value !== exercise[key]) onSave({ [key]: value })
  }

  return (
    <section className="card planned-exercise">
      <div className="page-head-row">
        <strong>{exercise.name}</strong>
        <button className="icon-btn" aria-label={`Remove ${exercise.name}`} onClick={onRemove}>
          ✕
        </button>
      </div>
      <div className="grid-3">
        <NumberField
          label="Sets"
          value={local.sets}
          onChange={(sets) => setLocal((current) => ({ ...current, sets }))}
          onBlur={() => commit('sets', 1)}
        />
        <NumberField
          label="Reps"
          value={local.reps}
          onChange={(reps) => setLocal((current) => ({ ...current, reps }))}
          onBlur={() => commit('reps', 0)}
        />
        <NumberField
          label="Kg"
          decimal
          value={local.weight}
          onChange={(weight) => setLocal((current) => ({ ...current, weight }))}
          onBlur={() => commit('weight', 0)}
        />
      </div>
    </section>
  )
}

function NumberField({ label, value, onChange, onBlur, decimal = false }) {
  return (
    <label className="mini-field">
      <span>{label}</span>
      <input
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </label>
  )
}
