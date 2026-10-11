import { collection, doc, onSnapshot, orderBy, query, limit, addDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

export const kinds = ['impreza', 'spotkanie', 'ustalenie', 'czyn', 'inne'] as const
export type Kind = typeof kinds[number]
export type Reaction = 'heart' | 'up' | 'down'
export interface Announcement { id: string; subject: string; body: string; kind: Kind; authorName: string; createdAt: number }
export interface Comment { id: string; body: string; authorName: string; createdAt: number }
export interface Vote { uid: string; type: Reaction }
const uid = () => { if (!auth.currentUser) throw new Error('Zaloguj się ponownie.'); return auth.currentUser.uid }
const time = (value: { toMillis?: () => number } | undefined) => value?.toMillis?.() ?? 0
export function subscribeAnnouncements(next: (rows: Announcement[]) => void, error: () => void) {
  return onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50)), snapshot => next(snapshot.docs.map(row => ({ ...row.data(), id: row.id, createdAt: time(row.data().createdAt) }) as Announcement)), error)
}
export function subscribeDetails(id: string, comments: (rows: Comment[]) => void, votes: (rows: Vote[]) => void, error: () => void) {
  const stopComments = onSnapshot(query(collection(db, 'announcements', id, 'comments'), orderBy('createdAt')), snapshot => comments(snapshot.docs.map(row => ({ ...row.data(), id: row.id, createdAt: time(row.data().createdAt) }) as Comment)), error)
  const stopVotes = onSnapshot(collection(db, 'announcements', id, 'reactions'), snapshot => votes(snapshot.docs.map(row => ({ uid: row.id, type: row.data().type }))), error)
  return () => { stopComments(); stopVotes() }
}
export async function createAnnouncement(subject: string, body: string, kind: Kind, authorName: string) {
  await addDoc(collection(db, 'announcements'), { subject: subject.trim(), body: body.trim(), kind, authorName, authorUid: uid(), createdAt: serverTimestamp() })
}
export async function addAnnouncementComment(id: string, body: string, authorName: string) {
  await addDoc(collection(db, 'announcements', id, 'comments'), { body: body.trim(), authorName, authorUid: uid(), createdAt: serverTimestamp() })
}
export async function toggleReaction(id: string, type: Reaction) {
  const userUid = uid(), ref = doc(db, 'announcements', id, 'reactions', userUid)
  await runTransaction(db, async transaction => {
    const existing = await transaction.get(ref)
    if (existing.exists() && existing.data().type === type) transaction.delete(ref)
    else transaction.set(ref, { uid: userUid, type, createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() })
  })
}
