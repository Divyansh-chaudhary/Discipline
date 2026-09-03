import { fmtCal, fmtG, round0 } from '../lib/format.js'

const ROWS = [
  { key: 'calories', label: 'Cal', cls: 'cal', fmt: fmtCal, unit: '' },
  { key: 'protein', label: 'Pro', cls: 'protein', fmt: fmtG, unit: 'g' },
  { key: 'carbs', label: 'Carb', cls: 'carbs', fmt: fmtG, unit: 'g' },
  { key: 'fat', label: 'Fat', cls: 'fat', fmt: fmtG, unit: 'g' },
]

export function MacroBars({ totals, targets, includeCalories = true }) {
  const rows = includeCalories ? ROWS : ROWS.filter((row) => row.key !== 'calories')
  return (
    <div className="macros">
      {rows.map((row) => {
        const used = Number(totals[row.key]) || 0
        const target = Number(targets[row.key]) || 0
        const pct = target > 0 ? Math.min(140, (used / target) * 100) : 0
        return (
          <div className="macro-row" key={row.key}>
            <div className="label">{row.label}</div>
            <div className={`bar ${row.cls}`}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="nums">
              {row.fmt(used)}
              {row.unit}/{row.fmt(target)}
              {row.unit}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RemainingHero({ totals, targets }) {
  const left = round0((targets.calories || 0) - (totals.calories || 0))
  const over = left < 0
  return (
    <div className={`hero-cal${over ? ' over' : ''}`}>
      <strong>{over ? Math.abs(left) : left}</strong>
      <span>{over ? 'kcal over' : 'kcal left'}</span>
    </div>
  )
}
