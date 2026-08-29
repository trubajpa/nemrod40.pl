import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type MemberProfile = {
  active: boolean
  displayName?: string
  role?: string
}

export type AuthContextValue = {
  user: User | null
  profile: MemberProfile | null
  role: string | null
  isActiveMember: boolean
  loading: boolean
  accessError: string | null
  clearAccessError: () => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
