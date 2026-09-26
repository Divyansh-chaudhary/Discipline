import { exerciseLine, groupSets } from '../lib/workouts.js'

export function activeRoutine(types = []) {
  return types.find((type) => type.active) || types[0] || null
}

export function findSplit(routine, splitId) {
  return routine?.splits?.find((split) => split.id === splitId) || null
}

export function splitExerciseNames(split) {
  return (split?.exercises || []).map((exercise) => exercise.name).filter(Boolean)
}

export function emptySetRow(seed = {}) {
  return {
    id: seed.id || null,
    weight: seed.weight ?? '',
    reps: seed.reps ?? '',
  }
}

export function buildDraftFromServer(split, serverSets = [], previous = {}) {
  const names = splitExerciseNames(split)
  const grouped = groupSets(serverSets)
  const byName = new Map(grouped.map((group) => [group.exercise.toLowerCase(), group]))

  return names.map((name) => {
    const saved = byName.get(name.toLowerCase())
    if (saved?.sets?.length) {
      return {
        exercise: name,
        sets: saved.sets.map((set) => emptySetRow({ id: set.id, weight: set.weight, reps: set.reps })),
        previous: previous[name]?.headline || null,
      }
    }
    const prior = previous[name]
    const seedSets = prior?.sets?.length
      ? prior.sets.map((set) => emptySetRow({ weight: set.weight, reps: set.reps }))
      : [emptySetRow({ reps: 8, weight: 0 })]
    return {
      exercise: name,
      sets: seedSets,
      previous: prior?.headline || null,
    }
  })
}

export function mergeDraftRows(serverRows, localRows) {
  if (!localRows?.length) return serverRows
  if (!serverRows?.length) return localRows
  const dirty = new Map(localRows.map((row) => [row.exercise.toLowerCase(), row]))
  return serverRows.map((row) => dirty.get(row.exercise.toLowerCase()) || row)
}

export function draftHasInput(exercises = []) {
  return exercises.some((exercise) =>
    exercise.sets.some((set) => Number(set.weight) > 0 || Number(set.reps) > 0),
  )
}

export function unloggedExercises(exercises = []) {
  return exercises.filter(
    (exercise) => !exercise.sets.some((set) => Number(set.reps) > 0 || Number(set.weight) > 0),
  )
}

export function serializeGroups(exercises = []) {
  return exercises.map((exercise) => ({
    exercise: exercise.exercise,
    sets: exercise.sets.map((set, index) => ({
      id: set.id || undefined,
      weight: Number(set.weight) || 0,
      reps: Number(set.reps) || 0,
      setNumber: index + 1,
    })),
  }))
}

export function exerciseSlug(name) {
  return encodeURIComponent(name)
}

export function decodeExerciseSlug(slug) {
  return decodeURIComponent(slug)
}

export function formatLastSession(weight, reps) {
  if (!weight && !reps) return null
  return `${weight}kg × ${reps}`
}

export function sessionHeadline(sets = []) {
  if (!sets.length) return null
  const top = sets[0]
  return exerciseLine(sets) || `${top.weight}kg × ${top.reps}`
}
