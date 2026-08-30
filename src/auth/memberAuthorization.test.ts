import { describe, expect, it } from 'vitest'
import { authorizedUserIdentityMatches, isAuthorizedMemberProfile, normalizeAuthorizedUserEmail } from './memberAuthorization'

describe('normalizeAuthorizedUserEmail', () => {
  it('normalizuje adres przed użyciem jako identyfikator authorizedUsers', () => {
    expect(normalizeAuthorizedUserEmail('  Pawel.Trubaj@GMAIL.COM  ')).toBe('pawel.trubaj@gmail.com')
  })

  it('wykrywa ryzyko różnej wielkości liter między tokenem i dokumentem', () => {
    expect(authorizedUserIdentityMatches('Member@Example.test', 'member@example.test')).toBe(false)
    expect(authorizedUserIdentityMatches('member@example.test', 'member@example.test')).toBe(true)
  })

  it('odrzuca nieaktywne profile i profile bez nazwy wymaganej przez reguły komentarzy', () => {
    expect(isAuthorizedMemberProfile({ active: false, displayName: 'Członek testowy' })).toBe(false)
    expect(isAuthorizedMemberProfile({ active: true, displayName: '' })).toBe(false)
    expect(isAuthorizedMemberProfile({ active: true, displayName: 'Członek testowy', role: 'member' })).toBe(true)
  })
})
