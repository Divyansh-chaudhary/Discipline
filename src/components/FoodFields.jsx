import { formatDerivedCalories } from '../lib/format.js'

export const emptyFood = {
  name: '',
  servingLabel: '1 serving',
  servings: '1',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
}

export function FoodFields({ value, onChange, showServings = false }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })

  const setMacro = (key) => (e) => {
    const next = { ...value, [key]: e.target.value }
    next.calories = formatDerivedCalories(next.protein, next.carbs, next.fat)
    onChange(next)
  }

  return (
    <>
      <div className="field">
        <label htmlFor="food-name">Name</label>
        <input
          id="food-name"
          value={value.name}
          onChange={set('name')}
          placeholder="Oats with milk"
          autoComplete="off"
        />
      </div>
      <div className={showServings ? 'grid-2' : undefined}>
        <div className="field">
          <label htmlFor="food-serving">Serving</label>
          <input
            id="food-serving"
            value={value.servingLabel}
            onChange={set('servingLabel')}
            placeholder="100 g"
          />
        </div>
        {showServings ? (
          <div className="field">
            <label htmlFor="food-servings">How many</label>
            <input
              id="food-servings"
              inputMode="decimal"
              value={value.servings}
              onChange={set('servings')}
            />
          </div>
        ) : null}
      </div>
      <div className="grid-4">
        <NumField
          id="food-cal"
          label="Cal"
          value={formatDerivedCalories(value.protein, value.carbs, value.fat)}
          readOnly
        />
        <NumField id="food-p" label="P" value={value.protein} onChange={setMacro('protein')} />
        <NumField id="food-c" label="C" value={value.carbs} onChange={setMacro('carbs')} />
        <NumField id="food-f" label="F" value={value.fat} onChange={setMacro('fat')} />
      </div>
      <p className="tiny">Calories stay locked to protein×4 + carbs×4 + fat×9.</p>
    </>
  )
}

function NumField({ id, label, value, onChange, readOnly = false }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        title={readOnly ? 'Calculated from protein, carbs, and fat' : undefined}
      />
    </div>
  )
}

export function parseFoodFields(value, { deriveCalories = false } = {}) {
  const servings = Math.max(0, Number(value.servings) || 1)
  const protein = Number(value.protein) || 0
  const carbs = Number(value.carbs) || 0
  const fat = Number(value.fat) || 0
  return {
    name: value.name.trim(),
    servingLabel: (value.servingLabel || '1 serving').trim(),
    servings,
    calories: deriveCalories
      ? Number(formatDerivedCalories(protein, carbs, fat) || 0)
      : Number(value.calories) || 0,
    protein,
    carbs,
    fat,
  }
}
