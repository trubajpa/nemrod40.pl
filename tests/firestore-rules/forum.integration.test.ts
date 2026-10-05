import { readFile } from 'node:fs/promises'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { Post, Topic } from '../../src/forum/models'
const handles = vi.hoisted(() => ({ db: null as unknown, user: null as { uid: string; email: string } | null }))
vi.mock('../../src/lib/firebase', () => ({ get db() { return handles.db }, auth: { get currentUser() { return handles.user } } }))
import { addComment, addReply, createTopic, getAuthor, identityPath, moderatePost, subscribeForum } from '../../src/forum/forumRepository'

let env: RulesTestEnvironment
const member = { uid: 'forum-member', email: 'forum-member@example.test', name: 'Forum Member' }
const admin = { uid: 'forum-admin', email: 'forum-admin@example.test', name: 'Forum Admin' }
const inactive = { uid: 'forum-inactive', email: 'forum-inactive@example.test', name: 'Inactive' }
const outsider = { uid: 'forum-outsider', email: 'forum-outsider@example.test', name: 'Outsider' }
const input = { body: 'A real conversation', signature: 'Forest pseudonym', pseudonym: true }
const context = (u = member) => env.authenticatedContext(u.uid, { email: u.email }).firestore()
function use(u = member) { handles.db = context(u); handles.user = u; return handles.db as Firestore }
const post = (path: string): Post => ({ path, id: path.split('/').at(-1)!, body: '', signature: '', pseudonym: true, createdAt: 0 })
const active = (extra = {}) => ({ ...input, createdAt: serverTimestamp(), state: 'active', deletedAt: null, ...extra })
function pair(db: Firestore, path: string, u = member, extra = {}) {
  const batch = writeBatch(db)
  batch.set(doc(db, path), active(extra))
  batch.set(doc(db, identityPath(path)), { uid: u.uid, email: u.email, name: u.name, createdAt: serverTimestamp() })
  return batch
}
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw Error('LOCAL EMULATOR ONLY')
  env = await initializeTestEnvironment({ projectId: 'demo-nemrod40', firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') } })
})
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async c => {
    for (const u of [member, admin, inactive]) await setDoc(doc(c.firestore(), 'authorizedUsers', u.email), { active: u !== inactive, role: u === admin ? 'admin' : 'member', displayName: u.name })
  })
  use()
})
afterAll(async () => { await env?.clearFirestore(); await env?.cleanup() })

it('publishes real repository writes at exactly two levels, and computes independent reply/comment counts', async () => {
  const id = await createTopic(input, 'Topic', member.name)
  await addReply(id, input, member.name)
  const replies = await getDocs(query(collection(context(), 'forumTopics', id, 'replies'), where('state', '==', 'active')))
  const reply = replies.docs[0].id
  await addComment(id, reply, { ...input, body: 'First comment' }, member.name)
  await addComment(id, reply, { ...input, body: 'Second comment' }, member.name)
  await addReply(id, { ...input, body: 'Independent answer' }, member.name)
  const rows = await new Promise<Topic[]>((resolve, reject) => {
    const timeout = setTimeout(() => { stop(); reject(Error('forum_listener_timeout')) }, 8000)
    const stop = subscribeForum(topics => {
      if (topics[0]?.answers.length === 2 && topics[0].answers.reduce((n, a) => n + a.comments.length, 0) === 2) { clearTimeout(timeout); stop(); resolve(topics) }
    }, () => { clearTimeout(timeout); stop(); reject(Error('forum_listener_failed')) })
  })
  expect(rows[0].title).toBe('Topic')
  expect(rows[0].answers.filter(a => a.comments.length === 2)).toHaveLength(1)
  expect(rows[0]).not.toHaveProperty('authorId')
  await assertFails(setDoc(doc(context(), 'forumTopics', id, 'replies', reply, 'comments', 'one', 'replies', 'third'), active()))
})

it('keeps identities out of all public data; even authors cannot read private identities, only admin can', async () => {
  const id = await createTopic(input, 'Private identity', member.name)
  await addReply(id, input, member.name)
  const reply = (await getDocs(query(collection(context(), 'forumTopics', id, 'replies'), where('state', '==', 'active')))).docs[0]
  await addComment(id, reply.id, input, member.name)
  const comment = (await getDocs(query(collection(reply.ref, 'comments'), where('state', '==', 'active')))).docs[0]
  for (const path of [`forumTopics/${id}`, reply.ref.path, comment.ref.path]) {
    const data = (await getDoc(doc(context(), path))).data()!
    expect(JSON.stringify(data)).not.toContain(member.uid)
    expect(JSON.stringify(data)).not.toContain(member.email)
    expect(JSON.stringify(data)).not.toContain(member.name)
    await assertFails(getDoc(doc(context(), identityPath(path))))
    await assertFails(getDocs(collection(context(), identityPath(path).split('/').slice(0, -1).join('/'))))
    use(admin)
    expect(await getAuthor(post(path))).toMatchObject(member)
    use()
  }
})

