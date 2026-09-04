import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BusyButton, Spinner } from '../components/BusyButton.jsx'
import { FoodFields, emptyFood, parseFoodFields } from '../components/FoodFields.jsx'
import { MacroBars, RemainingHero } from '../components/MacroBars.jsx'
import { TodayPathCard } from '../components/PulseCard.jsx'
import { Sheet } from '../components/Sheet.jsx'
import { OfflineEmpty, PageHead } from '../components/SyncChip.jsx'
import { totalsFromLogs } from '../db/index.js'
import { useBusy, useBusyKey } from '../lib/busy.js'
import { formatPrettyDate, localDateKey } from '../lib/dates.js'
import { calorieStarBand, pulseFromState } from '../lib/discipline.js'
import { fmtCal, macroSummary, round0, round1 } from '../lib/format.js'
import { lastNDates, weekReview } from '../lib/week.js'
import { exerciseLine, sessionSummary } from '../lib/workouts.js'
import { useData, useDateRange, useDay } from '../sync/DataContext.jsx'

const MIN_QUANTITY = 0.01

function WeekBalanceCard({ today, targets }) {
  const dates = useMemo(() => lastNDates(today, 7), [today])
  const { rows, loading } = useDateRange(dates)
  const review = weekReview({ rows, targets, today })
  const { average, allowance, loggedDays, trackedBefore } = review
  const spentToday = review.dayRows.find((row) => row.date === today)?.totals.calories || 0
  const leftToday = round0(allowance.calories - spentToday)

  return (
    <section className="card week-balance">
      <div className="page-head-row">
        <div>
          <p className="tiny">7-day average</p>
          <p className="path-count">
            {loading && !loggedDays ? '—' : `${fmtCal(average.calories)} kcal`}
          </p>
        </div>
        <Link className="chip" to="/history?view=week">
          Balance ›
        </Link>
      </div>
      <p className="tiny" style={{ marginTop: 8 }}>
        {trackedBefore === 0
          ? `Target ${fmtCal(targets.calories)} kcal a day.`
          : leftToday >= 0
            ? `${leftToday} kcal left today to even out the week.`
            : `${Math.abs(leftToday)} kcal over the evened-out budget for today.`}
      </p>
    </section>
  )
}

function cleanQuantity(value, delta = 0) {
  return round1(Math.max(MIN_QUANTITY, (Number(value) || MIN_QUANTITY) + delta))
}

function referenceQuantity(food) {
  if (food.referenceQuantity != null) return Math.max(MIN_QUANTITY, Number(food.referenceQuantity) || 1)
  const match = String(food.servingLabel || '').match(/^\s*(\d+(?:\.\d+)?)\s*(.+?)\s*$/)
  return Math.max(MIN_QUANTITY, Number(match?.[1]) || 1)
}

function referenceUnit(food) {
  if (food.referenceUnit) return food.referenceUnit
  const match = String(food.servingLabel || '').match(/^\s*\d+(?:\.\d+)?\s*(.+?)\s*$/)
  return match?.[1] || 'serving'
}

function quantityStep(food) {
  return referenceQuantity(food) >= 10 ? 10 : 1
}

function pantryTotals(food, quantity) {
  const multiplier = cleanQuantity(quantity) / referenceQuantity(food)
  return {
    calories: round1((food.calories || 0) * multiplier),
    protein: round1((food.protein || 0) * multiplier),
    carbs: round1((food.carbs || 0) * multiplier),
    fat: round1((food.fat || 0) * multiplier),
  }
}

