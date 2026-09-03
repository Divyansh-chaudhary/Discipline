import { Link } from 'react-router-dom'
import { useData } from '../sync/DataContext.jsx'

export function SyncChip() {
  const { syncLabel, online } = useData()
  const offline = !online || syncLabel.startsWith('Offline')
  const busy = syncLabel.startsWith('Syncing')
  return (
    <span className={`chip${offline ? ' offline' : ''}${busy ? ' syncing' : ''}`}>
      {syncLabel}
    </span>
  )
}

export function PageHead({ kicker, title, sub, extra, compact = false, back }) {
  return (
    <header className={`page-head${compact ? ' compact' : ''}`}>
      <div className="page-head-main">
        {back ? (
          <Link className="back-link" to={back.to}>
            ‹ {back.label}
          </Link>
        ) : null}
        {kicker ? <div className="kicker">{kicker}</div> : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      <div className="page-head-aside">
        <SyncChip />
        {extra}
      </div>
    </header>
  )
}

export function OfflineEmpty({ loaded, children }) {
  const { online, queued } = useData()
  if (loaded || online) return children
  return (
    <div className="empty card">
      Offline — pending {queued} action{queued === 1 ? '' : 's'}. You can still add new entries; they queue until you are back online.
    </div>
  )
}
