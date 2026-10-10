import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where, type Timestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../lib/firebase'

export type AccessRequest = { uid: string; email: string; displayName: string; requestedAt: Timestamp; updatedAt: Timestamp; status: 'pending' | 'approved' | 'rejected'; reviewedAt: Timestamp | null; reviewedBy: string | null }

export async function submitAccessRequest(user: User) {
  const token = await user.getIdTokenResult()
  if (token.signInProvider !== 'google.com' || !user.email) throw new Error('Google sign-in required')
  const ref = doc(db, 'accessRequests', user.uid)
  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref)
    const previous = snapshot.exists() ? snapshot.data() as AccessRequest : null
    // A new login refreshes the same application, but cannot undo a decision.
    if (previous && previous.status !== 'pending') return previous.status
    tx.set(ref, { uid: user.uid, email: user.email!.toLowerCase(), displayName: String(token.claims.name ?? ''), requestedAt: previous?.requestedAt ?? serverTimestamp(), updatedAt: serverTimestamp(), status: 'pending', reviewedAt: null, reviewedBy: null })
    return 'pending' as const
  })
}

export function watchPendingRequests(next: (requests: AccessRequest[]) => void, error: () => void) {
  return onSnapshot(query(collection(db, 'accessRequests'), where('status', '==', 'pending')), snapshot => {
    next(snapshot.docs.map(item => item.data() as AccessRequest).sort((a, b) => (a.requestedAt?.toMillis() ?? 0) - (b.requestedAt?.toMillis() ?? 0)))
  }, error)
}

export async function reviewAccessRequest(uid: string, decision: 'approved' | 'rejected', adminUid: string) {
  return runTransaction(db, async tx => {
    const ref = doc(db, 'accessRequests', uid)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists() || snapshot.data().status !== 'pending') throw new Error('Wniosek został już rozpatrzony.')
    const request = snapshot.data() as AccessRequest
    const memberRef = doc(db, 'authorizedUsers', request.email)
    if (decision === 'approved') {
      const existing = await tx.get(memberRef)
      if (existing.exists()) throw new Error('Konto ma już wpis authorizedUsers. Skontaktuj się z administratorem — ta strona nie zmienia istniejących kont.')
      tx.set(memberRef, { active: true, role: 'member', displayName: request.displayName })
    }
    tx.update(ref, { status: decision, reviewedAt: serverTimestamp(), reviewedBy: adminUid })
  })
}
