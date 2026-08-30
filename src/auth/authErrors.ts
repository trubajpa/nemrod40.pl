import { FirebaseError } from 'firebase/app'

export function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'

  switch (error.code) {
    case 'auth/popup-closed-by-user':
      return 'Okno logowania Google zostało zamknięte przed ukończeniem logowania.'
    case 'auth/popup-blocked':
      return 'Przeglądarka zablokowała okno logowania Google. Zezwól na wyskakujące okna i spróbuj ponownie.'
    case 'auth/unauthorized-domain':
      return 'Ta domena nie jest dodana do zaufanych domen Firebase Authentication. Dodaj nemrod40.pl (oraz localhost) w ustawieniach uwierzytelniania.'
    case 'auth/operation-not-allowed':
      return 'Logowanie Google nie jest włączone w projekcie Firebase. Włącz metodę logowania Google w Firebase Authentication.'
    case 'auth/account-exists-with-different-credential':
      return 'Konto z tym adresem e-mail korzysta z innej metody logowania. Zaloguj się właściwą metodą.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Nieprawidłowy adres e-mail lub hasło.'
    case 'auth/user-disabled':
      return 'To konto zostało wyłączone. Skontaktuj się z administratorem Koła.'
    case 'auth/network-request-failed':
      return 'Błąd połączenia z internetem. Sprawdź sieć i spróbuj ponownie.'
    case 'auth/too-many-requests':
      return 'Zbyt wiele prób logowania. Odczekaj chwilę i spróbuj ponownie.'
    default:
      return 'Nie udało się zalogować. Spróbuj ponownie.'
  }
}
