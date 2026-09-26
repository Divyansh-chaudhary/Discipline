import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Spinner } from './components/BusyButton.jsx'
import { BottomNav } from './components/BottomNav.jsx'
import { AuthScreen } from './pages/Auth.jsx'
import { Today } from './pages/Today.jsx'
import { useData } from './sync/DataContext.jsx'

// Today ships in the entry chunk; the rest load when first visited.
const Foods = lazy(() => import('./pages/Foods.jsx').then((m) => ({ default: m.Foods })))
const History = lazy(() => import('./pages/History.jsx').then((m) => ({ default: m.History })))
const Path = lazy(() => import('./pages/Path.jsx').then((m) => ({ default: m.Path })))
const Settings = lazy(() => import('./pages/Settings.jsx').then((m) => ({ default: m.Settings })))
const Workout = lazy(() => import('./pages/Workout.jsx').then((m) => ({ default: m.Workout })))
const WorkoutGroup = lazy(() =>
  import('./pages/WorkoutGroup.jsx').then((m) => ({ default: m.WorkoutGroup })),
)
const ExerciseHistory = lazy(() =>
  import('./pages/ExerciseHistory.jsx').then((m) => ({ default: m.ExerciseHistory })),
)
const ExerciseDetail = lazy(() =>
  import('./pages/ExerciseDetail.jsx').then((m) => ({ default: m.ExerciseDetail })),
)

function PageFallback({ label = 'Loading…' }) {
  return (
    <div className="page page-loader">
      <Spinner size={28} label={label} />
      <p className="sub">{label}</p>
    </div>
  )
}

export default function App() {
  const { user, authReady, ready, bootError } = useData()

  if (!authReady) {
    return (
      <div className="app-shell">
        <PageFallback />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-shell">
        <AuthScreen />
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="app-shell">
        <div className="page page-loader">
          <Spinner size={28} label="Syncing account" />
          <p className="sub">Syncing your account…</p>
          {bootError ? <p className="warn">{bootError}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {bootError ? <p className="boot-banner">{bootError}</p> : null}
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/foods" element={<Foods />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/workout/group/:splitId" element={<WorkoutGroup />} />
          <Route path="/workout/history" element={<ExerciseHistory />} />
          <Route path="/workout/history/:slug" element={<ExerciseDetail />} />
          <Route path="/workout/types/*" element={<Navigate to="/workout" replace />} />
          <Route path="/history" element={<History />} />
          <Route path="/path" element={<Path />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </div>
  )
}
