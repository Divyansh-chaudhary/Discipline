export function Spinner({ size = 16, label = 'Loading' }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  )
}

/**
 * Primary/secondary button that shows a spinner and disables while busy.
 * Keeps existing class names (primary, secondary, full, etc.).
 */
export function BusyButton({
  busy = false,
  busyLabel,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`busy-btn ${className}${busy ? ' is-busy' : ''}`.trim()}
      disabled={Boolean(disabled || busy)}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <>
          <Spinner size={14} />
          <span>{busyLabel || children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
