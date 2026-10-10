import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadCircleMembers, searchName, type CircleMember } from '../members/directory'
import './circleMembers.css'

export function CircleMembersPage() {
  const [members, setMembers] = useState<CircleMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    let alive = true
    loadCircleMembers().then(list => { if (alive) setMembers(list) }).catch(() => {
      if (alive) setError('Nie udało się pobrać listy członków. Spróbuj ponownie później.')
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  const search = searchName(query)
  const visible = members.filter(person => searchName(`${person.firstName} ${person.lastName}`).includes(search))
  return <section className="member-page"><div className="container member-shell">
    <Link className="public-back-link" to="/panel">← Strefa członkowska</Link>
    <header className="member-header"><span className="eyebrow">Nasze koło</span><h1>Członkowie koła</h1><p>Lista w kolejności alfabetycznej według nazwiska.</p></header>
    {loading ? <p role="status">Wczytujemy listę członków…</p> : error ? <p role="alert">{error}</p> : <>
      <label className="circle-members-search">Szukaj po imieniu lub nazwisku<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <p role="status">Wyświetlono {visible.length} z {members.length} osób.</p>
      {visible.length ? <ul className="circle-members-list" aria-label="Członkowie koła">{visible.map(person => <li key={`${person.lastName}-${person.firstName}`}>{person.firstName} {person.lastName}</li>)}</ul> : <p>Brak osób pasujących do wyszukiwania.</p>}
    </>}
  </div></section>
}
