import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

const baseAuth: AuthContextValue = {
  user: null,
  profile: null,
  role: null,
  isActiveMember: false,
  loading: false,
  accessError: null,
  clearAccessError: vi.fn(),
  logout: vi.fn(),
}

function LoginDestination() {
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  return <div>Logowanie; powrót: {from ?? 'brak'}</div>
}

function renderProtected(authOverrides: Partial<AuthContextValue> = {}, initialEntry = '/panel') {
  return render(
    <AuthContext.Provider value={{ ...baseAuth, ...authOverrides }}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<ProtectedRoute/>}>
            <Route path="/panel" element={<div>Panel członka</div>}/>
            <Route path="/panel/urzadzenia/:id" element={<div>Szczegóły urządzenia</div>}/>
          </Route>
          <Route path="/logowanie" element={<LoginDestination/>}/>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProtectedRoute', () => {
  it('pokazuje stan ładowania podczas sprawdzania sesji', () => {
    renderProtected({ loading: true })
    expect(screen.getByRole('status')).toHaveTextContent('Sprawdzamy sesję i uprawnienia')
  })

  it('przekierowuje niezalogowanego użytkownika do logowania', () => {
    renderProtected()
    expect(screen.getByText(/Logowanie/)).toBeInTheDocument()
  })

  it('wpuszcza aktywnego członka', () => {
    renderProtected({ isActiveMember: true })
    expect(screen.getByText('Panel członka')).toBeInTheDocument()
  })

  it('nie wpuszcza nieaktywnego lub nieuprawnionego użytkownika', () => {
    renderProtected({ isActiveMember: false, profile: { active: false } })
    expect(screen.getByText(/Logowanie/)).toBeInTheDocument()
    expect(screen.queryByText('Panel członka')).not.toBeInTheDocument()
  })

  it('zachowuje pierwotny chroniony adres przy przekierowaniu', () => {
    renderProtected({}, '/panel/urzadzenia/ambona-12')
    expect(screen.getByText('Logowanie; powrót: /panel/urzadzenia/ambona-12')).toBeInTheDocument()
  })
})
