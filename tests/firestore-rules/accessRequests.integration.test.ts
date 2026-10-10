import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest'
const holder = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../../src/lib/firebase', () => ({ get db() { return holder.db } }))
import { submitAccessRequest } from '../../src/auth/accessRequests'
let env: RulesTestEnvironment
const email = 'applicant@example.test', uid = 'applicant'
const applicant = () => env.authenticatedContext(uid, { email, email_verified: true, name: 'Jan Testowy', firebase: { sign_in_provider: 'google.com' } }).firestore()
const googleUser = { uid, email, getIdTokenResult: async () => ({ signInProvider: 'google.com', claims: { name: 'Jan Testowy' } }) } as unknown as User
const pending = () => ({ uid, email, displayName: 'Jan Testowy', requestedAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'pending', reviewedAt: null, reviewedBy: null })
const admin = () => env.authenticatedContext('admin', { email: 'admin@example.test' }).firestore()
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-nemrod40', firestore: { rules: await readFile('firestore.rules','utf8'), host:'127.0.0.1', port:8080 } }) })
afterEach(async () => { await env.clearFirestore() })
afterAll(async () => { await env.cleanup() })
async function seed() { await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(),'authorizedUsers/admin@example.test'), { active:true, role:'admin', displayName:'Admin' }); await setDoc(doc(ctx.firestore(),'devices/private'), { active:true }); }) }
describe('Wnioski o dostęp i klient bez uprawnień administracyjnych', () => {
 it('ponowne logowanie aktualizuje ten sam wniosek bez duplikatu', async () => {
  await seed(); holder.db=applicant(); await submitAccessRequest(googleUser)
  const first=(await getDoc(doc(holder.db,'accessRequests',uid))).data()!
  await submitAccessRequest(googleUser)
  expect((await getDoc(doc(holder.db,'accessRequests',uid))).data()!.requestedAt).toEqual(first.requestedAt)
  expect((await getDocs(collection(admin(),'accessRequests'))).size).toBe(1)
  await assertFails(getDoc(doc(holder.db,'devices/private')))
 })
 it('blokuje podszycie UID, e-mail, nazwę, samodzielne zatwierdzenie i zapis uprawnień nawet z klienta admina', async () => {
  await seed(); const db=applicant()
  await assertFails(setDoc(doc(db,'accessRequests/other'),pending()))
  for(const change of [{uid:'other'}, {email:'other@example.test'}, {displayName:'Fałszywa nazwa'}, {status:'approved'}, {role:'admin'}]) await assertFails(setDoc(doc(db,'accessRequests',uid),{...pending(),...change}))
  await assertSucceeds(setDoc(doc(db,'accessRequests',uid),pending()))
  await assertFails(getDoc(doc(db,'accessRequests/other')))
  await assertFails(getDocs(collection(db,'accessRequests')))
  await assertFails(updateDoc(doc(db,'accessRequests',uid),{status:'approved',reviewedBy:uid,reviewedAt:serverTimestamp()}))
  for(const caller of [db,admin()]) for(const role of ['admin','member']) await assertFails(setDoc(doc(caller,'authorizedUsers',email),{active:true,role,displayName:'Jan'}))
  await assertFails(updateDoc(doc(admin(),'accessRequests',uid),{status:'approved',reviewedBy:'admin',reviewedAt:serverTimestamp()}))
  await assertFails(setDoc(doc(db,'authorizationControl/adminLock'),{revision:1}))
  await assertFails(setDoc(doc(db,'authorizationAudit/fake'),{actorUid:'admin'}))
 })
 it.each(['approved','revoked'])('po odebraniu dostępu poprzedni wniosek %s nie blokuje nowego', async status => {
  await seed(); await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(),'accessRequests',uid),{...pending(),status,reviewedBy:'admin',reviewedAt:serverTimestamp()})
    await setDoc(doc(ctx.firestore(),'authorizedUsers',email),{active:false,role:'member',displayName:'Jan'})
  })
  holder.db=applicant(); expect(await submitAccessRequest(googleUser)).toBe('pending')
  expect((await getDoc(doc(holder.db,'accessRequests',uid))).data()!.reviewedBy).toBeNull()
  await assertFails(getDoc(doc(holder.db,'devices/private')))
 })
 it('aktywny członek nie może otworzyć ponownie wniosku ani nadać sobie roli',async()=>{
  await seed(); await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'accessRequests',uid),{...pending(),status:'approved'});await setDoc(doc(ctx.firestore(),'authorizedUsers',email),{active:true,role:'member',displayName:'Jan'})})
  holder.db=applicant();await expect(submitAccessRequest(googleUser)).rejects.toBeDefined()
  await assertFails(updateDoc(doc(holder.db,'authorizedUsers',email),{role:'admin'}))
  await assertFails(getDocs(collection(holder.db,'authorizationAudit')))
 })
 it('odrzucony wniosek i brak dostępu pozostają, anonimowy nie odczytuje wniosków', async () => {
  await seed();await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'accessRequests',uid),{...pending(),status:'rejected'}))
  holder.db=applicant();expect(await submitAccessRequest(googleUser)).toBe('rejected')
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'accessRequests')))
  const password=env.authenticatedContext('password',{email,email_verified:true,firebase:{sign_in_provider:'password'}}).firestore()
  await assertFails(setDoc(doc(password,'accessRequests/password'),{...pending(),uid:'password'}))
 })
})
