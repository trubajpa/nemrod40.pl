import { useState, type FormEvent } from 'react'
import { createPublication, kinds } from './repository'
import type { Kind, Placement } from './model'
import { photoStorageEnabled } from '../devices/photoStorage'
export function PublicationForm({ name }: { name: string }) {
  const [subject, setSubject] = useState(''), [body, setBody] = useState(''), [kind, setKind] = useState<Kind>('inne')
  const [placements, setPlacements] = useState<Placement[]>(['members']), [files, setFiles] = useState<File[]>([]), [main, setMain] = useState<File | null>(null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const requested = placements.some(value => value !== 'members')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !subject.trim() || !body.trim()) return
    setBusy(true); setMessage('')
    try {
      await createPublication(subject, body, kind, name, placements, files, Math.max(0, files.indexOf(main!)))
      setSubject(''); setBody(''); setFiles([]); setMain(null); setMessage(requested ? 'Wpis dostępny dla członków. Publikacja publiczna oczekuje na zatwierdzenie administratora.' : 'Wpis dostępny tylko dla zalogowanych członków.')
    } catch { setMessage('Nie udało się zapisać wpisu lub zdjęć. Wpis nie został opublikowany; spróbuj ponownie.') }
    finally { setBusy(false) }
  }
  function move(index: number, step: number) {
    setFiles(current => { const copy = [...current]; [copy[index], copy[index + step]] = [copy[index + step], copy[index]]; return copy })
  }
  return <form className="announcement-card" onSubmit={event => void submit(event)}><h2>Dodaj wpis</h2>
    <label>Tytuł<input value={subject} onChange={event => setSubject(event.target.value)} required maxLength={160} disabled={busy} /></label>
    <label>Typ<select value={kind} onChange={event => setKind(event.target.value as Kind)} disabled={busy}>{kinds.map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Treść<textarea value={body} onChange={event => setBody(event.target.value)} required maxLength={10000} disabled={busy} /></label>
    <fieldset disabled={busy}><legend>Miejsca wyświetlania</legend><label><input type="checkbox" checked disabled />Informacje dla członków</label>{([['news', 'Aktualności'], ['activity', 'Działalność']] as const).map(([value, label]) => <label key={value}><input type="checkbox" checked={placements.includes(value)} onChange={event => setPlacements(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{label}</label>)}</fieldset>
    <p role="status">{requested ? 'Publikacja publiczna wymaga zatwierdzenia administratora. Do tego czasu wpis i zdjęcia zobaczą tylko zalogowani członkowie.' : 'Tylko dla zalogowanych — wpis i zdjęcia nie będą publiczne.'}</p>
    <label>Zdjęcia (maksymalnie 12)<input key={files.length ? 'selected' : 'empty'} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || !photoStorageEnabled} onChange={event => {
      const selected = Array.from(event.target.files ?? [])
      if (selected.length + files.length > 12 || selected.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024)) { setMessage('Wybierz do 12 zdjęć JPG, PNG lub WebP, każde do 10 MB.'); return }
      setFiles(current => [...current, ...selected]); if (!main) setMain(selected[0] ?? null)
    }} /></label>
    {!photoStorageEnabled && <p>Przesyłanie zdjęć jest wyłączone w tej konfiguracji.</p>}
    <ol>{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span> <label><input type="radio" name="main-photo" checked={main === file} disabled={busy} onChange={() => setMain(file)} />Zdjęcie główne</label><button type="button" aria-label={`Przesuń ${file.name} wcześniej`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Przesuń ${file.name} później`} disabled={busy || index === files.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" disabled={busy} onClick={() => { setFiles(current => current.filter((_, i) => i !== index)); if (main === file) setMain(files.find((_, i) => i !== index) ?? null) }}>Usuń zdjęcie</button></li>)}</ol>
    <button className="button" disabled={busy || !subject.trim() || !body.trim()}>{busy ? 'Zapisywanie wpisu i zdjęć…' : 'Zapisz wpis'}</button>{message && <p role="status">{message}</p>}
  </form>
}
