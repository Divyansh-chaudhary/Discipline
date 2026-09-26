import { useRef } from 'react'
import { formatPrettyDate, localDateKey, shiftDateKey } from '../../lib/dates.js'

export function DateNavigator({ date, onChange }) {
  const today = localDateKey()
  const isToday = date === today
  const canGoForward = date < today
  const pickerRef = useRef(null)

  const openPicker = () => {
    const input = pickerRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') input.showPicker()
    else input.focus()
  }

  return (
    <div className="date-nav">
      <button
        type="button"
        className="icon-btn date-nav-btn"
        aria-label="Previous day"
        onClick={() => onChange(shiftDateKey(date, -1))}
      >
        ‹
      </button>
      <div className="date-nav-center">
        <input
          ref={pickerRef}
          type="date"
          className="date-nav-input"
          value={date}
          max={today}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value)
          }}
        />
        <button type="button" className="date-nav-label-btn" onClick={openPicker}>
          <span className="date-nav-label">{formatPrettyDate(date)}</span>
        </button>
        {isToday ? <span className="chip inline-chip">Today</span> : null}
      </div>
      <button
        type="button"
        className="icon-btn date-nav-btn"
        aria-label="Next day"
        disabled={!canGoForward}
        onClick={() => canGoForward && onChange(shiftDateKey(date, 1))}
      >
        ›
      </button>
    </div>
  )
}
