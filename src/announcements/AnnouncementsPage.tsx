import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { addAnnouncementComment, approvePublication, subscribeAnnouncements, subscribeDetails, toggleReaction, type Announcement, type Comment, type Vote } from './repository'
import './announcements.css'
import { PublicationForm } from './PublicationForm'
import { PublicationPhoto } from './PublicationPhoto'

const date = (value: number) => value ? new Date(value).toLocaleString('pl-PL') : 'Zapisywanie…'
function AnnouncementCard({ item, uid, name, admin }: { item: Announcement; uid: string; name: string; admin: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]), [votes, setVotes] = useState<Vote[]>([])
  const [body, setBody] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => subscribeDetails(item.id, setComments, setVotes, () => setError('Nie udało się odczytać komentarzy lub reakcji.')), [item.id])
  async function act(action: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError('')
    try { await action() } catch { setError('Nie udało się zapisać. Sprawdź połączenie i aktualne uprawnienia.') } finally { setBusy(false) }
  }
  const mine = votes.find(vote => vote.uid === uid)?.type
  return <article className="announcement-card">
    <span className="eyebrow">{item.kind}</span><h2>{item.subject}</h2>
    <p className="announcement-meta"><strong>{item.authorName}</strong> · <time>{item.dateLabel ?? date(item.createdAt)}</time></p>
    <p className="announcement-body">{item.body}</p>
    <div className="publication-gallery">{item.mainPhoto && <PublicationPhoto path={item.mainPhoto} alt={item.subject} />}{item.photos.filter(path => path !== item.mainPhoto).map(path => <PublicationPhoto key={path} path={path} alt={item.subject} />)}</div>
    <p>{item.publicStatus === 'approved' ? 'Zatwierdzony do publikacji publicznej' : item.publicStatus === 'pending' ? 'Publikacja publiczna oczekuje na zatwierdzenie' : 'Tylko dla zalogowanych'}</p>
    {admin && item.publicStatus === 'pending' && <button className="button" disabled={busy} onClick={() => void act(() => approvePublication(item.id))}>Zatwierdź publikację publiczną: {item.placements.filter(value => value !== 'members').map(value => value === 'news' ? 'Aktualności' : 'Działalność').join(', ')}</button>}
    <div className="announcement-reactions"><button type="button" aria-label="Serduszko" aria-pressed={mine === 'heart'} disabled={busy} onClick={() => void act(() => toggleReaction(item.id))}>♥ {votes.filter(vote => vote.type === 'heart').length}</button><span>{comments.length} komentarzy</span></div>
    {error && <p role="alert">{error}</p>}
    <div className="announcement-comments">{comments.map(comment => <div className="announcement-comment" key={comment.id}><p className="announcement-meta"><strong>{comment.authorName}</strong> · <time>{date(comment.createdAt)}</time></p><p className="announcement-body">{comment.body}</p></div>)}</div>
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); if (body.trim()) void act(async () => { await addAnnouncementComment(item.id, body, name); setBody('') }) }}>
      <label>Komentarz<textarea value={body} onChange={event => setBody(event.target.value)} required maxLength={2000} /></label>
      <button className="button outline" disabled={busy || !body.trim()}>Dodaj komentarz</button>
    </form>
  </article>
}
export function AnnouncementsPage() {
  const { user, profile, isActiveMember, role } = useAuth()
  const [items, setItems] = useState<Announcement[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  useEffect(() => {
    if (!isActiveMember || !user) return
    return subscribeAnnouncements(rows => { setItems(rows); setLoading(false) }, () => { setItems([]); setLoading(false); setError('Nie udało się odczytać ogłoszeń.') })
  }, [isActiveMember, user])
  if (!isActiveMember || !user) return null
  const name = profile?.displayName ?? ''
  return <section className="member-page"><div className="container member-shell announcements-shell"><Link to="/panel">← Panel członka</Link>
    <header className="member-header"><span className="eyebrow">Strefa członkowska</span><h1>Informacje dla członków</h1><p>Wspólne wpisy, komentarze i serduszka. Wpisy publiczne wymagają zatwierdzenia administratora.</p></header>
    <PublicationForm name={name} />
    {error && <p role="alert">{error}</p>}{loading ? <p role="status">Wczytujemy ogłoszenia…</p> : <section aria-label="Lista ogłoszeń"><p>{items.length} wpisów.</p>{!items.length && !error && <p>Nie ma jeszcze ogłoszeń.</p>}{items.map(item => <AnnouncementCard key={item.id} item={item} uid={user.uid} name={name} admin={role === 'admin'} />)}</section>}
  </div></section>
}
