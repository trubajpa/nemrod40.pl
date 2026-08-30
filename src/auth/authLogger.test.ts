import { FirebaseError } from 'firebase/app'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logAuthError } from './authLogger'

describe('logAuthError', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loguje wyłącznie operację, kod i kontrolowany komunikat', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sensitiveText = 'user@example.com token=secret credential=password'

    logAuthError('google_sign_in', new FirebaseError('auth/network-request-failed', sensitiveText))

    expect(consoleError).toHaveBeenCalledWith('Firebase Authentication error', {
      operation: 'google_sign_in',
      code: 'auth/network-request-failed',
      message: 'The authentication service could not be reached.',
    })
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(sensitiveText)
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('user@example.com')
  })
})
