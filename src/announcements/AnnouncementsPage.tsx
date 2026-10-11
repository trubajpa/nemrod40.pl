import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { addAnnouncementComment, createAnnouncement, kinds, subscribeAnnouncements, subscribeDetails, toggleReaction, type Announcement, type Comment, type Kind, type Reaction, type Vote } from './repository'
import './announcements.css'

const date = (value: number) => value ? new Date(value).toLocaleString('pl-PL') : 'Zapisywanie…'
function AnnouncementCard({ item, uid, name }: { item: Announcement; uid: string; name: string }) {
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
    <p className="announcement-meta"><strong>{item.authorName}</strong> · <time>{date(item.createdAt)}</time></p>
    <p className="announcement-body">{item.body}</p>
    <div className="announcement-reactions">{([['heart', '♥', 'Serduszko'], ['up', '👍', 'Kciuk w górę'], ['down', '👎', 'Kciuk w dół']] as const).map(([type, icon, label]) => <button key={type} type="button" aria-label={label} aria-pressed={mine === type} disabled={busy} onClick={() => void act(() => toggleReaction(item.id, type as Reaction))}>{icon} {votes.filter(vote => vote.type === type).length}</button>)}<span>{comments.length} komentarzy</span></div>
    {error && <p role="alert">{error}</p>}
    <div className="announcement-comments">{comments.map(comment => <div className="announcement-comment" key={comment.id}><p className="announcement-meta"><strong>{comment.authorName}</strong> · <time>{date(comment.createdAt)}</time></p><p className="announcement-body">{comment.body}</p></div>)}</div>
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); if (body.trim()) void act(async () => { await addAnnouncementComment(item.id, body, name); setBody('') }) }}>
      <label>Komentarz<textarea value={body} onChange={event => setBody(event.target.value)} required maxLength={2000} /></label>
      <button className="button outline" disabled={busy || !body.trim()}>Dodaj komentarz</button>
    </form>
  </article>
}
export function AnnouncementsPage() {
  const { user, profile, isActiveMember } = useAuth()
  const [items, setItems] = useState<Announcement[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [subject, setSubject] = useState(''), [body, setBody] = useState(''), [kind, setKind] = useState<Kind>('inne'), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!isActiveMember || !user) return
    return subscribeAnnouncements(rows => { setItems(rows); setLoading(false) }, () => { setItems([]); setLoading(false); setError('Nie udało się odczytać ogłoszeń.') })
  }, [isActiveMember, user])
  if (!isActiveMember || !user) return null
  const name = profile?.displayName ?? ''
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !subject.trim() || !body.trim()) return
    setBusy(true); setError('')
    try { await createAnnouncement(subject, body, kind, name); setSubject(''); setBody('') }
    catch { setError('Nie udało się dodać ogłoszenia. Sprawdź połączenie i aktualne uprawnienia.') }
    finally { setBusy(false) }
  }
  return <section className="member-page"><div className="container member-shell announcements-shell"><Link to="/panel">← Panel członka</Link>
    <header className="member-header"><span className="eyebrow">Strefa członkowska</span><h1>Ogłoszenia</h1><p>Imprezy, spotkania, ustalenia i wspólne działania. Każda osoba może wybrać jedną reakcję na ogłoszenie. Kliknij ją ponownie, aby ją cofnąć.</p></header>
    <form className="announcement-card" onSubmit={event => void submit(event)}><h2>Dodaj ogłoszenie</h2>
      <label>Temat<input value={subject} onChange={event => setSubject(event.target.value)} required maxLength={160} /></label>
      <label>Rodzaj<select value={kind} onChange={event => setKind(event.target.value as Kind)}>{kinds.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Treść<textarea value={body} onChange={event => setBody(event.target.value)} required maxLength={10000} /></label>
      <button className="button" disabled={busy || !subject.trim() || !body.trim()}>Opublikuj ogłoszenie</button>
    </form>
    {error && <p role="alert">{error}</p>}{loading ? <p role="status">Wczytujemy ogłoszenia…</p> : <section aria-label="Lista ogłoszeń"><p>Ostatnie {items.length} ogłoszeń (maksymalnie 50).</p>{!items.length && !error && <p>Nie ma jeszcze ogłoszeń.</p>}{items.map(item => <AnnouncementCard key={item.id} item={item} uid={user.uid} name={name} />)}</section>}
  </div></section>
}
