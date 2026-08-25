import { useEffect, useState } from 'react'
import './App.css'
import HomePage from './pages/public/HomePage'
import VendorDashboardPage from './pages/vendor/VendorDashboardPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import SupervisorDashboardPage from './pages/supervisor/SupervisorDashboardPage'
import { SESSION_EXPIRED_EVENT } from './utils/apiClient'

function App() {
  const [user, setUser] = useState(() => {
    const session = sessionStorage.getItem('rifa-session')
    return session ? JSON.parse(session).user : null
  })
  const userRole = user?.rol

  useEffect(() => {
    const handleSessionExpired = () => setUser(null)
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  const handleLogout = async () => {
    const session = sessionStorage.getItem('rifa-session')
    sessionStorage.removeItem('rifa-session')
    setUser(null)

    if (!session) return

    try {
      const { token } = JSON.parse(session)
      if (token) {
        await fetch('http://localhost:4000/api/sessions/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
      }
    } catch {
      // La sesion local ya se cerro aunque la notificacion al servidor falle.
    }
  }

  if (userRole === 'vendedor') return <VendorDashboardPage user={user} onLogout={handleLogout} />
  if (userRole === 'administrador') return <AdminDashboardPage user={user} onLogout={handleLogout} />
  if (userRole === 'supervisor') return <SupervisorDashboardPage user={user} onLogout={handleLogout} />

  return <HomePage onRoleLogin={setUser} />
}

export default App
