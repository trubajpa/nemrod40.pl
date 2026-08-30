import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { AuthContext, type MemberProfile } from './AuthContext'
import { normalizeAuthorizedUserEmail } from './memberAuthorization'
import { logAuthError } from './authLogger'

const NO_ACCESS_MESSAGE = 'To konto nie ma dostępu do strefy członkowskiej. Skontaktuj się z administratorem Koła.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)

  useEffect(() => {
    let currentCheck = 0
    void setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
      logAuthError('session_check', error)
      setAccessError('Nie udało się zachować sesji w tej przeglądarce. Spróbuj zalogować się ponownie.')
    })

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const checkId = ++currentCheck
      setLoading(true)
      setUser(null)
      setProfile(null)

      if (!firebaseUser) {
        setLoading(false)
        return
      }

      const email = firebaseUser.email ? normalizeAuthorizedUserEmail(firebaseUser.email) : null
      if (!email) {
        setAccessError(NO_ACCESS_MESSAGE)
        await signOut(auth).catch(() => undefined)
        if (checkId === currentCheck) setLoading(false)
        return
      }

      try {
        const snapshot = await getDoc(doc(db, 'authorizedUsers', email))
        const data = snapshot.exists() ? (snapshot.data() as MemberProfile) : null
        if (!data || data.active !== true) {
          setAccessError(NO_ACCESS_MESSAGE)
          await signOut(auth).catch(() => undefined)
          return
        }
        if (checkId === currentCheck) {
          setUser(firebaseUser)
          setProfile(data)
          setAccessError(null)
        }
      } catch {
        setAccessError('Nie udało się sprawdzić uprawnień. Sprawdź połączenie z internetem i spróbuj ponownie.')
        await signOut(auth).catch(() => undefined)
      } finally {
        if (checkId === currentCheck) setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  const value = useMemo(() => ({
    user,
    profile,
    role: profile?.role ?? null,
    isActiveMember: Boolean(user && profile?.active === true),
    loading,
    accessError,
    clearAccessError: () => setAccessError(null),
    logout: () => signOut(auth),
  }), [user, profile, loading, accessError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
