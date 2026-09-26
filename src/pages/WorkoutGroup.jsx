import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BusyButton, Spinner } from '../components/BusyButton.jsx'
import { DateNavigator } from '../components/workout/DateNavigator.jsx'
import { ExerciseAccordion } from '../components/workout/ExerciseAccordion.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { localDateKey } from '../lib/dates.js'
import { useWorkoutGroup } from '../workout/useWorkoutGroup.js'
import { activeRoutine, unloggedExercises } from '../workout/utils.js'
import { useData } from '../sync/DataContext.jsx'

export function WorkoutGroup() {
  const { splitId } = useParams()
  const { user, workoutTypes } = useData()
  const routine = activeRoutine(workoutTypes)
  const [date, setDate] = useState(localDateKey())
  const [confirmComplete, setConfirmComplete] = useState(false)

  const {
    split,
    exercises,
    loading,
    saving,
    dirty,
    syncError,
    completed,
    updateSet,
    addSet,
    removeSet,
    saveWorkout,
    completeWorkout,
    goDate,
  } = useWorkoutGroup({ userId: user?.id, routine, splitId, date, setDate })

  if (!routine || !split) return <Navigate to="/workout" replace />

  const finish = async () => {
    const skipped = unloggedExercises(exercises)
    if (skipped.length && !confirmComplete) {
      setConfirmComplete(true)
      return
    }
    const saved = await saveWorkout()
    if (!saved.ok) return
    const result = await completeWorkout(true)
    if (result.ok) setConfirmComplete(false)
  }

  const reopen = async () => {
    await completeWorkout(false)
  }

  return (
    <div className="page with-action-bar">
      <PageHead
        title={split.name}
        back={{ to: '/workout', label: 'Workout' }}
      />

      <DateNavigator date={date} onChange={goDate} />

      {syncError ? <p className="warn boot-banner">{syncError}</p> : null}
      {dirty ? <p className="chip inline-chip dirty-chip">Unsaved changes</p> : null}
      {completed ? <div className="done-banner"><span>Workout complete</span></div> : null}

      {loading && exercises.length === 0 ? (
        <div className="inline-loader" style={{ marginTop: 12 }}>
          <Spinner size={14} /> Loading session…
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          {exercises.length === 0 ? (
            <div className="empty card">
              No exercises in this group yet. Open Manage on the Workout screen to add movements.
            </div>
          ) : (
            exercises.map((exercise) => (
              <ExerciseAccordion
                key={exercise.exercise}
                exercise={exercise}
                completed={completed}
                onUpdateSet={updateSet}
                onAddSet={addSet}
                onRemoveSet={removeSet}
              />
            ))
          )}
        </div>
      )}

      {confirmComplete ? (
        <section className="card stack confirm-card">
          <p>You haven&apos;t logged all exercises.</p>
          <p className="sub">Do you want to complete anyway?</p>
          <div className="btn-row">
            <button type="button" className="secondary" onClick={() => setConfirmComplete(false)}>Go Back</button>
            <BusyButton className="primary" busy={saving} busyLabel="Completing…" onClick={finish}>
              Complete
            </BusyButton>
          </div>
        </section>
      ) : null}

      <div className="action-bar">
        <div className="action-bar-inner">
          {completed ? (
            <BusyButton className="secondary full" onClick={reopen}>Reopen to edit</BusyButton>
          ) : (
            <>
              <BusyButton className="primary" busy={saving} busyLabel="Saving…" onClick={saveWorkout}>
                Save Workout
              </BusyButton>
              <BusyButton className="secondary" busy={saving} busyLabel="Completing…" onClick={finish}>
                Complete Workout
              </BusyButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
