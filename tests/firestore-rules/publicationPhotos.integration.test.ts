import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getBytes } from 'firebase/storage'
import { beforeAll, beforeEach, afterAll, it } from 'vitest'
let env: RulesTestEnvironment
let serial = 0, postId = ''
beforeAll(async () => {
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') throw Error('Only local Storage emulator permitted')
  env = await initializeTestEnvironment({ projectId: 'demo-nemrod40', firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') }, storage: { host: '127.0.0.1', port: 9199, rules: await readFile('storage.rules', 'utf8') } })
})
const ctx = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.test` })
beforeEach(async () => {
  postId = `post${++serial}`
  await env.clearFirestore(); await env.clearStorage()
  await env.withSecurityRulesDisabled(async context => {
    for (const uid of ['member', 'other', 'admin']) await setDoc(doc(context.firestore(), 'authorizedUsers', `${uid}@example.test`), { active: true, role: uid === 'admin' ? 'admin' : 'member' })
    await setDoc(doc(context.firestore(), `announcements/${postId}`), { authorUid: 'member', ready: false, publicStatus: 'pending', placements: ['members', 'news'], photos: [], mainPhoto: '' })
  })
})
afterAll(async () => { await env.clearStorage(); await env.clearFirestore(); await env.cleanup() })
it('prywatne zdjęcia są chronione, publiczny odczyt dopiero po zatwierdzeniu i tylko dla zdjęć galerii', async () => {
  const path = `publications/${postId}/photo.jpg`, unused = `publications/${postId}/unused.jpg`
  for (const file of [path, unused]) await assertSucceeds(uploadBytes(ref(ctx('member').storage(), file), new Uint8Array([1]), { contentType: 'image/jpeg' }))
  await assertSucceeds(getBytes(ref(ctx('other').storage(), path)))
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)))
  await updateDoc(doc(ctx('member').firestore(), `announcements/${postId}`), { photos: [path], mainPhoto: path, ready: true })
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)))
  await updateDoc(doc(ctx('admin').firestore(), `announcements/${postId}`), { publicStatus: 'approved', approvedBy: 'admin', approvedAt: (await import('firebase/firestore')).serverTimestamp() })
  await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), path)))
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), unused)))
})
it('nikt nie nadpisuje zdjęć; cudzy autor, błędny typ i zbyt duży plik są blokowane', async () => {
  const path = `publications/${postId}/photo.jpg`
  await assertFails(uploadBytes(ref(ctx('other').storage(), path), new Uint8Array([1]), { contentType: 'image/jpeg' }))
  await assertFails(uploadBytes(ref(ctx('member').storage(), `publications/${postId}/text.txt`), new Uint8Array([1]), { contentType: 'text/plain' }))
  await assertFails(uploadBytes(ref(ctx('member').storage(), `publications/${postId}/large.jpg`), new Uint8Array(10 * 1024 * 1024 + 1), { contentType: 'image/jpeg' }))
  await assertSucceeds(uploadBytes(ref(ctx('member').storage(), path), new Uint8Array([1]), { contentType: 'image/jpeg' }))
  await assertFails(uploadBytes(ref(ctx('member').storage(), path), new Uint8Array([2]), { contentType: 'image/jpeg' }))
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'authorizedUsers/member@example.test'), { active: false }))
  await assertFails(getBytes(ref(ctx('member').storage(), path)))
  await assertFails(uploadBytes(ref(ctx('member').storage(), `publications/${postId}/another.jpg`), new Uint8Array([1]), { contentType: 'image/jpeg' }))
})
