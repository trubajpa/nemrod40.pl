import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where, type Timestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { changeUserAccess } from './userManagement'
import { db } from '../lib/firebase'

export type AccessRequest = { uid: string; email: string; displayName: string; requestedAt: Timestamp; updatedAt: Timestamp; status: 'pending' | 'approved' | 'rejected' | 'revoked'; reviewedAt: Timestamp | null; reviewedBy: string | null }

export async function submitAccessRequest(user: User) {
  const token = await user.getIdTokenResult()
  if (!['google.com', 'password'].includes(token.signInProvider ?? '') || !user.email) throw new Error('Supported sign-in with email required')
  const ref = doc(db, 'accessRequests', user.uid)
  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref)
    const previous = snapshot.exists() ? snapshot.data() as AccessRequest : null
    // Revoked access may be requested again under the same UID.
    if (previous?.status === 'rejected') return previous.status
    tx.set(ref, { uid: user.uid, email: user.email!.toLowerCase(), displayName: String(token.claims.name ?? ''), requestedAt: previous?.status === 'pending' ? previous.requestedAt : serverTimestamp(), updatedAt: serverTimestamp(), status: 'pending', reviewedAt: null, reviewedBy: null })
    return 'pending' as const
  })
}

export function watchPendingRequests(next: (requests: AccessRequest[]) => void, error: () => void) {
  return onSnapshot(query(collection(db, 'accessRequests'), where('status', '==', 'pending')), snapshot => {
    next(snapshot.docs.map(item => item.data() as AccessRequest).sort((a, b) => (a.requestedAt?.toMillis() ?? 0) - (b.requestedAt?.toMillis() ?? 0)))
  }, error)
}

export async function reviewAccessRequest(uid: string, decision: 'approved' | 'rejected', _adminUid: string) {
  void _adminUid
  await changeUserAccess({ uid, action: decision === 'approved' ? 'approve' : 'reject' })
}
