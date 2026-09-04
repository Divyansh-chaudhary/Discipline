import {
  BADGE_CATALOG,
  DEFAULT_TARGETS,
  PULSE_KEYS,
  STAR_XP,
  STREAK_IDS,
  STREAK_XP,
  PERFECT_XP,
  earnedStarCount,
  pulseFromState,
} from './disciplineShared.js'
import { bestConsecutive, shiftDateKey, streakEndingOn, uniqueSortedDates } from './dates.js'
import { Badge, FoodLog, Profile, PulseDay, Settings, Streak, Workout, WorkoutSet } from './models.js'
import { toClient, toClientList } from './json.js'

function totalsFromLogs(logs) {
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

function streakFromDates(id, dates, today) {
  const sorted = uniqueSortedDates(dates)
  const live = streakEndingOn(sorted, today)
  const yesterday = streakEndingOn(sorted, shiftDateKey(today, -1))
  return {
    id,
    lastActiveDate: live.lastActiveDate,
    current: live.current > 0 ? live.current : yesterday.current,
    best: bestConsecutive(sorted),
  }
}

/** Two queries instead of one per workout, which used to dominate every mutation. */
async function liftDates(userId) {
  const workoutIds = await WorkoutSet.distinct('workoutId', { userId })
  if (!workoutIds.length) return []
  const workouts = await Workout.find({ userId, _id: { $in: workoutIds } })
    .select('date')
    .lean()
  return uniqueSortedDates(workouts.map((workout) => workout.date))
}

function proteinHitDates(logs, targets) {
  const proteinTarget = Number(targets?.protein) || 0
  if (proteinTarget <= 0) return []
  const byDate = new Map()
  for (const row of logs) {
    const list = byDate.get(row.date) || []
    list.push(row)
    byDate.set(row.date, list)
  }
  const hits = []
  for (const [date, rows] of byDate) {
    if (totalsFromLogs(rows).protein >= proteinTarget) hits.push(date)
  }
  return uniqueSortedDates(hits)
}

function badgeStats({ mealCount, sessionCount, disciplineBest, proteinDays, proteinBest, perfectDays }) {
  return {
    'first-log': mealCount >= 1,
    'first-lift': sessionCount >= 1,
    'discipline-3': disciplineBest >= 3,
    'discipline-7': disciplineBest >= 7,
    'discipline-21': disciplineBest >= 21,
    'discipline-30': disciplineBest >= 30,
    'discipline-90': disciplineBest >= 90,
    'meals-10': mealCount >= 10,
    'meals-50': mealCount >= 50,
    'meals-100': mealCount >= 100,
    'sessions-10': sessionCount >= 10,
    'sessions-50': sessionCount >= 50,
    'sessions-100': sessionCount >= 100,
    'protein-7': proteinDays >= 7,
    'protein-7-streak': proteinBest >= 7,
    'perfect-day': perfectDays >= 1,
  }
}

async function awardXp(userId, today, pulse, nextStreaks, prevStreaks) {
  const existing = (await PulseDay.findOne({ userId, date: today }).lean()) || { date: today }
  const starXp = { ...(existing.starXp || {}) }
  const streakXp = { ...(existing.streakXp || {}) }
  let gained = 0

  for (const key of PULSE_KEYS) {
    if (pulse[key] && !starXp[key]) {
      starXp[key] = true
      gained += STAR_XP
    }
  }

  for (const id of STREAK_IDS) {
    const next = nextStreaks.find((row) => row.id === id)
    const prev = prevStreaks.find((row) => row.id === id)
    const extendedToday =
      next?.lastActiveDate === today && next.current > 0 && next.current > (prev?.current || 0)
    if (extendedToday && !streakXp[id]) {
      streakXp[id] = true
      gained += STREAK_XP
    }
  }

  const perfect = earnedStarCount(pulse) === PULSE_KEYS.length
  let perfectXp = Boolean(existing.perfectXp)
  if (perfect && !perfectXp) {
    perfectXp = true
    gained += PERFECT_XP
  }

  await PulseDay.findOneAndUpdate(
    { userId, date: today },
    {
      userId,
      date: today,
      ...pulse,
      starXp,
      streakXp,
      perfectXp,
    },
    { upsert: true },
  )

  if (gained > 0) {
    await Profile.findOneAndUpdate(
      { userId },
      { $inc: { totalXp: gained }, $setOnInsert: { key: 'xp' } },
      { upsert: true },
    )
  }
}

async function unlockBadges(userId, stats) {
  const earned = badgeStats(stats)
  const now = Date.now()
  const writes = []
  for (const badge of BADGE_CATALOG) {
    if (!earned[badge.id]) continue
    writes.push({
      updateOne: {
        filter: { userId, id: badge.id },
        update: { $setOnInsert: { userId, id: badge.id, unlockedAt: now } },
        upsert: true,
      },
    })
  }
  if (writes.length) await Badge.bulkWrite(writes)
}

export async function syncDiscipline(userId, today) {
  const [settingsRow, logs, sessionDates, workout, prevStreaks] = await Promise.all([
    Settings.findOne({ userId }).lean(),
    FoodLog.find({ userId }).select('date calories protein carbs fat').lean(),
    liftDates(userId),
    Workout.findOne({ userId, date: today }).select('_id').lean(),
    Streak.find({ userId, id: { $in: STREAK_IDS } }).lean(),
  ])
  const settings = settingsRow || DEFAULT_TARGETS
  const todayLogs = logs.filter((row) => row.date === today)
  const totals = totalsFromLogs(todayLogs)
  const foodDates = uniqueSortedDates(logs.map((row) => row.date))
  const sessionSet = new Set(sessionDates)
  const disciplineDates = foodDates.filter((date) => sessionSet.has(date))
  const proteinDates = proteinHitDates(logs, settings)

  const setCount = workout
    ? await WorkoutSet.countDocuments({ userId, workoutId: workout._id })
    : 0
  const pulse = pulseFromState({ logs: todayLogs, totals, targets: settings, setCount })

  const nextStreaks = [
    streakFromDates('food', foodDates, today),
    streakFromDates('lift', sessionDates, today),
    streakFromDates('discipline', disciplineDates, today),
  ]

  await Profile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, key: 'xp', totalXp: 0 } },
    { upsert: true },
  )

  await Streak.bulkWrite(
    nextStreaks.map((row) => ({
      updateOne: {
        filter: { userId, id: row.id },
        update: { $set: { ...row, userId } },
        upsert: true,
      },
    })),
  )

  await awardXp(userId, today, pulse, nextStreaks, prevStreaks)

  const perfectDays = await PulseDay.countDocuments({
    userId,
    $or: [{ perfectXp: true }, { food: true, lift: true, protein: true, calories: true }],
  })
  const proteinStreak = streakFromDates('protein', proteinDates, today)
  await unlockBadges(userId, {
    mealCount: logs.length,
    sessionCount: sessionDates.length,
    disciplineBest: nextStreaks.find((row) => row.id === 'discipline')?.best || 0,
    proteinDays: proteinDates.length,
    proteinBest: proteinStreak.best,
    perfectDays,
  })

  return loadDiscipline(userId)
}

export async function loadDiscipline(userId) {
  const [profile, streaks, badges] = await Promise.all([
    Profile.findOne({ userId }).lean(),
    Streak.find({ userId }).lean(),
    Badge.find({ userId }).lean(),
  ])
  return {
    profile: profile
      ? { key: profile.key || 'xp', totalXp: Number(profile.totalXp) || 0 }
      : { key: 'xp', totalXp: 0 },
    streaks: toClientList(streaks).map((row) => ({
      id: row.id,
      lastActiveDate: row.lastActiveDate || null,
      current: row.current || 0,
      best: row.best || 0,
    })),
    badges: toClientList(badges).map((row) => ({
      id: row.id,
      unlockedAt: row.unlockedAt,
    })),
  }
}

export { toClient }
