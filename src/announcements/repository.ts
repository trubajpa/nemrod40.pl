import { collection, doc, onSnapshot, query, where, addDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { kinds, normalizePublication, mergeArchive, type Kind, type Placement, type Publication } from './model'
import { uploadPublicationPhoto } from './photos'
export { kinds }
export type { Kind }
export type Announcement = Publication
export type Reaction = 'heart'
export interface Comment { id: string; body: string; authorName: string; createdAt: number }
export interface Vote { uid: string; type: string }
const uid = () => { if (!auth.currentUser) throw new Error('Zaloguj się ponownie.'); return auth.currentUser.uid }
const time = (value: { toMillis?: () => number } | undefined) => value?.toMillis?.() ?? 0
export function subscribePublications(placement: Placement, member: boolean, next: (rows: Publication[]) => void, error: () => void) {
  const source = member ? collection(db, 'announcements') : query(collection(db, 'announcements'), where('publicStatus', '==', 'approved'), where('ready', '==', true), where('placements', 'array-contains', placement))
  return onSnapshot(source, snapshot => next(mergeArchive(snapshot.docs.map(row => normalizePublication(row.id, row.data())), placement)), error)
}
export function subscribeAnnouncements(next: (rows: Publication[]) => void, error: () => void) {
  return subscribePublications('members', true, next, error)
}
export function subscribeDetails(id: string, comments: (rows: Comment[]) => void, votes: (rows: Vote[]) => void, error: () => void) {
  const stopComments = onSnapshot(collection(db, 'announcements', id, 'comments'), snapshot => comments(snapshot.docs.map(row => ({ ...row.data(), id: row.id, createdAt: time(row.data().createdAt) }) as Comment).sort((a, b) => a.createdAt - b.createdAt)), error)
  const stopVotes = onSnapshot(collection(db, 'announcements', id, 'reactions'), snapshot => votes(snapshot.docs.map(row => ({ uid: row.id, type: row.data().type }))), error)
  return () => { stopComments(); stopVotes() }
}
export async function createPublication(subject: string, body: string, kind: Kind, authorName: string, placements: Placement[], files: File[] = [], mainIndex = 0) {
  if (files.length > 12) throw new Error('Maksymalnie 12 zdjęć.')
  const selected = [...new Set<Placement>(['members', ...placements])]
  const ref = await addDoc(collection(db, 'announcements'), { subject: subject.trim(), body: body.trim(), kind, authorName, authorUid: uid(), createdAt: serverTimestamp(), placements: selected, publicStatus: selected.some(value => value !== 'members') ? 'pending' : 'private', photos: [], mainPhoto: '', ready: false, approvedBy: null, approvedAt: null })
  const photos: string[] = []
  for (const file of files) photos.push(await uploadPublicationPhoto(ref.id, file))
  await updateDoc(ref, { photos, mainPhoto: photos[mainIndex] ?? '', ready: true })
  return ref.id
}
export async function createAnnouncement(subject: string, body: string, kind: Kind, authorName: string) {
  return createPublication(subject, body, kind, authorName, ['members'])
}
export async function approvePublication(id: string) {
  await updateDoc(doc(db, 'announcements', id), { publicStatus: 'approved', approvedBy: uid(), approvedAt: serverTimestamp() })
}
export async function addAnnouncementComment(id: string, body: string, authorName: string) {
  await addDoc(collection(db, 'announcements', id, 'comments'), { body: body.trim(), authorName, authorUid: uid(), createdAt: serverTimestamp() })
}
export async function toggleReaction(id: string, type: Reaction = 'heart') {
  const userUid = uid(), ref = doc(db, 'announcements', id, 'reactions', userUid)
  await runTransaction(db, async transaction => {
    const existing = await transaction.get(ref)
    if (existing.exists() && existing.data().type === type) transaction.delete(ref)
    else transaction.set(ref, { uid: userUid, type, createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() })
  })
}
