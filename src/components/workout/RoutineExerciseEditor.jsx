import { useMemo, useState } from 'react'

function exercisesFromOtherGroups(routine, currentSplitId) {
  const currentNames = new Set(
    (routine?.splits?.find((group) => group.id === currentSplitId)?.exercises || []).map((row) =>
      row.name.toLowerCase(),
    ),
  )
  const seen = new Set()
  const items = []

  for (const group of routine?.splits || []) {
    if (group.id === currentSplitId) continue
    for (const exercise of group.exercises || []) {
      const key = exercise.name.toLowerCase()
      if (!key || currentNames.has(key) || seen.has(key)) continue
      seen.add(key)
      items.push({ name: exercise.name, fromGroup: group.name })
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name))
}

export function RoutineExerciseEditor({ routine, split, onAdd, onRename, onRemove }) {
  const [exerciseName, setExerciseName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)

  const library = useMemo(
    () => exercisesFromOtherGroups(routine, split?.id),
    [routine, split?.id],
  )

  const startEdit = (exercise) => {
    setEditingId(exercise.id)
    setEditingName(exercise.name)
  }

  const commitEdit = async (exerciseId) => {
    const clean = editingName.trim()
    setEditingId(null)
    if (!clean) return
    await onRename(exerciseId, clean)
  }

  const addFromLibrary = async (name) => {
    await onAdd(name)
  }

  const addCustom = async () => {
    const clean = exerciseName.trim()
    if (!clean) return
    await onAdd(clean)
    setExerciseName('')
  }

  return (
    <div className="stack routine-exercise-editor">
      <div className="routine-exercise-list">
        {(split?.exercises || []).map((exercise) => (
          <div className="routine-exercise-row" key={exercise.id}>
            {editingId === exercise.id ? (
              <input
                className="routine-exercise-input"
                value={editingName}
                autoFocus
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={() => commitEdit(exercise.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitEdit(exercise.id)
                  if (event.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <span className="routine-exercise-name">{exercise.name}</span>
            )}
            <div className="routine-exercise-actions">
              <button
                type="button"
                className="icon-btn routine-icon-btn"
                aria-label={`Edit ${exercise.name}`}
                onClick={() => startEdit(exercise)}
              >
                ✎
              </button>
              <button
                type="button"
                className="icon-btn routine-icon-btn danger"
                aria-label={`Remove ${exercise.name}`}
                onClick={() => onRemove(exercise.id)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {library.length ? (
        <section className="routine-library">
          <button
            type="button"
            className="routine-library-toggle"
            onClick={() => setShowLibrary((open) => !open)}
          >
            <span>Add from other groups</span>
            <span className="routine-library-chevron">{showLibrary ? '▼' : '▶'}</span>
          </button>
          {showLibrary ? (
            <div className="routine-library-list">
              {library.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  className="routine-library-item"
                  onClick={() => addFromLibrary(item.name)}
                >
                  <span className="routine-library-name">{item.name}</span>
                  <span className="tiny">{item.fromGroup}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="field">
        <label htmlFor="new-exercise">Add exercise</label>
        <input
          id="new-exercise"
          value={exerciseName}
          onChange={(event) => setExerciseName(event.target.value)}
          placeholder="Bench Press"
          onKeyDown={(event) => {
            if (event.key === 'Enter') addCustom()
          }}
        />
      </div>
      <button type="button" className="secondary full" onClick={addCustom}>+ Add Exercise</button>
    </div>
  )
}
