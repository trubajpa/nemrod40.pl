import { news } from '../data/news'
export const kinds = ['impreza', 'spotkanie', 'ustalenie', 'czyn', 'aktualność', 'inne'] as const
export type Kind = typeof kinds[number]
export type Placement = 'news' | 'activity' | 'members'
export interface Publication {
  id: string; subject: string; body: string; kind: Kind; authorName: string; createdAt: number
  placements: Placement[]; publicStatus: 'private' | 'pending' | 'approved'; photos: string[]; mainPhoto: string
  ready: boolean; legacySlug?: string; dateLabel?: string; video?: string; category?: string; lead?: string
}
export const archive: Publication[] = news.map(item => ({
  id: `legacy-${item.slug}`, legacySlug: item.slug, subject: item.title,
  body: item.description, lead: item.lead, category: item.category, dateLabel: item.date,
  kind: 'aktualność', authorName: 'Koło Łowieckie nr 40 „Nemrod”', createdAt: 0,
  placements: ['news', 'members'], publicStatus: 'approved', ready: true,
  photos: [...new Set([item.image, ...item.gallery.map(photo => photo.src)])], mainPhoto: item.image, video: item.video,
}))
export function normalizePublication(id: string, data: Record<string, unknown>): Publication {
  const stamp = data.createdAt as { toMillis?: () => number } | undefined
  return { ...data, id, createdAt: stamp?.toMillis?.() ?? 0, placements: data.placements ?? ['members'], publicStatus: data.publicStatus ?? 'private', photos: data.photos ?? [], mainPhoto: data.mainPhoto ?? '', ready: data.ready ?? true } as Publication
}
export function mergeArchive(rows: Publication[], placement: Placement) {
  const byId = new Map(archive.filter(row => row.placements.includes(placement)).map(row => [row.id, row]))
  for (const row of rows) if (row.ready && row.placements.includes(placement)) byId.set(row.legacySlug ? `legacy-${row.legacySlug}` : row.id, row)
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
}
