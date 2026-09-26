import { useState } from 'react'
import { BusyButton, Spinner } from '../BusyButton.jsx'
import { Sheet } from '../Sheet.jsx'
import { useBusy, useBusyKey } from '../../lib/busy.js'
import { buildSplitsFromTemplate, ROUTINE_TEMPLATES } from '../../workout/templates.js'
import { activeRoutine } from '../../workout/utils.js'
import { RoutineExerciseEditor } from './RoutineExerciseEditor.jsx'

export function RoutineManagerSheet({ open, onClose, workoutTypes, onCreate, onActivate, onUpdate, onRemove }) {
  const [view, setView] = useState('list')
  const [editingId, setEditingId] = useState(null)
  const [editingSplitId, setEditingSplitId] = useState(null)
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('ppl')
  const [groupName, setGroupName] = useState('')
  const [copyFromId, setCopyFromId] = useState('')
  const [creating, runCreate] = useBusy()
  const [rowBusy, runRow] = useBusyKey()

  if (!open) return null

  const routine = workoutTypes.find((type) => type.id === editingId) || null
  const split = routine?.splits?.find((row) => row.id === editingSplitId) || null
  const current = activeRoutine(workoutTypes)

  const reset = () => {
    setView('list')
    setEditingId(null)
    setEditingSplitId(null)
    setName('')
    setGroupName('')
    setCopyFromId('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const pickRoutine = (id) =>
    runRow(`activate-${id}`, async () => {
      await onActivate(id)
      close()
    })

  const createRoutine = () =>
    runCreate(async () => {
      const clean = name.trim()
      if (!clean) return
      let splits = buildSplitsFromTemplate(templateId)
      if (copyFromId) {
        const source = workoutTypes.find((type) => type.id === copyFromId)
        if (source?.splits?.length) {
          splits = source.splits.map((row) => ({
            id: crypto.randomUUID(),
            name: row.name,
            exercises: (row.exercises || []).map((exercise) => ({
              id: crypto.randomUUID(),
              name: exercise.name,
              sets: exercise.sets || 3,
              reps: exercise.reps || 8,
              weight: exercise.weight || 0,
            })),
          }))
        }
      }
      const created = await onCreate(clean, splits)
      if (created) {
        await onActivate(created.id)
        close()
      }
    })

  const saveRoutineName = async (nextName) => {
    if (!routine || !nextName.trim()) return
    await onUpdate(routine.id, (current) => ({ ...current, name: nextName.trim() }))
  }

  const addGroup = async () => {
    const clean = groupName.trim()
    if (!routine || !clean) return
    await onUpdate(routine.id, (current) => ({
      splits: [...(current.splits || []), { id: crypto.randomUUID(), name: clean, exercises: [] }],
    }))
    setGroupName('')
  }

  const renameGroup = async (splitId, nextName) => {
    if (!routine || !nextName.trim()) return
    await onUpdate(routine.id, (current) => ({
      splits: (current.splits || []).map((row) =>
        row.id === splitId ? { ...row, name: nextName.trim() } : row,
      ),
    }))
  }

  const removeGroup = async (splitId) => {
    if (!routine) return
    await onUpdate(routine.id, (current) => ({
      splits: (current.splits || []).filter((row) => row.id !== splitId),
    }))
    if (editingSplitId === splitId) {
      setEditingSplitId(null)
      setView('edit-routine')
    }
  }

  const addExercise = async (name) => {
    const clean = String(name || '').trim()
    if (!routine || !split || !clean) return
    if (split.exercises?.some((row) => row.name.toLowerCase() === clean.toLowerCase())) return
    await onUpdate(routine.id, (current) => ({
      splits: (current.splits || []).map((row) =>
        row.id === split.id
          ? {
              ...row,
              exercises: [
                ...(row.exercises || []),
                { id: crypto.randomUUID(), name: clean, sets: 3, reps: 8, weight: 0 },
              ],
            }
          : row,
      ),
    }))
  }

  const renameExercise = async (exerciseId, nextName) => {
    const clean = String(nextName || '').trim()
    if (!routine || !split || !clean) return
    if (
      split.exercises?.some(
        (row) => row.id !== exerciseId && row.name.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      return
    }
    await onUpdate(routine.id, (current) => ({
      splits: (current.splits || []).map((row) =>
        row.id === split.id
          ? {
              ...row,
              exercises: row.exercises.map((exercise) =>
                exercise.id === exerciseId ? { ...exercise, name: clean } : exercise,
              ),
            }
          : row,
      ),
    }))
  }

  const removeExercise = async (exerciseId) => {
    if (!routine || !split) return
    await onUpdate(routine.id, (current) => ({
      splits: (current.splits || []).map((row) =>
        row.id === split.id
          ? { ...row, exercises: row.exercises.filter((exercise) => exercise.id !== exerciseId) }
          : row,
      ),
    }))
  }

  const deleteRoutine = async (id) => {
    const type = workoutTypes.find((row) => row.id === id)
    if (!type) return
    if (type.active && workoutTypes.length > 1) {
      const fallback = workoutTypes.find((row) => row.id !== id)
      if (fallback) await onActivate(fallback.id)
    }
    await onRemove(id)
    if (editingId === id) reset()
  }

  let title = 'Manage Workout'
  if (view === 'create') title = 'Create Routine'
  if (view === 'edit-routine') title = routine?.name || 'Edit routine'
  if (view === 'edit-group') title = split?.name || 'Exercises'

  return (
    <Sheet title={title} onClose={close}>
      {view === 'list' ? (
        <div className="stack">
          <div>
            <p className="tiny">Current routine</p>
            <p className="path-count">{current?.name || 'None selected'}</p>
          </div>

          <div className="section-title">
            <h2>Your routines</h2>
          </div>

          <div className="list">
            {workoutTypes.map((type) => (
              <div className={`row${type.active ? ' selected' : ''}`} key={type.id}>
                <button type="button" className="grow list-link text-left" onClick={() => pickRoutine(type.id)}>
                  <span className="name">
                    {type.name}
                    {type.active ? <span className="chip inline-chip">Active</span> : null}
                  </span>
                  <span className="meta">
                    {(type.splits || []).map((row) => row.name).join(' · ') || 'No groups yet'}
                  </span>
                </button>
                <button
                  type="button"
                  className="secondary compact-btn"
                  onClick={() => {
                    setEditingId(type.id)
                    setView('edit-routine')
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`icon-btn${rowBusy === `del-${type.id}` ? ' is-busy' : ''}`}
                  aria-label={`Delete ${type.name}`}
                  disabled={Boolean(rowBusy)}
                  onClick={() => runRow(`del-${type.id}`, () => deleteRoutine(type.id))}
                >
                  {rowBusy === `del-${type.id}` ? <Spinner size={12} /> : '✕'}
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="primary full" onClick={() => setView('create')}>
            + Add Routine
          </button>
        </div>
      ) : null}

      {view === 'create' ? (
        <div className="stack">
          <div className="field">
            <label htmlFor="routine-name">Routine name</label>
            <input
              id="routine-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Push Pull Legs"
              autoComplete="off"
            />
          </div>

          <div>
            <p className="tiny">Template</p>
            <div className="template-list">
              {ROUTINE_TEMPLATES.map((template) => (
                <label className="template-option" key={template.id}>
                  <input
                    type="radio"
                    name="routine-template"
                    checked={templateId === template.id}
                    onChange={() => setTemplateId(template.id)}
                  />
                  <span>{template.label}</span>
                </label>
              ))}
            </div>
          </div>

          {workoutTypes.length ? (
            <div className="field">
              <label htmlFor="copy-routine">Copy existing routine (optional)</label>
              <select id="copy-routine" value={copyFromId} onChange={(event) => setCopyFromId(event.target.value)}>
                <option value="">None</option>
                {workoutTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="btn-row">
            <button type="button" className="secondary" onClick={() => setView('list')}>Back</button>
            <BusyButton className="primary" busy={creating} busyLabel="Creating…" disabled={!name.trim()} onClick={createRoutine}>
              Create Routine
            </BusyButton>
          </div>
        </div>
      ) : null}

      {view === 'edit-routine' && routine ? (
        <div className="stack">
          <div className="field">
            <label htmlFor="edit-routine-name">Routine name</label>
            <input
              id="edit-routine-name"
              defaultValue={routine.name}
              onBlur={(event) => saveRoutineName(event.target.value)}
            />
          </div>

          <div className="section-title">
            <h2>Workout groups</h2>
          </div>

          <div className="list">
            {(routine.splits || []).map((row) => (
              <div className="row" key={row.id}>
                <button
                  type="button"
                  className="grow list-link text-left"
                  onClick={() => {
                    setEditingSplitId(row.id)
                    setView('edit-group')
                  }}
                >
                  <span className="name">{row.name}</span>
                  <span className="meta">
                    {row.exercises?.length || 0} exercise{(row.exercises?.length || 0) === 1 ? '' : 's'}
                  </span>
                </button>
                <button type="button" className="icon-btn" aria-label={`Delete ${row.name}`} onClick={() => removeGroup(row.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="field">
            <label htmlFor="new-group">Add workout group</label>
            <input
              id="new-group"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Push"
              onKeyDown={(event) => {
                if (event.key === 'Enter') addGroup()
              }}
            />
          </div>
          <button type="button" className="secondary full" onClick={addGroup}>+ Add workout group</button>

          <button type="button" className="primary full" onClick={() => setView('list')}>Done</button>
        </div>
      ) : null}

      {view === 'edit-group' && routine && split ? (
        <div className="stack">
          <div className="field">
            <label htmlFor="group-name">Group name</label>
            <input
              id="group-name"
              defaultValue={split.name}
              onBlur={(event) => renameGroup(split.id, event.target.value)}
            />
          </div>

          <RoutineExerciseEditor
            routine={routine}
            split={split}
            onAdd={addExercise}
            onRename={renameExercise}
            onRemove={removeExercise}
          />

          <button type="button" className="primary full" onClick={() => setView('edit-routine')}>Done</button>
        </div>
      ) : null}
    </Sheet>
  )
}
