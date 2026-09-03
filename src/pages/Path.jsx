import { useState } from 'react'
import { LevelBar, PulseStars, StreakChips } from '../components/PulseCard.jsx'
import { PageHead } from '../components/SyncChip.jsx'
import { totalsFromLogs } from '../db/index.js'
import { localDateKey } from '../lib/dates.js'
import {
  BADGE_CATALOG,
  PULSE_KEYS,
  earnedStarCount,
  emptyPulse,
  levelProgress,
  pulseFromState,
} from '../lib/discipline.js'
import { useData, useDay } from '../sync/DataContext.jsx'

export function Path() {
  const date = localDateKey()
  const { settings, discipline } = useData()
  const { logs, sets } = useDay(date)
  const totals = totalsFromLogs(logs)
  const pulse = pulseFromState({ logs, totals, targets: settings, setCount: sets.length })
  const xp = discipline.profile?.totalXp || 0
  const progress = levelProgress(xp)
  const unlocked = discipline.badges || []
  const unlockedMap = new Map(unlocked.map((row) => [row.id, row]))
  const earned = earnedStarCount(pulse)
  const [showBadges, setShowBadges] = useState(false)

  return (
    <div className="page">
      <PageHead kicker="Discipline" title="Path" sub="Stars reset daily. Streaks and badges follow your account." />

      <section className="card path-hero">
        <p className="tiny">Level</p>
        <div className="path-hero-row">
          <strong>{progress.level}</strong>
          <div>
            <p className="path-count">{xp} XP total</p>
            <p className="tiny">{progress.span - progress.into} XP to level {progress.level + 1}</p>
          </div>
        </div>
        <LevelBar xp={xp} />
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="path-card-head">
          <div>
            <p className="tiny">Today</p>
            <p className="path-count">
              {earned} of {PULSE_KEYS.length} stars
            </p>
          </div>
        </div>
        <PulseStars pulse={pulse || emptyPulse()} />
        <p className="tiny" style={{ marginTop: 10 }}>
          Food · lift · protein target · calorie band (±10%).
        </p>
      </section>

      <div className="section-title">
        <h2>Streaks</h2>
        <span className="tiny">Miss a calendar day and the count resets</span>
      </div>
      <StreakChips streaks={discipline.streaks} />
      <p className="tiny" style={{ marginTop: 8 }}>
        Show-up needs both a food log and a set on the same day. Opening the app does not break a streak.
      </p>

      <div className="section-title">
        <h2>Badges</h2>
        <button
          className="chip"
          aria-expanded={showBadges}
          onClick={() => setShowBadges((open) => !open)}
        >
          {unlocked.length} of {BADGE_CATALOG.length} · {showBadges ? 'Hide' : 'Show'}
        </button>
      </div>
      {showBadges ? (
        <div className="badge-grid">
          {BADGE_CATALOG.map((badge) => {
            const row = unlockedMap.get(badge.id)
            return (
              <article className={`badge-card${row ? ' on' : ''}`} key={badge.id}>
                <div className="badge-mark" aria-hidden="true">
                  {row ? '★' : '☆'}
                </div>
                <div>
                  <h3>{badge.name}</h3>
                  <p>{row ? `Unlocked ${formatUnlocked(row.unlockedAt)}` : badge.hint}</p>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function formatUnlocked(ts) {
  if (!ts) return 'unlocked'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts))
}
