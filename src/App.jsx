import { AuthProvider, useAuth } from './hooks/useAuth'
import { useSensorData } from './hooks/useSensorData'
import LoginPage     from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MachineLearningPage from './pages/MachineLearningPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import Navbar from './components/Navbar'
import { useState } from 'react'

function Router() {
  const { authed } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (!authed) return <LoginPage />

  return <AuthenticatedShell page={page} setPage={setPage} />
}

function AuthenticatedShell({ page, setPage }) {
  const sensorState = useSensorData()

  const pageContent = {
    dashboard: <DashboardPage {...sensorState} />,
    machineLearning: <MachineLearningPage {...sensorState} />,
    reports: <ReportsPage />,
    settings: <SettingsPage {...sensorState} />,
  }[page] ?? <DashboardPage {...sensorState} />

  return (
    <div style={styles.appShell}>
      <Navbar
        activePage={page}
        onNavigate={setPage}
        status={sensorState.status}
        lastUpdate={sensorState.lastUpdate}
      />
      {pageContent}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}

const styles = {
  appShell: {
    minHeight: '100vh',
    background: '#f8fafc',
  },
}
