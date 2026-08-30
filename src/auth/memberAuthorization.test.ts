import { describe, expect, it } from 'vitest'
import { normalizeAuthorizedUserEmail } from './memberAuthorization'

describe('normalizeAuthorizedUserEmail', () => {
  it('normalizuje adres przed użyciem jako identyfikator authorizedUsers', () => {
    expect(normalizeAuthorizedUserEmail('  Pawel.Trubaj@GMAIL.COM  ')).toBe('pawel.trubaj@gmail.com')
  })
})
