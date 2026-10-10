import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signOut, type User } from 'firebase/auth'
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { AuthContext, type MemberProfile } from './AuthContext'
import { isAuthorizedMemberProfile, normalizeAuthorizedUserEmail } from './memberAuthorization'
import { submitAccessRequest } from './accessRequests'
import { logAuthError } from './authLogger'

const NO_ACCESS_MESSAGE = 'To konto nie ma dostępu do strefy członkowskiej. Skontaktuj się z administratorem Koła.'
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
  useEffect(() => {
    let currentCheck = 0
    let stopProfile: (() => void) | undefined
    void setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
      logAuthError('session_check', error)
      setAccessError('Nie udało się zachować sesji w tej przeglądarce. Spróbuj zalogować się ponownie.')
    })
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      const checkId = ++currentCheck
      stopProfile?.(); stopProfile = undefined
      setLoading(true); setUser(null); setProfile(null)
      if (!firebaseUser) { setLoading(false); return }
      const email = firebaseUser.email ? normalizeAuthorizedUserEmail(firebaseUser.email) : null
      if (!email) {
        setAccessError(NO_ACCESS_MESSAGE)
        await signOut(auth).catch(() => undefined)
        if (checkId === currentCheck) setLoading(false)
        return
      }
      try {
        const ref = doc(db, 'authorizedUsers', email)
        const snapshot = await getDocFromServer(ref)
        if (checkId !== currentCheck) return
        const data = snapshot.exists() ? snapshot.data() : null
        let hadAccess = isAuthorizedMemberProfile(data)
        if (hadAccess) {
          setUser(firebaseUser); setProfile(data as MemberProfile); setAccessError(null)
        } else {
          const token = await firebaseUser.getIdTokenResult()
          if (checkId !== currentCheck) return
          if (!['google.com', 'password'].includes(token.signInProvider ?? '')) {
            setAccessError(NO_ACCESS_MESSAGE)
            await signOut(auth).catch(() => undefined)
            return
          }
          const status = await submitAccessRequest(firebaseUser)
          if (checkId !== currentCheck) return
          setUser(firebaseUser)
          setAccessError(status === 'rejected' ? 'Wniosek o dostęp został odrzucony.' : 'Oczekujesz na zatwierdzenie')
        }
        // Server snapshots recheck both role and active status in an open session.
        // Cached snapshots cannot restore privileges revoked by the backend.
        stopProfile = onSnapshot(ref, { includeMetadataChanges: true }, next => {
          if (checkId !== currentCheck || next.metadata.fromCache) return
          const latest = next.exists() ? next.data() : null
          if (isAuthorizedMemberProfile(latest)) {
            hadAccess = true
            setUser(firebaseUser); setProfile(latest); setAccessError(null)
          } else {
            setProfile(null)
            if (hadAccess) setAccessError('Dostęp został odebrany.')
          }
        }, () => {
          if (checkId === currentCheck) {
            setProfile(null)
            setAccessError('Nie udało się sprawdzić uprawnień. Zaloguj się ponownie.')
          }
        })
      } catch {
        if (checkId === currentCheck) {
          setProfile(null)
          setAccessError('Nie udało się sprawdzić uprawnień. Sprawdź połączenie z internetem i spróbuj ponownie.')
          await signOut(auth).catch(() => undefined)
        }
      } finally { if (checkId === currentCheck) setLoading(false) }
    })
    return () => { ++currentCheck; unsubscribe(); stopProfile?.() }
  }, [])
  const value = useMemo(() => ({ user, profile, role: profile?.role ?? null, isActiveMember: Boolean(user && profile?.active === true), loading, accessError,
    clearAccessError: () => setAccessError(null), logout: () => { setAccessError(null); return signOut(auth) },
  }), [user, profile, loading, accessError])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
