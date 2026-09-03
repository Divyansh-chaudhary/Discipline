import { useState } from 'react'
import { useData } from '../sync/DataContext.jsx'

export function AuthScreen() {
  const { login, register, online } = useData()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'register') await register(email, password)
      else await login(email, password)
    } catch (err) {
      setError(err.message || 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page auth-page">
      <header className="page-head">
        <div>
          <div className="kicker">Discipline</div>
          <h1>{mode === 'register' ? 'Create account' : 'Sign in'}</h1>
          <p className="sub">
            Your diary lives in MongoDB so every device stays in sync. Offline edits queue on this phone.
          </p>
        </div>
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
          />
        </div>
        {error ? <p className="warn">{error}</p> : null}
        <button className="primary full" type="submit" disabled={busy || !online}>
          {busy ? 'Working…' : mode === 'register' ? 'Register' : 'Sign in'}
        </button>
        <button
          className="secondary full"
          type="button"
          onClick={() => {
            setMode(mode === 'register' ? 'login' : 'register')
            setError('')
          }}
        >
          {mode === 'register' ? 'Already have an account' : 'Create an account'}
        </button>
      </form>
    </div>
  )
}
