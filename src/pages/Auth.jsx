import { useState } from 'react'
import { BusyButton } from '../components/BusyButton.jsx'
import { useBusy } from '../lib/busy.js'
import { useData } from '../sync/DataContext.jsx'

function friendlyError(err) {
  const raw = String(err?.message || '')
  if (/NOT_FOUND|could not be found/i.test(raw) || err?.status === 404) {
    return 'Sign-in is unavailable right now. Try again in a minute.'
  }
  if (err?.status === 503) {
    return 'Service is waking up. Wait a moment and try again.'
  }
  return raw || 'Could not sign in'
}

export function AuthScreen() {
  const { login, register, online } = useData()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, runBusy] = useBusy()

  const submit = (e) => {
    e.preventDefault()
    setError('')
    runBusy(async () => {
      try {
        if (mode === 'register') await register(email, password)
        else await login(email, password)
      } catch (err) {
        setError(friendlyError(err))
      }
    })
  }

  return (
    <div className="page auth-page">
      <div className="auth-panel">
        <header className="auth-head">
          <div className="kicker">Discipline</div>
          <h1>{mode === 'register' ? 'Create account' : 'Sign in'}</h1>
          <p className="sub">Sign in to sync your diary across devices. Offline edits wait until you are back online.</p>
        </header>

        {!online ? (
          <p className="search-note">You need a connection to sign in. Come back online, then try again.</p>
        ) : null}

        <form className="card stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Password</label>
            <input
              id="auth-pass"
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          {error ? <p className="warn">{error}</p> : null}
          <BusyButton
            className="primary full"
            type="submit"
            busy={busy}
            busyLabel={mode === 'register' ? 'Creating…' : 'Signing in…'}
            disabled={!online}
          >
            {mode === 'register' ? 'Register' : 'Sign in'}
          </BusyButton>
          <button
            className="secondary full"
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register')
              setError('')
            }}
          >
            {mode === 'register' ? 'Already have an account' : 'Create an account'}
          </button>
        </form>
      </div>
    </div>
  )
}
