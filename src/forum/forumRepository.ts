import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { ForumAuthor, Post, PostInput, Topic } from './models'

export function identityPath(publicPath: string) {
  if (!/^forumTopics\/[^/]+(?:\/replies\/[^/]+(?:\/comments\/[^/]+)?)?$/.test(publicPath)) throw Error('invalid_forum_path')
  return publicPath.replace(/^forumTopics\//, 'forumAuthors/')
}
function decode(d: QueryDocumentSnapshot<DocumentData>): Post {
  const value = d.data()
  return { id: d.id, path: d.ref.path, body: value.body, signature: value.signature, pseudonym: value.pseudonym, createdAt: value.createdAt?.toMillis?.() ?? 0 }
}
const chronological = <T extends Post>(rows: T[]) => rows.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))

// Listeners follow the three supported levels. There are no collection-group
// reads, recursive replies, public UIDs or identity queries for ordinary members.
export function subscribeForum(onData: (topics: Topic[]) => void, onError: () => void) {
  let stopped = false
  type ReplyNode = { post: Post; comments: Post[]; stop: () => void }
  type TopicNode = { post: Post; title: string; replies: Map<string, ReplyNode>; stop: () => void }
  const nodes = new Map<string, TopicNode>()
  const emit = () => { if (!stopped) onData([...nodes.values()].map(n => ({ ...n.post, title: n.title, answers: chronological([...n.replies.values()].map(a => ({ ...a.post, comments: chronological([...a.comments]) }))) })).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))) }
  const stopNode = (node: TopicNode) => { node.stop(); node.replies.forEach(r => r.stop()) }
  const stopRoot = onSnapshot(query(collection(db, 'forumTopics'), where('state', '==', 'active')), snapshot => {
    const ids = new Set(snapshot.docs.map(d => d.id))
    for (const [id, node] of nodes) if (!ids.has(id)) { stopNode(node); nodes.delete(id) }
    for (const d of snapshot.docs) {
      const existing = nodes.get(d.id)
      if (existing) { existing.post = decode(d); existing.title = d.data().title; continue }
      const node: TopicNode = { post: decode(d), title: d.data().title, replies: new Map(), stop: () => {} }
      nodes.set(d.id, node)
      node.stop = onSnapshot(query(collection(d.ref, 'replies'), where('state', '==', 'active')), replies => {
        if (stopped || nodes.get(d.id) !== node) return
        const replyIds = new Set(replies.docs.map(r => r.id))
        for (const [id, reply] of node.replies) if (!replyIds.has(id)) { reply.stop(); node.replies.delete(id) }
        for (const r of replies.docs) {
          const old = node.replies.get(r.id)
          if (old) { old.post = decode(r); continue }
          const reply: ReplyNode = { post: decode(r), comments: [], stop: () => {} }
          node.replies.set(r.id, reply)
          reply.stop = onSnapshot(query(collection(r.ref, 'comments'), where('state', '==', 'active')), comments => {
            if (stopped || nodes.get(d.id) !== node || node.replies.get(r.id) !== reply) return
            reply.comments = comments.docs.map(decode); emit()
          }, () => { reply.comments = []; emit() })
        }
        emit()
      }, () => { node.replies.forEach(r => r.stop()); node.replies.clear(); emit() })
    }
    emit()
  }, () => { nodes.forEach(stopNode); nodes.clear(); emit(); onError() })
  return () => { stopped = true; stopRoot(); nodes.forEach(stopNode); nodes.clear() }
}

async function publish(path: string, input: PostInput, name: string, title?: string) {
  const user = auth.currentUser
  if (!user?.email) throw Error('forum_login_required')
  const body = input.body.trim(), signature = input.signature.trim()
  if (!body || body.length > 6000 || !signature || signature.length > 200 || (input.pseudonym && signature.length > 50) || (!input.pseudonym && signature !== name) || (title !== undefined && (!title.trim() || title.trim().length > 160))) throw Error('forum_invalid_input')
  const batch = writeBatch(db)
  batch.set(doc(db, path), { body, signature, pseudonym: input.pseudonym, createdAt: serverTimestamp(), state: 'active', deletedAt: null, ...(title === undefined ? {} : { title: title.trim() }) })
  batch.set(doc(db, identityPath(path)), { uid: user.uid, email: user.email, name, createdAt: serverTimestamp() })
  await batch.commit()
}
export async function createTopic(input: PostInput, title: string, name: string) {
  const ref = doc(collection(db, 'forumTopics'))
  await publish(ref.path, input, name, title)
  return ref.id
}
export async function addReply(topicId: string, input: PostInput, name: string) {
  const ref = doc(collection(db, 'forumTopics', topicId, 'replies'))
  await publish(ref.path, input, name)
}
export async function addComment(topicId: string, replyId: string, input: PostInput, name: string) {
  const ref = doc(collection(db, 'forumTopics', topicId, 'replies', replyId, 'comments'))
  await publish(ref.path, input, name)
}
export async function moderatePost(post: Post) {
  identityPath(post.path)
  // Tombstoning an ancestor denies member access to its entire subtree and
  // prevents new descendants, including concurrent writes. Identities stay private.
  await updateDoc(doc(db, post.path), { state: 'deleted', deletedAt: serverTimestamp() })
}
export async function getAuthor(post: Post): Promise<ForumAuthor | null> {
  const snapshot = await getDoc(doc(db, identityPath(post.path)))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return { uid: data.uid, name: data.name, email: data.email }
}
