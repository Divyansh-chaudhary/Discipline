import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BusyButton, Spinner } from '../components/BusyButton.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { useBusy, useBusyKey } from '../lib/busy.js'
import { useData } from '../sync/DataContext.jsx'

export function WorkoutTypeDetail() {
  const { typeId } = useParams()
  const { workoutTypes, updateWorkoutType, activateWorkoutType } = useData()
  const type = workoutTypes.find((row) => row.id === typeId)

  const [splitName, setSplitName] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [adding, runAdd] = useBusy()
  const [savingName, runSaveName] = useBusy()
  const [activating, runActivate] = useBusy()
  const [rowBusy, runRow] = useBusyKey()

  if (!type) return <Navigate to="/workout/types" replace />

  const addSplit = () =>
    runAdd(async () => {
      const clean = splitName.trim()
      if (!clean) return
      setSplitName('')
      await updateWorkoutType(type.id, (current) => ({
        splits: [...(current.splits || []), { id: crypto.randomUUID(), name: clean, exercises: [] }],
      }))
    })

  const removeSplit = (splitId) =>
    runRow(splitId, () =>
      updateWorkoutType(type.id, (current) => ({
        splits: (current.splits || []).filter((split) => split.id !== splitId),
      })),
    )

  const saveName = () =>
    runSaveName(async () => {
      const clean = renaming.trim()
      if (clean) await updateWorkoutType(type.id, () => ({ name: clean }))
      setRenaming(null)
    })

  return (
    <div className="page">
      <PageHead
        kicker="Workout type"
        title={type.name}
        sub={`${type.splits?.length || 0} split${type.splits?.length === 1 ? '' : 's'}`}
        back={{ to: '/workout/types', label: 'Workout types' }}
        extra={
          type.active ? (
            <span className="chip">In use</span>
          ) : (
            <BusyButton
              className="secondary"
              busy={activating}
              busyLabel="Switching…"
              onClick={() => runActivate(() => activateWorkoutType(type.id))}
            >
              Use this
            </BusyButton>
          )
        }
      />

      {renaming === null ? (
        <button className="secondary full" onClick={() => setRenaming(type.name)}>
          Rename type
        </button>
      ) : (
        <section className="card stack">
          <div className="field">
            <label htmlFor="rename-type">Type name</label>
            <input
              id="rename-type"
              value={renaming}
              disabled={savingName}
              onChange={(event) => setRenaming(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveName()
              }}
              autoFocus
            />
          </div>
          <div className="btn-row">
            <button className="secondary" disabled={savingName} onClick={() => setRenaming(null)}>
              Cancel
            </button>
            <BusyButton className="primary" busy={savingName} busyLabel="Saving…" onClick={saveName}>
              Save name
            </BusyButton>
          </div>
        </section>
      )}

      <div className="section-title">
        <h2>Splits</h2>
        <span className="tiny">Push · Pull · Legs</span>
      </div>

      {(type.splits || []).length === 0 ? (
        <div className="empty card">No splits yet. Add your first one below.</div>
      ) : (
        <div className="list">
          {type.splits.map((split) => (
            <div className="row" key={split.id}>
              <Link className="grow list-link" to={`/workout/types/${type.id}/splits/${split.id}`}>
                <span className="name">{split.name}</span>
                <span className="meta">
                  {split.exercises?.length
                    ? `${split.exercises.length} exercise${split.exercises.length === 1 ? '' : 's'}`
                    : 'No exercises yet'}
                </span>
              </Link>
              <button
                className={`icon-btn${rowBusy === split.id ? ' is-busy' : ''}`}
                aria-label={`Delete ${split.name}`}
                disabled={Boolean(rowBusy)}
                onClick={() => removeSplit(split.id)}
              >
                {rowBusy === split.id ? <Spinner size={12} /> : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="card stack" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="split-name">Add split</label>
          <input
            id="split-name"
            value={splitName}
            disabled={adding}
            onChange={(event) => setSplitName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addSplit()
            }}
            placeholder="Push"
            autoComplete="off"
          />
        </div>
        <BusyButton
          className="secondary full"
          busy={adding}
          busyLabel="Adding…"
          disabled={!splitName.trim()}
          onClick={addSplit}
        >
          + Add split
        </BusyButton>
      </section>
    </div>
  )
}
