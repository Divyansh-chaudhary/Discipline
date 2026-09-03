import { useState } from 'react'
import { BusyButton, Spinner } from '../components/BusyButton.jsx'
import { FoodFields, emptyFood, parseFoodFields } from '../components/FoodFields.jsx'
import { MacroBars, RemainingHero } from '../components/MacroBars.jsx'
import { TodayPathCard } from '../components/PulseCard.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { OfflineEmpty, PageHead } from '../components/SyncChip.jsx'
import { totalsFromLogs } from '../db/index.js'
import { useBusy, useBusyKey } from '../lib/busy.js'
import { formatPrettyDate, localDateKey } from '../lib/dates.js'
import { pulseFromState } from '../lib/discipline.js'
import { fmtCal, fmtG, round1 } from '../lib/format.js'
import { useData, useDay } from '../sync/DataContext.jsx'

const MIN_SERVINGS = 1
const SERVING_STEP = 1

function cleanQuantity(value, delta = 0) {
  return round1(Math.max(MIN_SERVINGS, (Number(value) || MIN_SERVINGS) + delta))
}

export function Today() {
  const date = localDateKey()
  const { settings, customFoods, discipline, addLog, removeLog } = useData()
  const { logs, sets, loaded, unavailable } = useDay(date)
  const pantry = customFoods
  const totals = totalsFromLogs(logs)
  const pulse = pulseFromState({ logs, totals, targets: settings, setCount: sets.length })

  const [sheet, setSheet] = useState(null)
  const [form, setForm] = useState(emptyFood)
  const [pantrySelection, setPantrySelection] = useState({})
  const [error, setError] = useState('')
  const [manualBusy, runManual] = useBusy()
  const [pantryBusy, runPantry] = useBusy()
  const [removingId, runRemove] = useBusyKey()

  const openManual = () => {
    setError('')
    setForm({ ...emptyFood, servings: '1' })
    setSheet('manual')
  }

  const openPantry = () => {
    setError('')
    setPantrySelection({})
    setSheet('pantry')
  }

  const logManual = () =>
    runManual(async () => {
      const parsed = parseFoodFields(form, { deriveCalories: true })
      if (!parsed.name) {
        setError('Give the food a name.')
        return
      }
      const servings = parsed.servings || 1
      await addLog({
        date,
        name: parsed.name,
        servings,
        calories: round1(parsed.calories * servings),
        protein: round1(parsed.protein * servings),
        carbs: round1(parsed.carbs * servings),
        fat: round1(parsed.fat * servings),
        source: 'manual',
      })
      setSheet(null)
    })

  const togglePantryFood = (food) => {
    setPantrySelection((current) => {
      const next = { ...current }
      if (Object.hasOwn(next, food.id)) delete next[food.id]
      else next[food.id] = '1'
      return next
    })
  }

  const setPantryQuantity = (foodId, value) => {
    setPantrySelection((current) =>
      Object.hasOwn(current, foodId) ? { ...current, [foodId]: value } : current,
    )
  }

  const stepPantryQuantity = (foodId, delta) => {
    setPantrySelection((current) => {
      if (!Object.hasOwn(current, foodId)) return current
      return { ...current, [foodId]: String(cleanQuantity(current[foodId], delta)) }
    })
  }

  const commitPantryQuantity = (foodId) => {
    setPantrySelection((current) => {
      if (!Object.hasOwn(current, foodId)) return current
      return { ...current, [foodId]: String(cleanQuantity(current[foodId])) }
    })
  }

  const pantryCount = Object.keys(pantrySelection).length

  const logPantrySelection = () =>
    runPantry(async () => {
      const selected = pantry.filter((food) => Object.hasOwn(pantrySelection, food.id))
      await Promise.all(
        selected.map((food) => {
          const servings = cleanQuantity(pantrySelection[food.id])
          return addLog({
            date,
            name: food.name,
            servings,
            calories: round1((food.calories || 0) * servings),
            protein: round1((food.protein || 0) * servings),
            carbs: round1((food.carbs || 0) * servings),
            fat: round1((food.fat || 0) * servings),
            source: 'custom',
            customFoodId: food.id,
          })
        }),
      )
      setSheet(null)
    })

  return (
    <div className="page">
      <PageHead kicker="Today" title={formatPrettyDate(date)} compact />

      <section className="card">
        <RemainingHero totals={totals} targets={settings} />
        <MacroBars totals={totals} targets={settings} includeCalories={false} />
      </section>

      <TodayPathCard pulse={pulse} xp={discipline.profile?.totalXp || 0} streaks={discipline.streaks} />

      <div className="section-title">
        <h2>Diary</h2>
        <span className="tiny">{logs.length} item{logs.length === 1 ? '' : 's'}</span>
      </div>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className="primary" onClick={openManual}>
          Log food
        </button>
        <button className="secondary" onClick={openPantry}>
          From pantry
        </button>
      </div>

      {!loaded && !unavailable ? (
        <div className="inline-loader" style={{ marginBottom: 12 }}>
          <Spinner size={14} /> Loading diary…
        </div>
      ) : null}

      <OfflineEmpty loaded={loaded && !unavailable}>
        {logs.length === 0 ? (
          <div className="empty card">
            Nothing logged yet. Add a meal — it saves to your account, or queues if you are offline.
          </div>
        ) : (
          <div className="list">
            {logs.map((row) => (
              <div className="row" key={row.id}>
                <div className="grow">
                  <div className="name">{row.name}</div>
                  <div className="meta">
                    {row.servings}× · P {fmtG(row.protein)} · C {fmtG(row.carbs)} · F {fmtG(row.fat)}
                  </div>
                </div>
                <div className="kcal">{fmtCal(row.calories)}</div>
                <button
                  className={`icon-btn${removingId === row.id ? ' is-busy' : ''}`}
                  aria-label={`Remove ${row.name}`}
                  disabled={Boolean(removingId)}
                  onClick={() => runRemove(row.id, () => removeLog(date, row.id))}
                >
                  {removingId === row.id ? <Spinner size={12} /> : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}
      </OfflineEmpty>

      {sheet === 'manual' ? (
        <Sheet
          title="Log food"
          onClose={() => !manualBusy && setSheet(null)}
          footer={
            <>
              {error ? <p className="warn">{error}</p> : null}
              <BusyButton className="primary full" busy={manualBusy} busyLabel="Adding…" onClick={logManual}>
                Add to today
              </BusyButton>
            </>
          }
        >
          <p className="sub">Macros are per serving, then multiplied. Calories come from the macros.</p>
          <FoodFields value={form} onChange={setForm} showServings />
        </Sheet>
      ) : null}

      {sheet === 'pantry' ? (
        <Sheet
          title="Choose from pantry"
          onClose={() => !pantryBusy && setSheet(null)}
          footer={
            pantry.length > 0 ? (
              <BusyButton
                className="primary full"
                busy={pantryBusy}
                busyLabel="Adding…"
                disabled={pantryCount === 0}
                onClick={logPantrySelection}
              >
                {pantryCount === 0
                  ? 'Select foods to log'
                  : `Add ${pantryCount} to today's diary`}
              </BusyButton>
            ) : null
          }
        >
          {pantry.length === 0 ? (
            <p className="empty">Save foods under Foods first, then they show up here.</p>
          ) : (
            <div className="list pantry-picker">
              {pantry.map((food) => {
                const picked = Object.hasOwn(pantrySelection, food.id)
                return (
                  <div key={food.id} className={`row${picked ? ' selected' : ''}`}>
                    <button
                      className="pantry-choice grow"
                      onClick={() => togglePantryFood(food)}
                      aria-pressed={picked}
                      disabled={pantryBusy}
                    >
                      <span className="check-mark">{picked ? '✓' : ''}</span>
                      <span className="grow">
                        <span className="name">{food.name}</span>
                        <span className="meta">{food.servingLabel || '1 serving'} · {fmtCal(food.calories)} kcal</span>
                      </span>
                    </button>
                    {picked ? (
                      <div className="quantity-stepper">
                        <button
                          aria-label={`Less ${food.name}`}
                          disabled={pantryBusy || cleanQuantity(pantrySelection[food.id]) <= MIN_SERVINGS}
                          onClick={() => stepPantryQuantity(food.id, -SERVING_STEP)}
                        >
                          −
                        </button>
                        <input
                          inputMode="decimal"
                          aria-label={`Servings of ${food.name}`}
                          value={pantrySelection[food.id]}
                          disabled={pantryBusy}
                          onChange={(event) => setPantryQuantity(food.id, event.target.value)}
                          onBlur={() => commitPantryQuantity(food.id)}
                        />
                        <button
                          aria-label={`More ${food.name}`}
                          disabled={pantryBusy}
                          onClick={() => stepPantryQuantity(food.id, SERVING_STEP)}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </Sheet>
      ) : null}
    </div>
  )
}
