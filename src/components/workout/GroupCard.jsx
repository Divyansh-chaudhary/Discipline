import { Link } from 'react-router-dom'
import { formatShortDate } from '../../lib/dates.js'

export function GroupCard({ split, lastPerformed }) {
  const count = split.exercises?.length || 0
  const lastLabel = lastPerformed ? formatShortDate(lastPerformed) : 'Not yet'

  return (
    <Link className="group-card card" to={`/workout/group/${split.id}`}>
      <div className="group-card-top">
        <h3>{split.name}</h3>
        <span className="group-card-arrow">→</span>
      </div>
      <p className="group-card-meta">
        {count} exercise{count === 1 ? '' : 's'}
      </p>
      <p className="tiny group-card-last">Last performed: {lastLabel}</p>
    </Link>
  )
}
