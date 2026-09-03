import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHead } from '../components/SyncChip.jsx'
import { DEFAULT_TARGETS } from '../db/index.js'
import { caloriesFromMacros, fmtCal, fmtG, round0 } from '../lib/format.js'
import { useData } from '../sync/DataContext.jsx'

export function Settings() {
  const { settings, saveTargets, user, logout } = useData()
  const [form, setForm] = useState(DEFAULT_TARGETS)
  const [saved, setSaved] = useState(false)
  const [installEvent, setInstallEvent] = useState(null)
  const ios = isIos()
  const standalone = isStandalone()

  useEffect(() => {
    if (settings) {
      setForm({
        calories: settings.calories,
        protein: settings.protein,
        carbs: settings.carbs,
        fat: settings.fat,
      })
    }
  }, [settings])

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const save = async () => {
    await saveTargets(form)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  const restoreDefaults = () => {
    setForm({ ...DEFAULT_TARGETS })
    setSaved(false)
  }

  const atwater = round0(caloriesFromMacros(form.protein, form.carbs, form.fat))

  const install = async () => {
    if (!installEvent) return
    installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  return (
    <div className="page">
      <PageHead kicker="House rules" title="Settings" sub="Daily calorie and macro goals. Saved to your account." />

      <section className="card stack">
        <div>
          <h2 className="card-title">Account</h2>
          <p className="sub">{user?.email}</p>
        </div>
        <button className="secondary full" type="button" onClick={logout}>
          Sign out
        </button>
      </section>

      <section className="card stack" style={{ marginTop: 14 }}>
        <div>
          <h2 className="card-title">Daily targets</h2>
          <p className="sub">
            Today’s remaining calories and progress bars use these numbers.
          </p>
        </div>
        <Num id="t-cal" label="Calories (kcal)" value={form.calories} onChange={(v) => setForm({ ...form, calories: v })} />
        <div className="grid-2">
          <Num id="t-p" label="Protein (g)" value={form.protein} onChange={(v) => setForm({ ...form, protein: v })} />
          <Num id="t-c" label="Carbs (g)" value={form.carbs} onChange={(v) => setForm({ ...form, carbs: v })} />
        </div>
        <Num id="t-f" label="Fat (g)" value={form.fat} onChange={(v) => setForm({ ...form, fat: v })} />
        <p className="tiny">
          P {fmtG(form.protein)} + C {fmtG(form.carbs)} + F {fmtG(form.fat)} add up to about {fmtCal(atwater)} kcal
          (4 / 4 / 9). Your calorie target can stay different.
        </p>
        <button className="primary full" onClick={save}>
          {saved ? 'Saved' : 'Save targets'}
        </button>
        <button className="secondary full" type="button" onClick={restoreDefaults}>
          Reset to {DEFAULT_TARGETS.calories} / {DEFAULT_TARGETS.protein} / {DEFAULT_TARGETS.carbs} / {DEFAULT_TARGETS.fat}
        </button>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 className="card-title">Path</h2>
        <p className="sub">
          Daily stars, streaks, level, and badges. Recalculated on the server when you log food or lifts.
        </p>
        <Link to="/path" className="secondary full" style={{ marginTop: 12, display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
          Open Path
        </Link>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Install</h2>
        {standalone ? (
          <p className="sub">Running as an installed app. Nice.</p>
        ) : ios ? (
          <>
            <p className="sub">On iPhone / iPad, Safari cannot auto-install. Do this:</p>
            <ol className="hint-list">
              <li>Tap the Share button</li>
              <li>Scroll to Add to Home Screen</li>
              <li>Confirm Discipline</li>
            </ol>
          </>
        ) : (
          <>
            <p className="sub">Add Discipline to your home screen for a full-screen log.</p>
            {installEvent ? (
              <button className="primary full" style={{ marginTop: 12 }} onClick={install}>
                Install
              </button>
            ) : (
              <p className="tiny" style={{ marginTop: 8 }}>
                Chrome: menu → Install app. After the first visit, the app shell is cached.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function Num({ id, label, value, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}
