import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth } from '../lib/firebase'

export type ManagedUser = {
  uid: string; email: string; displayName: string; role: 'admin' | 'member' | null
  status: 'active' | 'pending' | 'no-access'; lastSignInTime: string | null; disabled: boolean; emailVerified: boolean
  authorizedUser: { active: boolean; role: string | null; displayName: string } | null
  accessRequest: { status: string; requestedAt: string | null } | null
}
export type UserPage = { users: ManagedUser[]; nextPageToken: string | null }
export type UserChange = { uid: string; action: 'approve' | 'reject' | 'role' | 'revoke'; role?: 'admin' | 'member'; confirmed?: boolean }
// Only callable API clients are bundled here. Admin SDK lives in functions/.
export async function listUsersPage(pageToken?: string) {
  const result = await httpsCallable<{ pageToken?: string; pageSize: number }, UserPage>(getFunctions(auth.app, 'europe-west1'), 'listAppUsers')({ ...(pageToken ? { pageToken } : {}), pageSize: 100 })
  return result.data
}
export async function changeUserAccess(input: UserChange) {
  await httpsCallable<UserChange, { ok: boolean }>(getFunctions(auth.app, 'europe-west1'), 'manageAppUser')(input)
}
