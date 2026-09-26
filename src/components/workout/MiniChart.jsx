export function MiniChart({ title, series = [], unit = '' }) {
  if (!series.length) {
    return (
      <section className="mini-chart card">
        <h3>{title}</h3>
        <p className="sub">No data yet</p>
      </section>
    )
  }

  const values = series.map((point) => Number(point.value) || 0)
  const max = Math.max(...values, 1)

  return (
    <section className="mini-chart card">
      <h3>{title}</h3>
      <div className="mini-chart-bars" role="img" aria-label={`${title} progression`}>
        {series.map((point) => {
          const height = Math.max(4, Math.round((Number(point.value) || 0) / max * 100))
          return (
            <div className="mini-chart-bar-wrap" key={point.date} title={`${point.date}: ${point.value}${unit}`}>
              <div className="mini-chart-bar" style={{ height: `${height}%` }} />
              <span className="tiny">{point.date.slice(5)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
