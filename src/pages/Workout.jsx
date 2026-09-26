import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { GroupCard } from '../components/workout/GroupCard.jsx'
import { RoutineManagerSheet } from '../components/workout/RoutineManagerSheet.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { ROUTINE_TEMPLATES, buildSplitsFromTemplate } from '../workout/templates.js'
import { activeRoutine } from '../workout/utils.js'
import { useData } from '../sync/DataContext.jsx'

export function Workout() {
  const { workoutTypes, createWorkoutType, activateWorkoutType, updateWorkoutType, removeWorkoutType } =
    useData()
  const routine = activeRoutine(workoutTypes)
  const [manageOpen, setManageOpen] = useState(false)
  const [lastPerformed, setLastPerformed] = useState({})
  const [onboardingTemplate, setOnboardingTemplate] = useState('ppl')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const splitIds = routine?.splits?.map((split) => split.id) || []
    if (!splitIds.length) {
      setLastPerformed({})
      return undefined
    }
    const query = new URLSearchParams({ splitIds: splitIds.join(',') })
    api(`/api/workouts/splits/last?${query}`)
      .then(setLastPerformed)
      .catch(() => setLastPerformed({}))
    return undefined
  }, [routine])

  const createFirstRoutine = async () => {
    const template = ROUTINE_TEMPLATES.find((row) => row.id === onboardingTemplate)
    if (!template) return
    setCreating(true)
    try {
      const created = await createWorkoutType(template.label, buildSplitsFromTemplate(onboardingTemplate))
      if (created) await activateWorkoutType(created.id)
    } finally {
      setCreating(false)
    }
  }

  if (!routine) {
    return (
      <div className="page">
        <PageHead title="Workout" sub="Create your first routine" />
        <section className="card stack onboarding-card">
          <p className="sub">Choose how you train:</p>
          <div className="template-list">
            {ROUTINE_TEMPLATES.filter((row) => row.id !== 'empty').map((template) => (
              <label className="template-option" key={template.id}>
                <input
                  type="radio"
                  name="onboard-template"
                  checked={onboardingTemplate === template.id}
                  onChange={() => setOnboardingTemplate(template.id)}
                />
                <span>{template.label}</span>
              </label>
            ))}
          </div>
          <button type="button" className="primary full" disabled={creating} onClick={createFirstRoutine}>
            {creating ? 'Creating…' : 'Create Routine'}
          </button>
        </section>
        <button type="button" className="secondary full" onClick={() => setManageOpen(true)}>
          Manage routines
        </button>
        <RoutineManagerSheet
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          workoutTypes={workoutTypes}
          onCreate={createWorkoutType}
          onActivate={activateWorkoutType}
          onUpdate={updateWorkoutType}
          onRemove={removeWorkoutType}
        />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHead
        title="Workout"
        extra={
          <button type="button" className="secondary" onClick={() => setManageOpen(true)}>
            Manage
          </button>
        }
      />

      <section className="card routine-overview-card">
        <p className="tiny">Current routine</p>
        <h2 className="routine-name">{routine.name}</h2>
      </section>

      <div className="stack" style={{ marginTop: 14 }}>
        {(routine.splits || []).map((split) => (
          <GroupCard key={split.id} split={split} lastPerformed={lastPerformed[split.id]} />
        ))}
      </div>

      {(routine.splits || []).length === 0 ? (
        <div className="empty card" style={{ marginTop: 12 }}>
          No groups yet. Open Manage to add Push, Pull, Legs, or your own split.
        </div>
      ) : null}

      <Link className="secondary full history-link" to="/workout/history">
        Exercise History
      </Link>

      <RoutineManagerSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        workoutTypes={workoutTypes}
        onCreate={createWorkoutType}
        onActivate={activateWorkoutType}
        onUpdate={updateWorkoutType}
        onRemove={removeWorkoutType}
      />
    </div>
  )
}
