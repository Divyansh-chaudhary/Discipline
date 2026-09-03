export const DEFAULT_TARGETS = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70,
}

export function totalsFromLogs(logs) {
  return (logs ?? []).reduce(
    (acc, row) => ({
      calories: acc.calories + (Number(row.calories) || 0),
      protein: acc.protein + (Number(row.protein) || 0),
      carbs: acc.carbs + (Number(row.carbs) || 0),
      fat: acc.fat + (Number(row.fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}
