import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest'
const holder = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../../src/lib/firebase', () => ({ get db() { return holder.db } }))
import { submitAccessRequest, reviewAccessRequest } from '../../src/auth/accessRequests'
let env: RulesTestEnvironment
const email = 'applicant@example.test', uid = 'applicant'
const applicant = () => env.authenticatedContext(uid, { email, email_verified: true, name: 'Jan Testowy', firebase: { sign_in_provider: 'google.com' } }).firestore()
const googleUser = { uid, email, getIdTokenResult: async () => ({ signInProvider: 'google.com', claims: { name: 'Jan Testowy' } }) } as unknown as User
const pending = () => ({ uid, email, displayName: 'Jan Testowy', requestedAt: serverTimestamp(), updatedAt: serverTimestamp(), status: 'pending', reviewedAt: null, reviewedBy: null })
const admin = () => env.authenticatedContext('admin', { email: 'admin@example.test' }).firestore()
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-nemrod40', firestore: { rules: await readFile('firestore.rules','utf8'), host:'127.0.0.1', port:8080 } }) })
afterEach(async () => { await env.clearFirestore() })
afterAll(async () => { await env.cleanup() })
async function seedAdmin() { await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(),'authorizedUsers/admin@example.test'), { active:true, role:'admin', displayName:'Admin' }); await setDoc(doc(ctx.firestore(),'devices/private'), { active:true }); }) }
describe('Wnioski o dostęp', () => {
 it('zgłoszenie → zatwierdzenie → dostęp członka, ponowne logowanie bez duplikatu', async () => {
  await seedAdmin(); holder.db = applicant()
  await submitAccessRequest(googleUser)
  const first = (await getDoc(doc(holder.db,'accessRequests',uid))).data()!
  await submitAccessRequest(googleUser)
  expect((await getDoc(doc(holder.db,'accessRequests',uid))).data()!.requestedAt).toEqual(first.requestedAt)
  await assertFails(getDoc(doc(holder.db,'devices/private')))
  holder.db = admin(); expect((await getDocs(collection(holder.db,'accessRequests'))).size).toBe(1)
  await reviewAccessRequest(uid,'approved','admin')
  expect((await getDoc(doc(holder.db,'accessRequests',uid))).data()!.status).toBe('approved')
  holder.db = applicant()
  expect((await getDoc(doc(holder.db,'authorizedUsers',email))).data()).toEqual({ active:true, role:'member', displayName:'Jan Testowy' })
  await assertSucceeds(getDoc(doc(holder.db,'devices/private')))
  await assertFails(getDocs(collection(holder.db,'accessRequests')))
 })
 it('blokuje podszycie UID, e-mail, nazwę, samodzielne zatwierdzenie i rolę admin', async () => {
  await seedAdmin(); const db=applicant()
  await assertFails(setDoc(doc(db,'accessRequests/other'),pending()))
  for(const change of [{uid:'other'}, {email:'other@example.test'}, {displayName:'Fałszywa nazwa'}, {status:'approved'}, {role:'admin'}]) await assertFails(setDoc(doc(db,'accessRequests',uid),{...pending(),...change}))
  await assertSucceeds(setDoc(doc(db,'accessRequests',uid),pending()))
  await assertFails(getDoc(doc(db,'accessRequests/other')))
  await assertFails(updateDoc(doc(db,'accessRequests',uid),{status:'approved',reviewedBy:uid,reviewedAt:serverTimestamp()}))
  for(const role of ['admin','member']) await assertFails(setDoc(doc(db,'authorizedUsers',email),{active:true,role,displayName:'Jan'}))
  await assertFails(setDoc(doc(admin(),'authorizedUsers/new@example.test'),{active:true,role:'admin',displayName:'Jan'}))
  await assertFails(updateDoc(doc(admin(),'accessRequests',uid),{status:'approved',reviewedBy:'admin',reviewedAt:serverTimestamp()}))
 })
 it('odrzucenie nie nadaje dostępu i nie jest cofane przez ponowne logowanie', async () => {
  await seedAdmin(); holder.db=applicant(); await submitAccessRequest(googleUser)
  holder.db=admin(); await reviewAccessRequest(uid,'rejected','admin')
  holder.db=applicant(); expect(await submitAccessRequest(googleUser)).toBe('rejected')
  await assertFails(updateDoc(doc(holder.db,'accessRequests',uid),{status:'pending',reviewedAt:null,reviewedBy:null}))
  await assertFails(getDoc(doc(holder.db,'devices/private')))
 })
 it('zachowuje istniejące konta i odmawia zgłoszeń anonimowych oraz innych dostawców', async () => {
  await seedAdmin();holder.db=applicant();await submitAccessRequest(googleUser)
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'authorizedUsers',email),{active:false,role:'admin',displayName:'Istniejący'}))
  holder.db=admin(); await expect(reviewAccessRequest(uid,'approved','admin')).rejects.toThrow('już wpis')
  await assertFails(updateDoc(doc(holder.db,'authorizedUsers',email),{active:true,role:'member'}))
  const password=env.authenticatedContext('password',{email,email_verified:true,firebase:{sign_in_provider:'password'}}).firestore()
  await assertFails(setDoc(doc(password,'accessRequests/password'),{...pending(),uid:'password'}))
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'accessRequests')))
 })
})
