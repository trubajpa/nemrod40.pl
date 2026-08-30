import { useState, type FormEvent } from 'react'
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getAuthErrorMessage } from '../auth/authErrors'
import { auth } from '../lib/firebase'

type LoginLocationState = { from?: { pathname?: string; search?: string } }

export function LoginPage() {
  const { loading, isActiveMember, accessError, clearAccessError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LoginLocationState | null
  const destination = state?.from?.pathname
    ? `${state.from.pathname}${state.from.search ?? ''}`
    : '/panel'

  if (!loading && isActiveMember) return <Navigate to={destination} replace />

  async function handleEmailLogin(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    clearAccessError()
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      navigate(destination, { replace: true })
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleLogin() {
    setBusy(true)
    setError(null)
    clearAccessError()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(auth, provider)
      navigate(destination, { replace: true })
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError))
    } finally {
      setBusy(false)
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch (resetError) {
      if (resetError instanceof FirebaseError && resetError.code === 'auth/user-not-found') {
        setResetSent(true)
        return
      }
      const message = getAuthErrorMessage(resetError)
      setError(message === 'Nieprawidłowy adres e-mail lub hasło.' ? 'Wpisz prawidłowy adres e-mail.' : message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="auth-page">
    <div className="auth-card">
      <Link className="auth-brand" to="/" aria-label="Nemrod – strona główna">
        <span className="auth-logo-frame"><img src="/images/brand/logo-nemrod-v2.png" alt=""/></span>
        <span><strong>Nemrod</strong><small>Koło Łowieckie nr 40 w Krzczonowie</small></span>
      </Link>
      <div className="auth-heading">
        <span className="eyebrow">Strefa członkowska</span>
        <h1>{resetMode ? 'Ustaw lub odzyskaj hasło' : 'Logowanie'}</h1>
        <p>{resetMode ? 'Podaj adres przypisany do konta. Wyślemy instrukcję ustawienia nowego hasła.' : 'Zaloguj się, aby przejść do materiałów przeznaczonych dla członków Koła.'}</p>
      </div>

      {(error || accessError) && <div className="form-message error" role="alert">{accessError ?? error}</div>}
      {resetSent && <div className="form-message success" role="status">Wysłaliśmy wiadomość z linkiem do ustawienia lub zmiany hasła. Sprawdź również folder spam.</div>}

      {resetMode ? <form className="auth-form" onSubmit={handleReset}>
        <label htmlFor="reset-email">Login (adres e-mail)</label>
        <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy || resetSent}/>
        <button className="button full-button" type="submit" disabled={busy || resetSent}>{busy ? 'Wysyłanie…' : 'Wyślij link'}</button>
        <button className="text-button" type="button" disabled={busy} onClick={() => { setResetMode(false); setResetSent(false); setError(null) }}>Wróć do logowania</button>
      </form> : <>
        <button className="google-button" type="button" onClick={handleGoogleLogin} disabled={busy || loading}><span aria-hidden="true">G</span>{busy ? 'Logowanie…' : 'Zaloguj przez Google'}</button>
        <p className="google-help">Jeśli logowanie Google nie działa, sprawdź w Firebase, czy domena nemrod40.pl i localhost są dodane do „Authorized domains”.</p>
        <div className="separator"><span>lub</span></div>
        <form className="auth-form" onSubmit={handleEmailLogin}>
          <label htmlFor="login-email">Login (adres e-mail)</label>
          <input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy}/>
          <label htmlFor="login-password">Hasło</label>
          <div className="password-field">
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy}/>
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}>{showPassword ? 'Ukryj' : 'Pokaż'}</button>
          </div>
          <button className="button full-button" type="submit" disabled={busy || loading}>{busy ? 'Logowanie…' : 'Zaloguj się'}</button>
          <button className="text-button" type="button" disabled={busy} onClick={() => { setResetMode(true); setError(null); clearAccessError() }}>Ustaw lub odzyskaj hasło</button>
        </form>
      </>}
      <Link className="public-back-link" to="/">← Wróć do strony publicznej</Link>
    </div>
  </section>
}
