import { FirebaseError } from 'firebase/app'

export function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) return 'Nie udało się zalogować. Spróbuj ponownie.'

  switch (error.code) {
    case 'auth/popup-closed-by-user':
      return 'Logowanie zostało anulowane.'
    case 'auth/popup-blocked':
      return 'Przeglądarka zablokowała okno logowania. Zezwól na wyskakujące okna i spróbuj ponownie.'
    case 'auth/network-request-failed':
      return 'Nie udało się połączyć z usługą logowania. Sprawdź internet i spróbuj ponownie.'
    case 'auth/unauthorized-domain':
      return 'Logowanie z tej domeny nie jest obecnie dostępne.'
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'Logowanie jest chwilowo niedostępne z powodu błędu konfiguracji.'
    case 'auth/operation-not-allowed':
      return 'Logowanie Google nie jest włączone w projekcie Firebase. Włącz metodę logowania Google w Firebase Authentication.'
    case 'auth/account-exists-with-different-credential':
      return 'Konto z tym adresem e-mail korzysta z innej metody logowania. Zaloguj się właściwą metodą.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Nieprawidłowy login lub hasło.'
    case 'auth/user-disabled':
      return 'To konto zostało wyłączone. Skontaktuj się z administratorem Koła.'
    case 'auth/too-many-requests':
      return 'Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie.'
    default:
      return 'Nie udało się zalogować. Spróbuj ponownie.'
  }
}
