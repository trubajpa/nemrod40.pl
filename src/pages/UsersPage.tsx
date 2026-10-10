import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { changeUserAccess, listUsersPage, type ManagedUser, type UserChange } from '../auth/userManagement'
import './users.css'

const statusLabels = { active: 'Aktywny', pending: 'Oczekuje', 'no-access': 'Bez dostępu' }
const date = (value: string | null) => value ? new Date(value).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }) : '—'
export function UsersPage() {
  const { role, user } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [revoke, setRevoke] = useState<ManagedUser | null>(null)
  useEffect(() => {
    if (role !== 'admin') return
    let disposed = false
    async function load() {
      try {
        const all: ManagedUser[] = []
        let token: string | undefined
        do {
          const result = await listUsersPage(token)
          if (disposed) return
          all.push(...result.users)
          token = result.nextPageToken ?? undefined
        } while (token)
        setUsers(all); setLoading(false)
      } catch (cause) { if (!disposed) { setError(cause instanceof Error ? cause.message : 'Nie udało się pobrać użytkowników.'); setLoading(false) } }
    }
    void load()
    return () => { disposed = true }
  }, [role, revision])
  if (role !== 'admin') return <Navigate to="/panel" replace />
  const term = search.trim().toLocaleLowerCase('pl-PL')
  const filtered = users.filter(item => (status === 'all' || item.status === status) && `${item.displayName} ${item.email}`.toLocaleLowerCase('pl-PL').includes(term))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1))
  async function change(input: UserChange) {
    setBusy(true); setError(''); setMessage('')
    try {
      await changeUserAccess(input)
      setRevoke(null); setUsers([]); setLoading(true); setRevision(value => value + 1)
      setMessage('Zmiana została zapisana.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Nie udało się zmienić uprawnień.') }
    finally { setBusy(false) }
  }
  return <section className="member-page"><div className="container member-shell users-shell">
    <Link to="/panel">← Wróć do panelu</Link><header className="member-header"><span className="eyebrow">Administracja</span><h1>Użytkownicy</h1><p>Konta Firebase Auth, uprawnienia do aplikacji i wnioski o dostęp. Odebranie dostępu zachowuje konto logowania.</p></header>
    <div className="users-filters"><label>Szukaj po imieniu lub e-mailu<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }}/></label><label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}><option value="all">Wszystkie</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button outline" disabled={busy || loading} onClick={() => { setUsers([]); setLoading(true); setError(''); setRevision(value => value + 1) }}>Odśwież</button></div>
    {error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message success" role="status">{message}</p>}
    {loading ? <p role="status">Wczytywanie wszystkich kont…</p> : <><p>Liczba pasujących kont: {filtered.length}</p><div className="users-table-scroll"><table className="users-table"><thead><tr><th>Imię i nazwisko</th><th>E-mail</th><th>Rola</th><th>Status</th><th>Ostatnie logowanie</th><th>Akcje</th></tr></thead><tbody>{filtered.slice(currentPage * 50, (currentPage + 1) * 50).map(item => <tr key={item.uid}>
      <td>{item.displayName || '—'}</td><td>{item.email || '—'}{item.disabled && <small>Konto Auth zablokowane</small>}{item.email && item.emailVerified === false && <small>E-mail niepotwierdzony</small>}{item.accessRequest && <small>Wniosek: {date(item.accessRequest.requestedAt)}</small>}</td><td>{item.role || 'brak'}</td><td>{statusLabels[item.status]}</td><td>{date(item.lastSignInTime)}</td><td><div className="users-actions">
        {item.status === 'pending' && !item.disabled && <><button disabled={busy} onClick={() => void change({ uid: item.uid, action: 'approve' })}>Zatwierdź jako member</button><button disabled={busy} onClick={() => void change({ uid: item.uid, action: 'reject' })}>Odrzuć</button></>}
        {item.status === 'active' && <><button disabled={busy || item.uid === user?.uid} onClick={() => void change({ uid: item.uid, action: 'role', role: item.role === 'admin' ? 'member' : 'admin' })}>{item.role === 'admin' ? 'Zmień na member' : 'Zmień na admin'}</button><button disabled={busy} onClick={() => setRevoke(item)}>Odbierz dostęp</button></>}
        {item.status === 'no-access' && <span>Brak aktywnego dostępu</span>}
      </div></td></tr>)}</tbody></table></div>{!filtered.length && <p>Brak pasujących użytkowników.</p>}
      {filtered.length > 50 && <div className="users-pagination"><button disabled={busy || currentPage === 0} onClick={() => setPage(currentPage - 1)}>Poprzednia</button><span>Strona {currentPage + 1} z {Math.ceil(filtered.length / 50)}</span><button disabled={busy || (currentPage + 1) * 50 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Następna</button></div>}
    </>}
    {revoke && <div className="users-confirm-backdrop"><section className="users-confirm" role="dialog" aria-modal="true" aria-labelledby="revoke-title"><h2 id="revoke-title">Odebrać dostęp użytkownikowi?</h2><p>{revoke.displayName} — {revoke.email}</p><p>Użytkownik utraci dostęp do strefy członkowskiej. Konto Firebase Auth pozostanie. Po ponownym zalogowaniu może znów zgłosić wniosek.</p><div className="actions"><button className="button" autoFocus disabled={busy} onClick={() => setRevoke(null)}>Anuluj</button><button className="button outline" disabled={busy} onClick={() => void change({ uid: revoke.uid, action: 'revoke', confirmed: true })}>Potwierdź odebranie dostępu</button></div>{error && <p role="alert">{error}</p>}</section></div>}
  </div></section>
}
