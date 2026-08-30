import { FirebaseError } from 'firebase/app'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const mocks = vi.hoisted(() => ({
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  setCustomParameters: vi.fn(),
  useAuth: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    setCustomParameters = mocks.setCustomParameters
  },
  signInWithPopup: mocks.signInWithPopup,
  signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}))

vi.mock('../lib/firebase', () => ({ auth: {} }))
vi.mock('../auth/useAuth', () => ({ useAuth: mocks.useAuth }))

const inactiveAuth = {
  loading: false,
  isActiveMember: false,
  accessError: null,
  clearAccessError: vi.fn(),
}

function renderLogin(initialEntry: string | { pathname: string; state?: unknown } = '/logowanie') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/logowanie" element={<LoginPage/>}/>
        <Route path="/panel/urzadzenia/:id" element={<div>Chroniona trasa docelowa</div>}/>
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage Google sign-in', () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue(inactiveAuth)
    mocks.signInWithPopup.mockReset()
    mocks.setCustomParameters.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it.each([
    ['auth/popup-closed-by-user', 'Logowanie zostało anulowane.'],
    ['auth/network-request-failed', 'Nie udało się połączyć z usługą logowania. Sprawdź internet i spróbuj ponownie.'],
    ['auth/api-key-not-valid', 'Logowanie jest chwilowo niedostępne z powodu błędu konfiguracji.'],
  ])('ukrywa kod %s i pokazuje bezpieczny komunikat', async (code, message) => {
    mocks.signInWithPopup.mockRejectedValueOnce(new FirebaseError(code, 'sensitive technical payload'))
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: 'Zaloguj przez Google' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(alert).not.toHaveTextContent(code)
  })

  it('używa popupu Google z wyborem konta', async () => {
    mocks.signInWithPopup.mockRejectedValueOnce(new FirebaseError('auth/popup-closed-by-user', 'closed'))
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: 'Zaloguj przez Google' }))

    expect(mocks.signInWithPopup).toHaveBeenCalledTimes(1)
    expect(mocks.setCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' })
  })

  it('wraca na pierwotną trasę, gdy aktywny użytkownik otwiera logowanie po przekierowaniu', () => {
    mocks.useAuth.mockReturnValue({ ...inactiveAuth, isActiveMember: true })
    renderLogin({
      pathname: '/logowanie',
      state: { from: { pathname: '/panel/urzadzenia/ambona-12', search: '' } },
    })

    expect(screen.getByText('Chroniona trasa docelowa')).toBeInTheDocument()
  })
})
