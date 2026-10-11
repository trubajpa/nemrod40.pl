import { useEffect, useState } from 'react'
import { publicationPhotoUrl } from './photos'
export function PublicationPhoto({ path, alt }: { path: string; alt: string }) {
  const [resolved, setResolved] = useState({ path: '', url: '' })
  useEffect(() => {
    let alive = true, current = ''
    publicationPhotoUrl(path).then(value => { current = value; if (alive) setResolved({ path, url: value }); else if (value.startsWith('blob:')) URL.revokeObjectURL(value) }).catch(() => { if (alive) setResolved({ path, url: '' }) })
    return () => { alive = false; if (current.startsWith('blob:')) URL.revokeObjectURL(current) }
  }, [path])
  return resolved.path === path && resolved.url ? <img src={resolved.url} alt={alt} loading="lazy" /> : <span role="status">Zdjęcie niedostępne</span>
}
