import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Today', icon: PlateIcon },
  { to: '/foods', label: 'Foods', icon: JarIcon },
  { to: '/workout', label: 'Lift', icon: BarIcon },
  { to: '/history', label: 'Log', icon: BookIcon },
  { to: '/path', label: 'Path', icon: StarIcon },
  { to: '/settings', label: 'Setup', icon: DialIcon },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function PlateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.2" />
    </svg>
  )
}

function JarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="7" y="8" width="10" height="11" rx="2" />
      <path d="M9 8V6h6v2M9 12h6" />
    </svg>
  )
}

function BarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12h16M7 8v8M17 8v8M5 10v4M19 10v4" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 5.5h9.5A2.5 2.5 0 0 1 18 8v11H8.5A2.5 2.5 0 0 0 6 21.5V5.5Z" />
      <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3H18" />
    </svg>
  )
}

function DialIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="13" r="6.5" />
      <path d="M12 13V9.5M9 4h6" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3.6 14.3 9l5.9.5-4.5 3.8 1.4 5.7L12 16.2 7 19l1.4-5.7L3.8 9.5 9.7 9 12 3.6Z" />
    </svg>
  )
}
