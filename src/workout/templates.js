export const ROUTINE_TEMPLATES = [
  { id: 'ppl', label: 'Push / Pull / Legs', splits: ['Push', 'Pull', 'Legs'] },
  { id: 'upper-lower', label: 'Upper / Lower', splits: ['Upper', 'Lower'] },
  {
    id: 'muscle',
    label: 'Muscle per day',
    splits: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'],
  },
  { id: 'custom', label: 'Custom', splits: [] },
  { id: 'empty', label: 'Start empty', splits: [] },
]

export function buildSplitsFromTemplate(templateId, names = []) {
  const template = ROUTINE_TEMPLATES.find((row) => row.id === templateId)
  const labels = names.length ? names : template?.splits || []
  return labels.map((name) => ({
    id: crypto.randomUUID(),
    name,
    exercises: [],
  }))
}
