import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'

const fail = (code, message) => { throw new HttpsError(code, message) }
const normalize = email => email.toLowerCase()
const activeAdmin = data => data?.active === true && data.role === 'admin'
const publicProfile = data => data ? { active: data.active === true, role: ['admin', 'member'].includes(data.role) ? data.role : null, displayName: data.displayName ?? '' } : null
const iso = value => value?.toDate?.().toISOString() ?? null

export function createUserService(auth, db) {
  async function actor(request) {
    if (!request.auth?.uid || typeof request.auth.token.email !== 'string') fail('unauthenticated', 'Zaloguj się ponownie.')
    const user = await auth.getUser(request.auth.uid).catch(() => fail('permission-denied', 'Brak uprawnień administratora.'))
    if (user.disabled || user.email !== request.auth.token.email) fail('permission-denied', 'Brak uprawnień administratora.')
    // Keep the same token-email identity as existing member/Storage rules.
    return { uid: user.uid, email: user.email, ref: db.doc(`authorizedUsers/${user.email}`) }
  }
  async function requireAdmin(request) {
    const caller = await actor(request)
    if (!activeAdmin((await caller.ref.get()).data())) fail('permission-denied', 'Brak uprawnień administratora.')
    return caller
  }
  return {
    async list(request) {
      const caller = await requireAdmin(request)
      const data = request.data ?? {}
      if (data.pageToken !== undefined && (typeof data.pageToken !== 'string' || data.pageToken.length > 4096)) fail('invalid-argument', 'Nieprawidłowy kursor strony.')
      const limit = data.pageSize ?? 100
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail('invalid-argument', 'Rozmiar strony musi wynosić od 1 do 100.')
      const page = await auth.listUsers(limit, data.pageToken || undefined)
      const profiles = page.users.length ? await db.getAll(...page.users.map(user => db.doc(`authorizedUsers/${normalize(user.email || '__no_email__')}`))) : []
      const requests = page.users.length ? await db.getAll(...page.users.map(user => db.doc(`accessRequests/${user.uid}`))) : []
      // An admin revoked while the list was loading must not receive the result.
      if (!activeAdmin((await caller.ref.get()).data())) fail('permission-denied', 'Brak uprawnień administratora.')
      return { users: page.users.map((user, index) => {
        const profile = publicProfile(profiles[index].data()), access = requests[index].data()
        const active = !user.disabled && profile?.active === true
        return { uid: user.uid, email: user.email ?? '', displayName: profile?.displayName || user.displayName || access?.displayName || '', role: profile?.role ?? null,
          status: active ? 'active' : access?.status === 'pending' ? 'pending' : 'no-access', lastSignInTime: user.metadata.lastSignInTime || null,
          disabled: user.disabled, emailVerified: user.emailVerified, authorizedUser: profile, accessRequest: access ? { status: access.status, requestedAt: iso(access.requestedAt) } : null }
      }), nextPageToken: page.pageToken ?? null }
    },
    async change(request) {
      const caller = await requireAdmin(request)
      const { uid, action, role, confirmed } = request.data ?? {}
      if (typeof uid !== 'string' || !uid || uid.length > 128 || !['approve', 'reject', 'role', 'revoke'].includes(action)) fail('invalid-argument', 'Nieprawidłowa operacja.')
      if (action === 'role' && !['member', 'admin'].includes(role)) fail('invalid-argument', 'Nieprawidłowa rola.')
      if (action === 'role' && uid === caller.uid) fail('failed-precondition', 'Nie możesz zmienić własnej roli.')
      if (action === 'revoke' && confirmed !== true) fail('failed-precondition', 'Potwierdź odebranie dostępu.')
      const target = await auth.getUser(uid).catch(() => fail('not-found', 'Nie znaleziono konta Firebase Auth.'))
      if (!target.email) fail('failed-precondition', 'Konto nie ma adresu e-mail.')
      const email = normalize(target.email), ref = db.doc(`authorizedUsers/${email}`), applicationRef = db.doc(`accessRequests/${uid}`)
      const lockRef = db.doc('authorizationControl/adminLock'), auditRef = db.collection('authorizationAudit').doc()
      await db.runTransaction(async tx => {
        // Every permission mutation reads/writes this common lock. Concurrent
        // demotions retry and recount admins against the newly committed state.
        const [callerDoc, lock, current, application, admins] = await Promise.all([
          tx.get(caller.ref), tx.get(lockRef), tx.get(ref), tx.get(applicationRef), tx.get(db.collection('authorizedUsers').where('role', '==', 'admin')),
        ])
        if (!activeAdmin(callerDoc.data())) fail('permission-denied', 'Brak uprawnień administratora.')
        const before = current.data() ?? null, access = application.data()
        let after = before
        if (action === 'approve') {
          if (target.disabled || access?.status !== 'pending' || access.uid !== uid || access.email !== email) fail('failed-precondition', 'Brak zgodnego oczekującego wniosku.')
          if (before?.active === true) fail('failed-precondition', 'Użytkownik ma już aktywny dostęp.')
          const displayName = before?.displayName || access.displayName || target.displayName
          if (!displayName) fail('failed-precondition', 'Konto nie ma imienia i nazwiska.')
          after = { ...before, active: true, role: 'member', displayName }
        } else if (action === 'role') {
          if (before?.active !== true || target.disabled) fail('failed-precondition', 'Zmiana roli wymaga aktywnego dostępu.')
          after = { ...before, role }
        } else if (action === 'revoke') {
          if (before?.active !== true) fail('failed-precondition', 'Użytkownik nie ma aktywnego dostępu.')
          after = { ...before, active: false }
        } else if (access?.status !== 'pending' || access.uid !== uid || access.email !== email) fail('failed-precondition', 'Brak zgodnego oczekującego wniosku.')
        if (activeAdmin(before) && !activeAdmin(after)) {
          const enabled = await Promise.all(admins.docs.filter(item => activeAdmin(item.data())).map(async item => {
            const account = await auth.getUserByEmail(item.id).catch(error => {
              if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') return null
              throw error
            })
            return account && !account.disabled
          }))
          if (enabled.filter(Boolean).length <= 1) fail('failed-precondition', 'Nie można odebrać dostępu ani zdegradować ostatniego aktywnego administratora.')
        }
        const now = FieldValue.serverTimestamp()
        if (action !== 'reject') tx.set(ref, { ...after, updatedAt: now, updatedBy: caller.uid })
        if (action === 'approve' || action === 'reject') tx.update(applicationRef, { status: action === 'approve' ? 'approved' : 'rejected', reviewedAt: now, reviewedBy: caller.uid })
        if (action === 'revoke' && application.exists) tx.update(applicationRef, { status: 'revoked', reviewedAt: now, reviewedBy: caller.uid })
        tx.set(lockRef, { revision: (lock.data()?.revision ?? 0) + 1, updatedAt: now })
        tx.create(auditRef, { actorUid: caller.uid, actorEmail: caller.email, targetUid: uid, targetEmail: email, action, before: publicProfile(before), after: publicProfile(after), createdAt: now })
      })
      return { ok: true }
    },
  }
}
