import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { beforeAll, afterAll, afterEach, it } from 'vitest'
let env: RulesTestEnvironment
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nemrod40', firestore: { rules: await readFile('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
})
afterEach(async () => { await env.clearFirestore() })
afterAll(async () => { await env.cleanup() })
async function seed() {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'circleMembers/current'), { members: [{ firstName: 'Jan', lastName: 'Testowy' }] })
    for (const [email, active, role] of [['member@example.test', true, 'member'], ['admin@example.test', true, 'admin'], ['inactive@example.test', false, 'member']] as const) {
      await setDoc(doc(ctx.firestore(), 'authorizedUsers', email), { active, role })
    }
  })
}
it('tylko aktywny członek lub admin odczytuje listę, klient nie może jej zapisać', async () => {
  await seed()
  for (const email of ['member@example.test', 'admin@example.test']) {
    const db = env.authenticatedContext(email, { email }).firestore()
    await assertSucceeds(getDoc(doc(db, 'circleMembers/current')))
    await assertFails(updateDoc(doc(db, 'circleMembers/current'), { members: [] }))
  }
})
it('anonimowy, oczekujący i nieaktywny nie mają dostępu; wpis na liście nie nadaje uprawnień', async () => {
  await seed()
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('pending', { email: 'pending@example.test', name: 'Jan Testowy' }).firestore(), env.authenticatedContext('inactive', { email: 'inactive@example.test' }).firestore()]) {
    await assertFails(getDoc(doc(db, 'circleMembers/current')))
    await assertFails(setDoc(doc(db, 'authorizedUsers/pending@example.test'), { active: true, role: 'member' }))
  }
})
it('odebranie dostępu natychmiast blokuje kolejny odczyt w tej samej sesji', async () => {
  await seed()
  const db = env.authenticatedContext('member', { email: 'member@example.test' }).firestore()
  await assertSucceeds(getDoc(doc(db, 'circleMembers/current')))
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'authorizedUsers/member@example.test'), { active: false }))
  await assertFails(getDoc(doc(db, 'circleMembers/current')))
})
