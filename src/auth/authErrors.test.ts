import { FirebaseError } from 'firebase/app'
import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './authErrors'

describe('getAuthErrorMessage', () => {
  it.each([
    ['auth/popup-closed-by-user', 'Logowanie zostało anulowane.'],
    ['auth/popup-blocked', 'Przeglądarka zablokowała okno logowania. Zezwól na wyskakujące okna i spróbuj ponownie.'],
    ['auth/network-request-failed', 'Nie udało się połączyć z usługą logowania. Sprawdź internet i spróbuj ponownie.'],
    ['auth/unauthorized-domain', 'Logowanie z tej domeny nie jest obecnie dostępne.'],
    ['auth/api-key-not-valid', 'Logowanie jest chwilowo niedostępne z powodu błędu konfiguracji.'],
    ['auth/invalid-api-key', 'Logowanie jest chwilowo niedostępne z powodu błędu konfiguracji.'],
    ['auth/wrong-password', 'Nieprawidłowy login lub hasło.'],
    ['auth/invalid-credential', 'Nieprawidłowy login lub hasło.'],
    ['auth/user-not-found', 'Nieprawidłowy login lub hasło.'],
    ['auth/unmapped-error', 'Nie udało się zalogować. Spróbuj ponownie.'],
  ])('mapuje %s na bezpieczny polski komunikat', (code, expected) => {
    expect(getAuthErrorMessage(new FirebaseError(code, 'technical details'))).toBe(expected)
  })

  it('ukrywa szczegóły błędu spoza Firebase', () => {
    expect(getAuthErrorMessage(new Error('secret technical details'))).toBe('Nie udało się zalogować. Spróbuj ponownie.')
  })
})
