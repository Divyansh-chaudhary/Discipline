export function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10
}

export function round0(n) {
  return Math.round(Number(n) || 0)
}

export function fmtCal(n) {
  return `${round0(n)}`
}

export function fmtG(n) {
  const v = Number(n) || 0
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function caloriesFromMacros(protein, carbs, fat) {
  return (Number(protein) || 0) * 4 + (Number(carbs) || 0) * 4 + (Number(fat) || 0) * 9
}

export function formatDerivedCalories(protein, carbs, fat) {
  const blank = [protein, carbs, fat].every((v) => v === '' || v == null)
  if (blank) return ''
  return String(round1(caloriesFromMacros(protein, carbs, fat)))
}
