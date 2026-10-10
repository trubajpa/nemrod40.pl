import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { reviewAccessRequest, watchPendingRequests, type AccessRequest } from '../auth/accessRequests'

export function UserAccessPage() {
  const { role, user } = useAuth()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (role !== 'admin') return
    return watchPendingRequests(items => { setRequests(items); setLoading(false) }, () => { setError('Nie udało się pobrać wniosków.'); setLoading(false) })
  }, [role])
  if (role !== 'admin') return <Navigate to="/panel" replace />
  async function review(uid: string, decision: 'approved' | 'rejected') {
    setBusy(true); setError('')
    try { await reviewAccessRequest(uid, decision, user!.uid) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Nie udało się rozpatrzyć wniosku.') }
    finally { setBusy(false) }
  }
  return <section className="member-page"><div className="container member-shell">
    <Link to="/panel">← Wróć do panelu</Link><header className="member-header"><span className="eyebrow">Administracja</span><h1>Dostęp użytkowników</h1><p>Osoby, które pomyślnie zalogowały się przez Google i zgłosiły dostęp do aplikacji.</p></header>
    {error && <p className="form-message error" role="alert">{error}</p>}
    {loading ? <p role="status">Wczytywanie wniosków…</p> : requests.length === 0 ? <p>Brak oczekujących wniosków.</p> : requests.map(request => <article className="member-notice" key={request.uid}>
      <h2>{request.displayName || 'Brak nazwy'}</h2><p>{request.email}</p><p>Data zgłoszenia: {request.requestedAt?.toDate().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }) ?? 'Zapisywanie…'}</p>
      <div className="actions"><button className="button" disabled={busy} onClick={() => void review(request.uid, 'approved')}>Zatwierdź jako member</button><button className="button outline" disabled={busy} onClick={() => void review(request.uid, 'rejected')}>Odrzuć</button></div>
    </article>)}
  </div></section>
}
