import { useState } from 'react'

export function ExerciseAccordion({ exercise, completed, onUpdateSet, onAddSet, onRemoveSet }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="card exercise-accordion">
      <button type="button" className="exercise-accordion-head" onClick={() => setOpen((v) => !v)}>
        <span className="exercise-accordion-title">
          <span className="exercise-accordion-chevron">{open ? '▼' : '▶'}</span>
          {exercise.exercise}
        </span>
        {exercise.previous ? <span className="tiny">Previous: {exercise.previous}</span> : null}
      </button>

      {open ? (
        <div className="exercise-accordion-body">
          <div className="set-table">
            <div className="set-head">
              <span>Set</span>
              <span>Weight</span>
              <span>Reps</span>
              <span />
            </div>
            {exercise.sets.map((set, index) => (
              <div className="set-row" key={set.id || `local-${index}`}>
                <span className="tiny">{index + 1}</span>
                <input
                  inputMode="decimal"
                  value={set.weight}
                  disabled={completed}
                  onChange={(event) => onUpdateSet(exercise.exercise, index, 'weight', event.target.value)}
                />
                <input
                  inputMode="numeric"
                  value={set.reps}
                  disabled={completed}
                  onChange={(event) => onUpdateSet(exercise.exercise, index, 'reps', event.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Delete set ${index + 1}`}
                  disabled={completed}
                  onClick={() => onRemoveSet(exercise.exercise, index)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {!completed ? (
            <button type="button" className="secondary" onClick={() => onAddSet(exercise.exercise)}>
              + Add Set
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