it('denies anonymous, unlisted and inactive accounts access and creation', async () => {
  const id = await createTopic(input, 'Members only', member.name)
  for (const db of [env.unauthenticatedContext().firestore(), context(outsider), context(inactive)]) {
    await assertFails(getDoc(doc(db, 'forumTopics', id)))
    await assertFails(getDocs(query(collection(db, 'forumTopics'), where('state', '==', 'active'))))
    await assertFails(pair(db, 'forumTopics/not-authorized', member, { title: 'Denied' }).commit())
  }
})

it('rejects orphan public/private records, impersonation and private fields in public content', async () => {
  const db = context()
  await assertFails(setDoc(doc(db, 'forumTopics/orphan'), active({ title: 'Orphan' })))
  await assertFails(setDoc(doc(db, 'forumAuthors/orphan'), { uid: member.uid, email: member.email, name: member.name, createdAt: serverTimestamp() }))
  await assertFails(pair(db, 'forumTopics/spoof', admin, { title: 'Spoof' }).commit())
  await assertFails(pair(db, 'forumTopics/leak', member, { title: 'Leak', authorUid: member.uid }).commit())
  await assertFails(pair(db, 'forumTopics/wrong-name', member, { title: 'Impersonation', pseudonym: false, signature: admin.name }).commit())
  await assertFails(createTopic({ ...input, pseudonym: false, signature: 'Someone else' }, 'Wrong name', 'Someone else'))
  await assertSucceeds(createTopic({ ...input, pseudonym: false, signature: member.name }, 'Profile name', member.name))
})

it('enforces text bounds, whitespace rejection and immutable identity/content', async () => {
  const db = context()
  for (const [id, data] of [['empty', { body: '   ' }], ['title', { title: ' ' }], ['nickname', { signature: 'x'.repeat(51) }], ['body', { body: 'x'.repeat(6001) }]] as const) await assertFails(pair(db, `forumTopics/${id}`, member, { title: 'Valid', ...data }).commit())
  const id = await createTopic(input, 'Immutable', member.name)
  for (const u of [member, admin]) {
    await assertFails(updateDoc(doc(context(u), 'forumTopics', id), { body: 'Changed' }))
    await assertFails(updateDoc(doc(context(u), 'forumAuthors', id), { uid: admin.uid }))
  }
  await assertFails(updateDoc(doc(db, 'forumTopics', id), { state: 'deleted', deletedAt: serverTimestamp() }))
})

it('moderates a comment independently; deleting a reply hides all its comments without affecting other replies', async () => {
  const id = await createTopic(input, 'Moderation', member.name)
  await addReply(id, input, member.name)
  await addReply(id, input, member.name)
  const replies = (await getDocs(query(collection(context(), 'forumTopics', id, 'replies'), where('state', '==', 'active')))).docs
  await addComment(id, replies[0].id, input, member.name)
  await addComment(id, replies[0].id, input, member.name)
  const comments = (await getDocs(query(collection(replies[0].ref, 'comments'), where('state', '==', 'active')))).docs
  use(admin); await moderatePost(post(comments[0].ref.path))
  await assertFails(getDoc(doc(context(), comments[0].ref.path)))
  await assertSucceeds(getDoc(doc(context(), comments[1].ref.path)))
  await moderatePost(post(replies[0].ref.path))
  await assertFails(getDoc(doc(context(), comments[1].ref.path)))
  await assertFails(getDocs(query(collection(context(), replies[0].ref.path, 'comments'), where('state', '==', 'active'))))
  await assertSucceeds(getDoc(doc(context(), replies[1].ref.path)))
  use(); await assertFails(addComment(id, replies[0].id, input, member.name))
})

it('topic removal blocks reads and new descendants; author audit remains admin-only', async () => {
  const id = await createTopic(input, 'Removed', member.name)
  await addReply(id, input, member.name)
  const reply = (await getDocs(query(collection(context(), 'forumTopics', id, 'replies'), where('state', '==', 'active')))).docs[0]
  await addComment(id, reply.id, input, member.name)
  const comment = (await getDocs(query(collection(reply.ref, 'comments'), where('state', '==', 'active')))).docs[0]
  use(admin); await moderatePost(post(`forumTopics/${id}`))
  for (const path of [`forumTopics/${id}`, reply.ref.path, comment.ref.path]) await assertFails(getDoc(doc(context(), path)))
  expect((await getDocs(query(collection(context(), 'forumTopics'), where('state', '==', 'active')))).size).toBe(0)
  use(); await assertFails(addReply(id, input, member.name)); await assertFails(addComment(id, reply.id, input, member.name))
  use(admin); expect(await getAuthor(post(comment.ref.path))).toMatchObject(member)
  await assertFails(updateDoc(doc(context(admin), 'forumTopics', id), { state: 'active', deletedAt: null }))
})

it('blocks a concurrent descendant creation in the same batch that removes its parent', async () => {
  const id = await createTopic(input, 'Race', member.name)
  await addReply(id, input, member.name)
  const reply = (await getDocs(query(collection(context(), 'forumTopics', id, 'replies'), where('state', '==', 'active')))).docs[0]
  const db = context(admin), batch = pair(db, `${reply.ref.path}/comments/racing`, admin)
  batch.update(doc(db, reply.ref.path), { state: 'deleted', deletedAt: serverTimestamp() })
  await assertFails(batch.commit())
  expect((await getDoc(doc(context(), reply.ref.path))).data()?.state).toBe('active')
})
