import { useId, useState, type FormEvent } from 'react'
import type { PostInput } from './models'

export function PostForm({ profileName, label, topic = false, onPublish, onCancel }: {
  profileName: string; label: string; topic?: boolean; onPublish: (post: PostInput, title: string) => Promise<void>; onCancel?: () => void;
}) {
  const id = useId()
  const [title, setTitle] = useState(''), [body, setBody] = useState('')
  const [mode, setMode] = useState('profile'), [nickname, setNickname] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if ((topic && !title.trim()) || !body.trim() || (mode === 'nickname' && !nickname.trim())) { setError('Uzupełnij treść, tytuł tematu i wybrany podpis.'); return }
    if (busy) return
    setBusy(true); setError('')
    try {
      await onPublish({ body: body.trim(), signature: mode === 'nickname' ? nickname.trim() : profileName, pseudonym: mode === 'nickname' }, title.trim())
      setTitle(''); setBody(''); setNickname('')
    } catch { setError('Nie udało się opublikować wpisu. Sprawdź połączenie i aktualne uprawnienia. Treść pozostała w formularzu.') }
    finally { setBusy(false) }
  }
  return <form className="forum-form" onSubmit={submit}>
    {topic && <label htmlFor={`${id}-title`}>Tytuł<input id={`${id}-title`} value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} placeholder="O czym chcesz porozmawiać?" /></label>}
    <label htmlFor={`${id}-body`}>Treść<textarea id={`${id}-body`} value={body} onChange={e => setBody(e.target.value)} required maxLength={6000} rows={topic ? 5 : 3} placeholder={topic ? 'Rozpocznij rozmowę…' : 'Napisz swoją wiadomość…'} /></label>
    <fieldset><legend>Podpis pod tym wpisem</legend><label className="forum-choice"><input type="radio" name={`${id}-signature`} checked={mode === 'profile'} onChange={() => setMode('profile')} />Imię i nazwisko: {profileName}</label><label className="forum-choice"><input type="radio" name={`${id}-signature`} checked={mode === 'nickname'} onChange={() => setMode('nickname')} />Pseudonim</label>
      {mode === 'nickname' && <><label htmlFor={`${id}-nickname`}>Twój pseudonim<input id={`${id}-nickname`} value={nickname} onChange={e => setNickname(e.target.value)} required maxLength={50} autoComplete="off" /></label><p className="forum-pseudonym-note">Publikujesz pod pseudonimem. Administrator może ustalić autora wpisu</p></>}
    </fieldset>{error && <p role="alert" className="forum-error">{error}</p>}
    <div className="forum-actions"><button className="button" type="submit" disabled={busy}>{busy ? 'Publikowanie…' : label}</button>{onCancel && <button className="button outline" type="button" disabled={busy} onClick={onCancel}>Anuluj</button>}</div>
  </form>
}
