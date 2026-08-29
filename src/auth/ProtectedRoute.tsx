import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute() {
  const { loading, isActiveMember } = useAuth()
  const location = useLocation()

  if (loading) return <div className="auth-loading" role="status"><span className="spinner"/><p>Sprawdzamy sesję i uprawnienia…</p></div>
  if (!isActiveMember) return <Navigate to="/logowanie" replace state={{ from: location }} />
  return <Outlet />
}
