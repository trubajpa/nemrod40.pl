import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, type Firestore } from 'firebase/firestore'
import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest'
const holder = vi.hoisted(() => ({ db: null as Firestore | null, auth: { currentUser: { uid: 'member' } } }))
vi.mock('../../src/lib/firebase', () => ({ get db() { return holder.db }, auth: holder.auth }))
import { createAnnouncement, addAnnouncementComment, toggleReaction } from '../../src/announcements/repository'
let env: RulesTestEnvironment
const announcement = () => ({ subject: 'Spotkanie', body: 'Zapraszamy.', kind: 'spotkanie', authorUid: 'member', authorName: 'Jan Testowy', createdAt: serverTimestamp() })
const comment = () => ({ body: 'Będę.', authorUid: 'member', authorName: 'Jan Testowy', createdAt: serverTimestamp() })
const reaction = () => ({ uid: 'member', type: 'heart', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nemrod40', firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'authorizedUsers/member@example.test'), { active: true, role: 'member', displayName: 'Jan Testowy' })
    await setDoc(doc(ctx.firestore(), 'authorizedUsers/other@example.test'), { active: true, role: 'member', displayName: 'Anna Testowa' })
    await setDoc(doc(ctx.firestore(), 'authorizedUsers/inactive@example.test'), { active: false, role: 'member', displayName: 'Jan Testowy' })
    await setDoc(doc(ctx.firestore(), 'announcements/post'), announcement())
  })
  holder.db = env.authenticatedContext('member', { email: 'member@example.test' }).firestore()
})
afterAll(async () => { await env.cleanup() })
it('rzeczywisty zapis ogłoszenia i komentarza oraz dodanie, zmiana i cofnięcie wszystkich trzech reakcji', async () => {
  const db = holder.db!
  await createAnnouncement('Czyn', 'Wspólna praca.', 'czyn', 'Jan Testowy')
  const posts = await getDocs(collection(db, 'announcements'))
  expect(posts.size).toBe(2)
  const id = posts.docs.find(row => row.id !== 'post')!.id
  await addAnnouncementComment(id, 'Dołączam.', 'Jan Testowy')
  expect((await getDocs(collection(db, 'announcements', id, 'comments'))).size).toBe(1)
  for (const type of ['heart', 'up', 'down'] as const) {
    await toggleReaction(id, type)
    expect((await getDoc(doc(db, 'announcements', id, 'reactions/member'))).data()?.type).toBe(type)
    expect((await getDocs(collection(db, 'announcements', id, 'reactions'))).size).toBe(1)
    await toggleReaction(id, type)
    expect((await getDoc(doc(db, 'announcements', id, 'reactions/member'))).exists()).toBe(false)
  }
  await toggleReaction(id, 'heart'); await toggleReaction(id, 'up')
  expect((await getDocs(collection(db, 'announcements', id, 'reactions'))).size).toBe(1)
  expect((await getDoc(doc(db, 'announcements', id, 'reactions/member'))).data()?.type).toBe('up')
})
it('nie pozwala podszyć się pod autora ani UID reakcji, zmienić lub cofnąć cudzej reakcji', async () => {
  const db = holder.db!
  for (const change of [{ authorUid: 'other' }, { authorName: 'Anna Testowa' }, { createdAt: new Date(0) }]) {
    await assertFails(setDoc(doc(db, 'announcements/fake'), { ...announcement(), ...change }))
    await assertFails(setDoc(doc(db, 'announcements/post/comments/fake'), { ...comment(), ...change }))
  }
  await assertFails(setDoc(doc(db, 'announcements/post/reactions/other'), { ...reaction(), uid: 'other' }))
  await assertFails(setDoc(doc(db, 'announcements/post/reactions/member'), { ...reaction(), uid: 'other' }))
  await assertSucceeds(setDoc(doc(db, 'announcements/post/reactions/member'), reaction()))
  const other = env.authenticatedContext('other', { email: 'other@example.test' }).firestore()
  await assertFails(updateDoc(doc(other, 'announcements/post/reactions/member'), { type: 'down', updatedAt: serverTimestamp() }))
  await assertFails(deleteDoc(doc(other, 'announcements/post/reactions/member')))
  await assertSucceeds(setDoc(doc(other, 'announcements/post/reactions/other'), { ...reaction(), uid: 'other' }))
  expect((await getDocs(collection(db, 'announcements/post/reactions'))).size).toBe(2)
})
it('blokuje odczyty i zapisy anonimowych, oczekujących i nieaktywnych, także po odebraniu dostępu', async () => {
  await setDoc(doc(holder.db!, 'announcements/post/comments/comment'), comment())
  await toggleReaction('post', 'heart')
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'authorizedUsers/member@example.test'), { active: false }))
  for (const db of [holder.db!, env.unauthenticatedContext().firestore(), env.authenticatedContext('pending', { email: 'pending@example.test' }).firestore(), env.authenticatedContext('inactive', { email: 'inactive@example.test' }).firestore()]) {
    for (const path of ['announcements', 'announcements/post/comments', 'announcements/post/reactions']) await assertFails(getDocs(collection(db, path)))
    for (const path of ['announcements/post', 'announcements/post/comments/comment', 'announcements/post/reactions/member']) await assertFails(getDoc(doc(db, path)))
    await assertFails(setDoc(doc(db, 'announcements/new'), announcement()))
    await assertFails(setDoc(doc(db, 'announcements/post/comments/new'), comment()))
    await assertFails(setDoc(doc(db, 'announcements/post/reactions/member'), reaction()))
    await assertFails(deleteDoc(doc(db, 'announcements/post/reactions/member')))
  }
})
it('odrzuca błędny schemat, typ, treść, daty i odpowiedzi na komentarze', async () => {
  const db = holder.db!
  for (const change of [{ kind: 'nieznany' }, { subject: '' }, { subject: 'x'.repeat(161) }, { body: '' }, { body: 'x'.repeat(10001) }, { extra: true }]) await assertFails(setDoc(doc(db, 'announcements/bad'), { ...announcement(), ...change }))
  for (const change of [{ body: '' }, { body: 'x'.repeat(2001) }, { parentId: 'comment' }]) await assertFails(setDoc(doc(db, 'announcements/post/comments/bad'), { ...comment(), ...change }))
  await assertFails(setDoc(doc(db, 'announcements/missing/comments/bad'), comment()))
  await assertFails(setDoc(doc(db, 'announcements/post/comments/comment/replies/reply'), comment()))
  for (const change of [{ type: 'invalid' }, { createdAt: new Date(0) }, { updatedAt: new Date(0) }, { extra: true }]) await assertFails(setDoc(doc(db, 'announcements/post/reactions/member'), { ...reaction(), ...change }))
  await assertFails(setDoc(doc(db, 'announcements/missing/reactions/member'), reaction()))
  await toggleReaction('post', 'heart')
  await assertFails(updateDoc(doc(db, 'announcements/post/reactions/member'), { createdAt: new Date(0), updatedAt: serverTimestamp() }))
  await assertFails(updateDoc(doc(db, 'announcements/post'), { authorUid: 'other' }))
})
