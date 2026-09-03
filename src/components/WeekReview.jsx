import { MacroBars } from './MacroBars.jsx'
import { fmtCal, fmtG, round0 } from '../lib/format.js'
import { formatShortDate } from '../lib/dates.js'
import { weekReview } from '../lib/week.js'

function Delta({ value, unit = '' }) {
  const rounded = round0(value)
  if (rounded === 0) return <span className="delta level">on target</span>
  const over = rounded > 0
  return (
    <span className={`delta ${over ? 'over' : 'under'}`}>
      {over ? '+' : '−'}
      {Math.abs(rounded)}
      {unit}
    </span>
  )
}

export function WeekReview({ rows, targets, today, onPickDate }) {
  const review = weekReview({ rows, targets, today })
  const { average, allowance, balance, dayRows, loggedDays, trackedBefore } = review
  const allowanceCalories = round0(allowance.calories)
  const spentToday = dayRows.find((row) => row.date === today)?.totals.calories || 0
  const leftToday = round0(allowanceCalories - spentToday)

  return (
    <>
      <section className="card">
        <div className="page-head-row">
          <div>
            <p className="tiny">7-day average</p>
            <p className="hero-cal">
              <strong>{fmtCal(average.calories)}</strong>
              <span>kcal / day</span>
            </p>
          </div>
          <Delta value={balance.calories} />
        </div>
        <p className="tiny" style={{ marginTop: 6 }}>
          {loggedDays === 0
            ? 'Nothing logged in this window yet.'
            : `Across ${loggedDays} tracked day${loggedDays === 1 ? '' : 's'} · target ${fmtCal(targets.calories)} kcal`}
        </p>
        <MacroBars totals={average} targets={targets} includeCalories={false} />
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <p className="tiny">To even out the average, today allows</p>
        <p className="hero-cal">
          <strong>{allowanceCalories}</strong>
          <span>kcal</span>
        </p>
        <p className="sub" style={{ marginTop: 6 }}>
          {trackedBefore === 0
            ? 'No earlier days tracked in this window, so this is just your daily target.'
            : leftToday >= 0
              ? `${leftToday} kcal still free today after what you have logged.`
              : `You are ${Math.abs(leftToday)} kcal past that budget today.`}
        </p>
        <div className="macro-strip">
          <span>P {fmtG(allowance.protein)}</span>
          <span>C {fmtG(allowance.carbs)}</span>
          <span>F {fmtG(allowance.fat)}</span>
        </div>
      </section>

      <div className="section-title">
        <h2>Day by day</h2>
        <span className="tiny">vs {fmtCal(targets.calories)} kcal</span>
      </div>

      <div className="list">
        {[...dayRows].reverse().map((row) => (
          <button
            key={row.date}
            className={`row week-day${row.date === today ? ' selected' : ''}`}
            onClick={() => onPickDate?.(row.date)}
          >
            <span className="grow">
              <span className="name">
                {formatShortDate(row.date)}
                {row.date === today ? <span className="chip inline-chip">Today</span> : null}
              </span>
              <span className="meta">
                {row.logged
                  ? `P ${fmtG(row.totals.protein)} · C ${fmtG(row.totals.carbs)} · F ${fmtG(row.totals.fat)}`
                  : 'Nothing logged'}
                {row.lifted ? ' · lifted' : ''}
              </span>
            </span>
            <span className="week-day-right">
              <span className="kcal">{fmtCal(row.totals.calories)}</span>
              {row.logged ? <Delta value={row.totals.calories - (Number(targets.calories) || 0)} /> : null}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
