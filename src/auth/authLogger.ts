import { FirebaseError } from 'firebase/app'

export type AuthOperation = 'google_sign_in' | 'email_sign_in' | 'password_reset' | 'session_check'

const TECHNICAL_MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'The authentication popup was closed before completion.',
  'auth/popup-blocked': 'The authentication popup was blocked by the browser.',
  'auth/network-request-failed': 'The authentication service could not be reached.',
  'auth/unauthorized-domain': 'The current domain is not authorized for authentication.',
  'auth/api-key-not-valid': 'The authentication service rejected the application configuration.',
  'auth/invalid-api-key': 'The authentication service rejected the application configuration.',
  'auth/operation-not-allowed': 'The selected authentication provider is disabled.',
  'auth/account-exists-with-different-credential': 'The account uses a different authentication provider.',
}

export function logAuthError(operation: AuthOperation, error: unknown) {
  const code = error instanceof FirebaseError ? error.code : 'auth/unknown'
  const message = TECHNICAL_MESSAGES[code] ?? 'The authentication operation failed.'

  console.error('Firebase Authentication error', { operation, code, message })
}
