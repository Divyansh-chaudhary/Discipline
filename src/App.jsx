import { Navigate, Route, Routes } from 'react-router-dom'
import { Spinner } from './components/BusyButton.jsx'
import { BottomNav } from './components/BottomNav.jsx'
import { AuthScreen } from './pages/Auth.jsx'
import { Foods } from './pages/Foods.jsx'
import { History } from './pages/History.jsx'
import { Path } from './pages/Path.jsx'
import { Settings } from './pages/Settings.jsx'
import { Today } from './pages/Today.jsx'
import { Workout } from './pages/Workout.jsx'
import { WorkoutSplitDetail } from './pages/WorkoutSplitDetail.jsx'
import { WorkoutTypeDetail } from './pages/WorkoutTypeDetail.jsx'
import { WorkoutTypes } from './pages/WorkoutTypes.jsx'
import { useData } from './sync/DataContext.jsx'

export default function App() {
  const { user, authReady, ready, bootError } = useData()

  if (!authReady) {
    return (
      <div className="app-shell">
        <div className="page page-loader">
          <Spinner size={28} label="Loading app" />
          <p className="sub">Loading…</p>
        </div>
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
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/foods" element={<Foods />} />
        <Route path="/workout" element={<Workout />} />
        <Route path="/workout/types" element={<WorkoutTypes />} />
        <Route path="/workout/types/:typeId" element={<WorkoutTypeDetail />} />
        <Route path="/workout/types/:typeId/splits/:splitId" element={<WorkoutSplitDetail />} />
        <Route path="/history" element={<History />} />
        <Route path="/path" element={<Path />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
