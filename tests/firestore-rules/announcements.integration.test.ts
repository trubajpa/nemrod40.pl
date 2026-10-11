import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, type Firestore } from 'firebase/firestore'
import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest'
const holder = vi.hoisted(() => ({ db: null as Firestore | null, auth: { currentUser: { uid: 'member' } } }))
vi.mock('../../src/lib/firebase', () => ({ get db() { return holder.db }, auth: holder.auth }))
import { createPublication, addAnnouncementComment, toggleReaction, approvePublication } from '../../src/announcements/repository'
let env: RulesTestEnvironment
const announcement = () => ({ subject: 'Spotkanie', body: 'Zapraszamy.', kind: 'spotkanie', authorUid: 'member', authorName: 'Jan Testowy', createdAt: serverTimestamp(), placements: ['members', 'news', 'activity'], publicStatus: 'pending', ready: false, photos: [], mainPhoto: '', approvedBy: null, approvedAt: null })
const comment = () => ({ body: 'Będę.', authorUid: 'member', authorName: 'Jan Testowy', createdAt: serverTimestamp() })
const reaction = () => ({ uid: 'member', type: 'heart', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
const dbFor = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore()
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('Only local emulator permitted')
  env = await initializeTestEnvironment({ projectId: 'demo-nemrod40', firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    for (const [uid, active, role, displayName] of [['member', true, 'member', 'Jan Testowy'], ['other', true, 'member', 'Anna Testowa'], ['admin', true, 'admin', 'Admin'], ['inactive', false, 'member', 'Jan Testowy']] as const) await setDoc(doc(ctx.firestore(), 'authorizedUsers', `${uid}@example.test`), { active, role, displayName })
    await setDoc(doc(ctx.firestore(), 'announcements/post'), { ...announcement(), ready: true })
  })
  holder.db = dbFor('member'); holder.auth.currentUser.uid = 'member'
})
afterAll(async () => { await env.cleanup() })
it('członek tworzy wpis dla wielu miejsc; tylko admin zatwierdza publiczny odczyt, komentarze pozostają prywatne', async () => {
  const id = await createPublication('Wpis', 'Treść', 'aktualność', 'Jan Testowy', ['news', 'activity'])
  const anonymous = env.unauthenticatedContext().firestore()
  await assertFails(getDoc(doc(anonymous, 'announcements', id)))
  await assertFails(approvePublication(id))
  holder.db = dbFor('admin'); holder.auth.currentUser.uid = 'admin'; await approvePublication(id)
  await assertSucceeds(getDoc(doc(anonymous, 'announcements', id)))
  for (const placement of ['news', 'activity']) expect((await assertSucceeds(getDocs(query(collection(anonymous, 'announcements'), where('publicStatus', '==', 'approved'), where('ready', '==', true), where('placements', 'array-contains', placement))))).size).toBe(1)
  await assertFails(getDocs(collection(anonymous, 'announcements')))
  holder.db = dbFor('member'); holder.auth.currentUser.uid = 'member'
  await addAnnouncementComment(id, 'Dołączam.', 'Jan Testowy')
  await toggleReaction(id); expect((await getDocs(collection(holder.db!, 'announcements', id, 'reactions'))).size).toBe(1)
  await toggleReaction(id); expect((await getDocs(collection(holder.db!, 'announcements', id, 'reactions'))).size).toBe(0)
  await assertFails(getDocs(collection(anonymous, 'announcements', id, 'comments')))
  await assertFails(getDocs(collection(anonymous, 'announcements', id, 'reactions')))
})
it('prywatny wpis nie może być zatwierdzony; niegotowa galeria i zmiana zatwierdzonego wpisu są blokowane', async () => {
  const privateId = await createPublication('Prywatny', 'Treść', 'inne', 'Jan Testowy', ['members'])
  await setDoc(doc(holder.db!, 'announcements/draft'), announcement())
  const admin = dbFor('admin')
  for (const id of [privateId, 'draft']) await assertFails(updateDoc(doc(admin, 'announcements', id), { publicStatus: 'approved', approvedBy: 'admin', approvedAt: serverTimestamp() }))
  await assertFails(updateDoc(doc(holder.db!, 'announcements/post'), { publicStatus: 'approved', approvedBy: 'member', approvedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(doc(admin, 'announcements/post'), { publicStatus: 'approved', approvedBy: 'admin', approvedAt: serverTimestamp() }))
  await assertFails(updateDoc(doc(holder.db!, 'announcements/post'), { body: 'Zmieniona treść' }))
  await assertFails(updateDoc(doc(admin, 'announcements/post'), { photos: ['publications/post/secret.jpg'] }))
})
it('galeria ma kolejność i główne zdjęcie, nie pozwala na URL z tokenem ani cudze ścieżki', async () => {
  const db = holder.db!
  await setDoc(doc(db, 'announcements/gallery'), announcement())
  for (const photos of [['publications/other/secret.jpg'], ['https://example.test/photo?token=x'], Array.from({ length: 13 }, (_, i) => `publications/gallery/${i}.jpg`)]) await assertFails(updateDoc(doc(db, 'announcements/gallery'), { photos, mainPhoto: photos[0], ready: true }))
  await assertFails(updateDoc(doc(db, 'announcements/gallery'), { photos: ['publications/gallery/a.jpg'], mainPhoto: 'publications/gallery/other.jpg', ready: true }))
  await assertFails(updateDoc(doc(dbFor('other'), 'announcements/gallery'), { ready: true }))
  const photos = ['publications/gallery/b.jpg', 'publications/gallery/a.jpg']
  await assertSucceeds(updateDoc(doc(db, 'announcements/gallery'), { photos, mainPhoto: photos[1], ready: true }))
  expect((await getDoc(doc(db, 'announcements/gallery'))).data()?.photos).toEqual(photos)
})
it('blokuje podszywanie, cudze serduszka i odpowiedzi na komentarze', async () => {
  const db = holder.db!
  for (const change of [{ authorUid: 'other' }, { authorName: 'Anna Testowa' }, { createdAt: new Date(0) }]) {
    await assertFails(setDoc(doc(db, 'announcements/fake'), { ...announcement(), ...change }))
    await assertFails(setDoc(doc(db, 'announcements/post/comments/fake'), { ...comment(), ...change }))
  }
  await assertFails(setDoc(doc(db, 'announcements/post/reactions/other'), { ...reaction(), uid: 'other' }))
  await toggleReaction('post')
  await assertFails(deleteDoc(doc(dbFor('other'), 'announcements/post/reactions/member')))
  await assertFails(updateDoc(doc(dbFor('other'), 'announcements/post/reactions/member'), { type: 'heart', updatedAt: serverTimestamp() }))
  await assertFails(setDoc(doc(db, 'announcements/post/reactions/member'), { ...reaction(), type: 'up' }))
  await assertFails(setDoc(doc(db, 'announcements/post/comments/comment/replies/reply'), comment()))
})
it('nieaktywny, oczekujący i anonimowy nie czytają prywatnych danych ani nie zapisują wpisów', async () => {
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'authorizedUsers/member@example.test'), { active: false }))
  for (const db of [holder.db!, dbFor('pending'), dbFor('inactive'), env.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(doc(db, 'announcements/post')))
    await assertFails(getDocs(collection(db, 'announcements/post/comments')))
    await assertFails(getDocs(collection(db, 'announcements/post/reactions')))
    await assertFails(setDoc(doc(db, 'announcements/new'), announcement()))
    await assertFails(setDoc(doc(db, 'announcements/post/comments/new'), comment()))
    await assertFails(setDoc(doc(db, 'announcements/post/reactions/member'), reaction()))
  }
})
it('odrzuca nieprawidłowe rodzaje, długości, miejsca i fałszywe zatwierdzenia', async () => {
  for (const change of [{ kind: 'nieznany' }, { subject: '' }, { subject: 'x'.repeat(161) }, { body: 'x'.repeat(10001) }, { placements: ['news'] }, { placements: ['members', 'other'] }, { publicStatus: 'approved' }, { approvedBy: 'admin' }, { extra: true }]) await assertFails(setDoc(doc(holder.db!, 'announcements/bad'), { ...announcement(), ...change }))
  await assertFails(setDoc(doc(holder.db!, 'announcements/post/comments/bad'), { ...comment(), body: 'x'.repeat(2001) }))
})
it('migracja jest idempotentna, zachowuje ogłoszenia i dzieci oraz wszystkie sześć aktualności', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'announcements/old'), { subject: 'Historyczne', body: 'Tekst', kind: 'inne', authorUid: 'member', authorName: 'Jan Testowy', createdAt: new Date(1000) })
    await setDoc(doc(ctx.firestore(), 'announcements/old/comments/kept'), comment())
  })
  const run = () => promisify(execFile)(process.execPath, ['scripts/migrate-publications.mjs', '--project', 'demo-nemrod40', '--apply'], { env: process.env })
  expect((await run()).stdout).toContain('"archivedNews":6')
  expect((await run()).stdout).toContain('"archivedNews":0')
  expect((await getDocs(collection(holder.db!, 'announcements'))).size).toBe(8)
  const old = (await getDoc(doc(holder.db!, 'announcements/old'))).data()!
  expect(old.authorName).toBe('Jan Testowy'); expect(old.createdAt.toMillis()).toBe(1000); expect(old.publicStatus).toBe('private')
  expect((await getDoc(doc(holder.db!, 'announcements/old/comments/kept'))).exists()).toBe(true)
}, 60000)