export function Today() {
  const date = localDateKey()
  const { settings, customFoods, discipline, addLog, addLogs, removeLog } = useData()
  const { logs, sets, workout, loaded, unavailable } = useDay(date)
  const pantry = customFoods
  const totals = totalsFromLogs(logs)
  const pulse = pulseFromState({ logs, totals, targets: settings, setCount: sets.length })
  const starBand = calorieStarBand(settings.calories)

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
      else next[food.id] = String(referenceQuantity(food))
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
      const items = pantry
        .filter((food) => Object.hasOwn(pantrySelection, food.id))
        .map((food) => {
          const quantity = cleanQuantity(pantrySelection[food.id])
          const multiplier = quantity / referenceQuantity(food)
          return {
            name: food.name,
            servings: multiplier,
            quantity,
            quantityUnit: referenceUnit(food),
            ...pantryTotals(food, quantity),
            source: 'custom',
            customFoodId: food.id,
          }
        })
      await addLogs(date, items)
      setSheet(null)
    })

  return (
    <div className="page with-action-bar">
      <PageHead kicker="Today" title={formatPrettyDate(date)} compact />

      <section className="card">
        <RemainingHero totals={totals} targets={settings} />
        <MacroBars totals={totals} targets={settings} includeCalories={false} />
        <p className="tiny" style={{ marginTop: 12 }}>
          Calorie star zone {starBand.low}–{starBand.high} kcal
          {pulse.calories ? ' · earned' : ''}
        </p>
      </section>

      <WeekBalanceCard today={date} targets={settings} />

      <SessionSummaryCard sets={sets} workout={workout} />

      <TodayPathCard pulse={pulse} xp={discipline.profile?.totalXp || 0} streaks={discipline.streaks} />

      <div className="section-title">
        <h2>Diary</h2>
        <span className="tiny">{logs.length} item{logs.length === 1 ? '' : 's'}</span>
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
                  <div className="name">
                    {row.name}
                    {row.quantity != null ? <span className="tiny"> · {row.quantity} {row.quantityUnit || 'serving'}</span> : row.servings > 1 ? <span className="tiny"> ×{row.servings}</span> : null}
                  </div>
                  <div className="meta">{macroSummary(row)}</div>
                </div>
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
                        <span className="meta">Per {referenceQuantity(food)} {referenceUnit(food)} · {fmtCal(food.calories)} kcal</span>
                        {picked ? <span className="tiny">{macroSummary(pantryTotals(food, pantrySelection[food.id]))}</span> : null}
                      </span>
                    </button>
                    {picked ? (
                      <div className="quantity-stepper">
                        <button
                          aria-label={`Less ${food.name}`}
                          disabled={pantryBusy || cleanQuantity(pantrySelection[food.id]) <= MIN_QUANTITY}
                          onClick={() => stepPantryQuantity(food.id, -quantityStep(food))}
                        >
                          −
                        </button>
                        <input
                          inputMode="decimal"
                          aria-label={`Quantity of ${food.name} in ${referenceUnit(food)}`}
                          value={pantrySelection[food.id]}
                          disabled={pantryBusy}
                          onChange={(event) => setPantryQuantity(food.id, event.target.value)}
                          onBlur={() => commitPantryQuantity(food.id)}
                        />
                        <button
                          aria-label={`More ${food.name}`}
                          disabled={pantryBusy}
                          onClick={() => stepPantryQuantity(food.id, quantityStep(food))}
                        >
                          +
                        </button>
                        <span className="quantity-unit">{referenceUnit(food)}</span>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </Sheet>
      ) : null}

      <div className="action-bar">
        <div className="action-bar-inner">
          <button className="primary" onClick={openManual}>
            Log food
          </button>
          <button className="secondary" onClick={openPantry}>
            From pantry
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionSummaryCard({ sets, workout }) {
  const { groups, exercises, setCount, volume } = sessionSummary(sets)
  const done = Boolean(workout?.completedAt)

  return (
    <section className="card" style={{ marginTop: 12 }}>
      <div className="page-head-row">
        <div>
          <p className="tiny">Today’s training</p>
          <p className="path-count">{workout?.name || 'No session'}</p>
        </div>
        <Link className="chip" to="/workout">
          {setCount ? 'Open' : 'Start'} ›
        </Link>
      </div>

      {setCount === 0 ? (
        <p className="sub" style={{ marginTop: 8 }}>
          Nothing logged yet today.
        </p>
      ) : (
        <>
          {done ? (
            <p className="tiny" style={{ marginTop: 6 }}>
              Completed
            </p>
          ) : null}
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
        </>
      )}
    </section>
  )
}
