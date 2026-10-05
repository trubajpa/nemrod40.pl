import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PostForm } from './ForumForm'
import { addComment, addReply, createTopic, getAuthor, moderatePost, subscribeForum } from './forumRepository'
import type { Post, Topic } from './models'
import './forum.css'

const date = (value: number) => value ? new Date(value).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }) : 'Zapisywanie…'
function PostBody({ post, admin, onDelete }: { post: Post; admin: boolean; onDelete: () => void }) {
  const [identity, setIdentity] = useState(''), [busy, setBusy] = useState(false)
  const [identityError, setIdentityError] = useState('')
  async function reveal() {
    if (!admin || busy) return
    if (identity) { setIdentity(''); return }
    setBusy(true); setIdentityError('')
    try { const author = await getAuthor(post); setIdentity(author ? `${author.name} · ${author.email} · UID: ${author.uid}` : 'Brak zapisu autorstwa.') }
    catch { setIdentityError('Nie udało się odczytać autora. Wymagane są aktualne uprawnienia administratora.') }
    finally { setBusy(false) }
  }
  return <><div className="forum-post-meta"><strong>{post.signature}</strong>{post.pseudonym && <span className="forum-tag">pseudonim</span>}<time dateTime={post.createdAt ? new Date(post.createdAt).toISOString() : undefined}>{date(post.createdAt)}</time></div><p className="forum-body">{post.body}</p>{admin && <div className="forum-moderation"><button type="button" className="forum-link-button" disabled={busy} onClick={() => void reveal()}>{busy ? 'Odczytywanie…' : identity ? 'Ukryj autora' : 'Ustal autora'}</button><button type="button" className="forum-delete" onClick={onDelete}>Usuń</button>{identity && <p className="forum-author">Autor rzeczywisty: <strong>{identity}</strong></p>}{identityError && <p className="forum-error" role="alert">{identityError}</p>}</div>}</>
}
export function ForumPage() {
  const { profile, user, role, isActiveMember } = useAuth()
  const [topics, setTopics] = useState<Topic[]>([]), [loading, setLoading] = useState(true)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const [moderating, setModerating] = useState(false)
  const [commentFor, setCommentFor] = useState<string | null>(null)
  const { topicId } = useParams()
  const navigate = useNavigate()
  const admin = role === 'admin', profileName = profile?.displayName ?? ''
  const topic = topics.find(t => t.id === topicId)
  useEffect(() => {
    if (!isActiveMember || !user) return
    return subscribeForum(rows => { setTopics(rows); setLoading(false) }, () => { setLoading(false); setError('Nie udało się odczytać forum. Sprawdź połączenie i uprawnienia.') })
  }, [isActiveMember, user])
  async function remove(post: Post, kind: 'topic' | 'reply' | 'comment') {
    if (!admin || moderating) return
    const prompt = kind === 'topic' ? 'Usunąć temat wraz ze wszystkimi odpowiedziami i komentarzami?' : kind === 'reply' ? 'Usunąć odpowiedź wraz ze wszystkimi jej komentarzami?' : 'Usunąć ten komentarz?'
    if (!confirm(prompt)) return
    setModerating(true); setError('')
    try { await moderatePost(post); setCommentFor(null); setMessage('Wpis został usunięty z forum wraz z zawartością poniżej.'); if (kind === 'topic') navigate('/forum') }
    catch { setError('Nie udało się usunąć wpisu. Sprawdź połączenie i uprawnienia administratora.') }
    finally { setModerating(false) }
  }
  if (!isActiveMember) return null
  return <section className="forum-page"><div className="container forum-shell">
    <div className="forum-version-bar"><span className="forum-version">Forum • wersja {import.meta.env.VITE_BUILD_REVISION ?? 'lokalna'}</span><span>{admin ? 'Administrator' : 'Członek Koła'}</span></div>
    <header className="forum-heading"><div><span className="eyebrow">Rozmowy członków Koła</span><h1>Forum</h1><p>Miejsce na pytania, obserwacje i wspólne ustalenia.</p></div><Link className="button" to="/forum/nowy" onClick={() => setMessage('')}>＋ Nowy temat</Link></header>
    <div className="forum-session"><span className="forum-session-dot" />Zalogowany: <strong>{profileName}</strong><Link to="/panel">← Panel członka</Link></div>
    {message && <p className="forum-notice" role="status">{message}</p>}{error && <p className="forum-error" role="alert">{error}</p>}{moderating && <p role="status">Usuwanie wpisu…</p>}
    {topicId && <Link className="forum-back" to="/forum" onClick={() => { setMessage(''); setCommentFor(null) }}>← Wszystkie tematy</Link>}
    {topicId === 'nowy' ? <section className="forum-panel"><h2>Nowy temat</h2><PostForm key={`new-${user?.uid}`} profileName={profileName} label="Publikuj" topic onPublish={async (post, title) => { const id = await createTopic(post, title, profileName); navigate(`/forum/${id}`); setMessage('Temat opublikowany.') }} /></section>
      : loading ? <div className="forum-panel" role="status">Ładowanie forum…</div>
      : topic ? <>
        <article className="forum-panel forum-topic"><span className="eyebrow">Temat</span><h2>{topic.title}</h2><PostBody key={`${topic.id}-${role}`} post={topic} admin={admin} onDelete={() => void remove(topic, 'topic')} /></article>
        <section className="forum-panel"><h2>Dodaj odpowiedź</h2><PostForm key={`answer-${topic.id}-${user?.uid}`} profileName={profileName} label="Publikuj odpowiedź" onPublish={async post => { await addReply(topic.id, post, profileName); setMessage('Dodano odpowiedź do tematu.') }} /></section>
        <section className="forum-answers"><div className="forum-section-title"><h2>Odpowiedzi</h2><span>{topic.answers.length}</span></div>{!topic.answers.length && <div className="forum-panel"><p>Jeszcze nie ma odpowiedzi. Rozpocznij rozmowę powyżej.</p></div>}
          {topic.answers.map(answer => <article className="forum-panel forum-answer" key={answer.id}><PostBody key={`${answer.id}-${role}`} post={answer} admin={admin} onDelete={() => void remove(answer, 'reply')} />
            <div className="forum-answer-actions"><button className="button outline" type="button" aria-expanded={commentFor === answer.id} onClick={() => setCommentFor(commentFor === answer.id ? null : answer.id)}>Skomentuj</button><span>{answer.comments.length} komentarzy</span></div>
            <div className="forum-comments">{answer.comments.map(comment => <article className="forum-comment" key={comment.id}><PostBody key={`${comment.id}-${role}`} post={comment} admin={admin} onDelete={() => void remove(comment, 'comment')} /></article>)}</div>
            {commentFor === answer.id && <div className="forum-comment-form"><h3>Komentarz do odpowiedzi: {answer.signature}</h3><PostForm key={`comment-${answer.id}-${user?.uid}`} profileName={profileName} label="Publikuj komentarz" onCancel={() => setCommentFor(null)} onPublish={async post => { await addComment(topic.id, answer.id, post, profileName); setCommentFor(null); setMessage('Dodano komentarz do odpowiedzi.') }} /></div>}
          </article>)}
        </section>
      </> : topicId ? <div className="forum-panel"><h2>Nie znaleziono tematu</h2><p>Temat mógł zostać usunięty lub nie jest dostępny. Wróć do listy rozmów.</p></div>
        : <section className="forum-topics" aria-label="Lista tematów"><div className="forum-section-title"><h2>Ostatnie rozmowy</h2><span>{topics.length} tematów</span></div>{topics.length === 0 && !error && <div className="forum-panel"><h2>Zacznij pierwszą rozmowę</h2><p>Forum nie ma jeszcze tematów. Kliknij „Nowy temat”, aby opublikować pierwszy wpis.</p></div>}{topics.map(t => <article className="forum-topic-card" key={t.id}><div className="forum-topic-icon" aria-hidden="true">☰</div><div className="forum-topic-summary"><h2><Link to={`/forum/${t.id}`} onClick={() => { setMessage(''); setCommentFor(null) }}>{t.title}</Link></h2><div className="forum-post-meta"><strong>{t.signature}</strong>{t.pseudonym && <span className="forum-tag">pseudonim</span>}<time>{date(t.createdAt)}</time></div><p>{t.body.length > 125 ? `${t.body.slice(0, 125)}…` : t.body}</p><div className="forum-counts"><span>{t.answers.length} odpowiedzi</span><span>{t.answers.reduce((sum, a) => sum + a.comments.length, 0)} komentarzy</span></div></div>{admin && <button type="button" className="forum-delete" disabled={moderating} onClick={() => void remove(t, 'topic')}>Usuń temat</button>}</article>)}</section>}
    <footer className="forum-footer"><p>Forum jest dostępne wyłącznie dla aktywnych, uprawnionych członków. Przy pseudonimie rzeczywistą tożsamość autora może odczytać wyłącznie administrator.</p></footer>
  </div></section>
}
