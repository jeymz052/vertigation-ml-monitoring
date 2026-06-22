import { AuthProvider, useAuth } from './hooks/useAuth'
import { useSensorData } from './hooks/useSensorData'
import LoginPage     from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MachineLearningPage from './pages/MachineLearningPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import Navbar from './components/Navbar'
import { useEffect, useMemo, useState } from 'react'

function Router() {
  const { authed, role } = useAuth()
  const [page, setPage] = useState('dashboard')

  const allowedPages = useMemo(() => {
    return role === 'farmer'
      ? ['dashboard', 'settings']
      : ['dashboard', 'machineLearning', 'reports', 'settings']
  }, [role])

  useEffect(() => {
    if (!allowedPages.includes(page)) {
      setPage(allowedPages[0] || 'dashboard')
    }
  }, [allowedPages, page])

  if (!authed) return <LoginPage />

  return <AuthenticatedShell page={page} setPage={setPage} allowedPages={allowedPages} />
}

function AuthenticatedShell({ page, setPage, allowedPages }) {
  const sensorState = useSensorData()
  const { role } = useAuth()

  const pageContent = {
    dashboard: <DashboardPage {...sensorState} />,
    machineLearning: <MachineLearningPage {...sensorState} />,
    reports: <ReportsPage {...sensorState} />,
    settings: <SettingsPage {...sensorState} role={role} />,
  }[page] ?? <DashboardPage {...sensorState} />

  return (
    <div style={styles.appShell}>
      <Navbar
        role={role}
        activePage={page}
        onNavigate={setPage}
        status={sensorState.status}
        lastUpdate={sensorState.lastUpdate}
        allowedPages={allowedPages}
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
