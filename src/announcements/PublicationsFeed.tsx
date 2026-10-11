import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { archive, type Placement, type Publication } from './model'
import { subscribePublications } from './repository'
import { PublicationPhoto } from './PublicationPhoto'
import './announcements.css'
export function PublicationsFeed({ placement, compact = false }: { placement: Placement; compact?: boolean }) {
  const [items, setItems] = useState<Publication[]>(archive.filter(item => item.placements.includes(placement)))
  const [error, setError] = useState('')
  useEffect(() => subscribePublications(placement, false, setItems, () => setError('Nowe wpisy są chwilowo niedostępne.')), [placement])
  return <div className="publications-feed">{error && <p role="status">{error}</p>}{(compact ? items.slice(0, 3) : items).map(item => item.legacySlug ? <article className="news-card" key={item.id}><Link to={`/aktualnosci/${item.legacySlug}`}><div className="card-image"><PublicationPhoto path={item.mainPhoto} alt={item.subject} /></div><div className="card-body"><div className="meta"><span>{item.category ?? item.kind}</span><time>{item.dateLabel}</time></div><h3>{item.subject}</h3><p>{item.lead ?? item.body}</p><span className="text-link">Czytaj więcej →</span></div></Link></article> : <article className="announcement-card" key={item.id}><span className="eyebrow">{item.kind}</span><h2>{item.subject}</h2><p>{item.authorName} · {new Date(item.createdAt).toLocaleDateString('pl-PL')}</p>{item.mainPhoto && <PublicationPhoto path={item.mainPhoto} alt={item.subject} />}<p className="announcement-body">{item.body}</p>{!compact && <div className="publication-gallery">{item.photos.filter(path => path !== item.mainPhoto).map(path => <PublicationPhoto key={path} path={path} alt={item.subject} />)}</div>}</article>)}</div>
}
