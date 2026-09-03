import { Link } from 'react-router-dom'
import {
  PULSE_KEYS,
  PULSE_META,
  STREAK_IDS,
  STREAK_META,
  earnedStarCount,
  emptyPulse,
  levelProgress,
} from '../lib/discipline.js'

export function PulseStars({ pulse, size = 'md' }) {
  const stars = pulse || emptyPulse()
  return (
    <div className={`pulse-stars ${size}`} role="list" aria-label="Today's stars">
      {PULSE_KEYS.map((key) => (
        <div
          key={key}
          className={`pulse-star${stars[key] ? ' on' : ''}`}
          role="listitem"
          title={PULSE_META[key].hint}
        >
          <StarIcon filled={stars[key]} />
          <span>{PULSE_META[key].label}</span>
        </div>
      ))}
    </div>
  )
}

export function LevelBar({ xp }) {
  const progress = levelProgress(xp)
  return (
    <div className="level-bar">
      <div className="level-bar-top">
        <strong>Level {progress.level}</strong>
        <span className="tiny">
          {progress.into} / {progress.span} XP
        </span>
      </div>
      <div className="bar xp">
        <i style={{ width: `${progress.pct}%` }} />
      </div>
    </div>
  )
}

export function StreakChips({ streaks }) {
  const rows = STREAK_IDS.map((id) => {
    const found = (streaks || []).find((row) => row.id === id)
    return {
      id,
      current: found?.current || 0,
      best: found?.best || 0,
    }
  })
  return (
    <div className="streak-chips">
      {rows.map((row) => (
        <div className="streak-chip" key={row.id}>
          <span className="tiny">{STREAK_META[row.id].label}</span>
          <strong>{row.current}</strong>
          <span className="tiny">best {row.best}</span>
        </div>
      ))}
    </div>
  )
}

export function TodayPathCard({ pulse, xp, streaks }) {
  const stars = pulse || emptyPulse()
  const earned = earnedStarCount(stars)
  return (
    <section className="card path-card">
      <div className="path-card-head">
        <div>
          <p className="tiny">Daily pulse</p>
          <p className="path-count">
            {earned} of {PULSE_KEYS.length} stars
          </p>
        </div>
        <Link to="/path" className="chip path-link">
          Path
        </Link>
      </div>
      <PulseStars pulse={stars} />
      <LevelBar xp={xp} />
      <StreakChips streaks={streaks} />
    </section>
  )
}

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.4 14.4 9l6.1.5-4.7 3.9 1.5 5.9L12 16.6 6.7 19.3l1.5-5.9L3.5 9.5 9.6 9 12 3.4Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
