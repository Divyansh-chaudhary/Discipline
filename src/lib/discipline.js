export const STAR_XP = 10
export const STREAK_XP = 15
export const PERFECT_XP = 20

export const PULSE_KEYS = ['food', 'lift', 'protein', 'calories']

export const PULSE_META = {
  food: { label: 'Food', hint: 'Log at least one food' },
  lift: { label: 'Lift', hint: 'Complete at least one set' },
  protein: { label: 'Protein', hint: 'Hit your protein target' },
  calories: { label: 'Cals', hint: 'Stay within ±10% of calories' },
}

export const STREAK_IDS = ['food', 'lift', 'discipline']

export const STREAK_META = {
  food: { label: 'Food', hint: 'Days with a food log' },
  lift: { label: 'Lift', hint: 'Days with a workout set' },
  discipline: { label: 'Show-up', hint: 'Days with both food and lift' },
}

export const BADGE_CATALOG = [
  { id: 'first-log', name: 'First log', hint: 'Log any food' },
  { id: 'first-lift', name: 'First lift', hint: 'Log a workout set' },
  { id: 'discipline-3', name: '3-day show-up', hint: 'Food + lift, 3 days in a row' },
  { id: 'discipline-7', name: 'Week of iron', hint: '7-day discipline streak' },
  { id: 'discipline-21', name: '21 days', hint: 'Three weeks of showing up' },
  { id: 'discipline-30', name: '30-day path', hint: 'A month of food + lift' },
  { id: 'discipline-90', name: 'Quarter', hint: '90-day discipline streak' },
  { id: 'meals-10', name: '10 meals', hint: 'Log 10 foods' },
  { id: 'meals-50', name: '50 meals', hint: 'Log 50 foods' },
  { id: 'meals-100', name: '100 meals', hint: 'Log 100 foods' },
  { id: 'sessions-10', name: '10 sessions', hint: 'Lift on 10 days' },
  { id: 'sessions-50', name: '50 sessions', hint: 'Lift on 50 days' },
  { id: 'sessions-100', name: '100 sessions', hint: 'Lift on 100 days' },
  { id: 'protein-7', name: 'Protein week', hint: 'Hit protein on 7 days, any time' },
  { id: 'protein-7-streak', name: 'Protein lock', hint: 'Hit protein 7 days in a row' },
  { id: 'perfect-day', name: 'Perfect day', hint: 'Earn all four daily stars' },
]

export function emptyPulse() {
  return { food: false, lift: false, protein: false, calories: false }
}

export function pulseFromState({ logs, totals, targets, setCount }) {
  const food = (logs?.length || 0) >= 1
  const lift = (setCount || 0) >= 1
  const proteinTarget = Number(targets?.protein) || 0
  const calorieTarget = Number(targets?.calories) || 0
  const protein = food && proteinTarget > 0 && (Number(totals?.protein) || 0) >= proteinTarget
  const band = calorieTarget * 0.1
  const calories =
    food && calorieTarget > 0 && Math.abs((Number(totals?.calories) || 0) - calorieTarget) <= band
  return { food, lift, protein, calories }
}

/** The window that earns the calorie star: target ±10%, over or under. */
export function calorieStarBand(target) {
  const value = Number(target) || 0
  return { low: Math.round(value * 0.9), high: Math.round(value * 1.1) }
}

export function earnedStarCount(pulse) {
  return PULSE_KEYS.filter((key) => pulse?.[key]).length
}

export function levelFromXp(xp) {
  const n = Math.max(0, Number(xp) || 0)
  return Math.floor(Math.sqrt(n / 50)) + 1
}

export function xpAtLevel(level) {
  const l = Math.max(1, Number(level) || 1)
  return 50 * (l - 1) ** 2
}

export function levelProgress(xp) {
  const totalXp = Math.max(0, Number(xp) || 0)
  const level = levelFromXp(totalXp)
  const start = xpAtLevel(level)
  const next = xpAtLevel(level + 1)
  const span = Math.max(1, next - start)
  return {
    level,
    totalXp,
    start,
    next,
    into: totalXp - start,
    span,
    pct: Math.min(100, ((totalXp - start) / span) * 100),
  }
}
