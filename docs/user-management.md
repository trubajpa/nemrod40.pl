# Zarządzanie użytkownikami

Strona `/panel/uzytkownicy` odczytuje konta Auth przez callable `listAppUsers`
(europe-west1). Backend używa Admin SDK, zwraca do 100 kont na stronę, łączy je
z `authorizedUsers/{email małymi literami}` i `accessRequests/{uid}`. Interfejs
pobiera kolejne strony, a następnie wyszukuje i filtruje całą listę. Tabela
wyświetla po 50 wyników. Hasła, ich hashe, custom claims i tokeny nie są zwracane.

`manageAppUser` ponownie sprawdza aktualnego administratora w transakcji.
Adres docelowy pochodzi z konta Auth według UID, nigdy z adresu podanego przez
przeglądarkę. Operacje: approve, reject, role, revoke. Samodzielna zmiana roli
jest zabroniona. Revoke wymaga potwierdzenia, ustawia active=false i nie usuwa
konta Auth. Poprzedni wniosek otrzymuje status revoked, a następne logowanie
Google lub hasłem otwiera nowy wniosek pending pod tym samym UID z nową datą zgłoszenia.

Wszystkie mutacje uprawnień używają wspólnego dokumentu transakcyjnego
`authorizationControl/adminLock`. Przy degradacji/odebraniu dostępu backend
sprawdza, czy pozostanie aktywny administrator z niezablokowanym kontem Auth.
Klient nie może zapisywać authorizedUsers, dziennika ani dokumentu kontroli.
Każda udana operacja zapisuje actorUid, actorEmail, targetUid, targetEmail,
action, before, after i serwerowe createdAt w `authorizationAudit`.
Profil zawiera również updatedBy i updatedAt.

AuthProvider pobiera profil z serwera i obserwuje jego zmiany w Firestore.
Dezaktywacja lub błąd kontroli zamyka strefę w otwartej sesji. Nowy wniosek nie
jest składany automatycznie w chwili odebrania dostępu; wymaga nowego logowania.
Firestore i Storage niezależnie sprawdzają active przy odczycie danych.

Backend używa domyślnych poświadczeń środowiska Cloud Functions. Żaden klucz
konta usługi nie jest tworzony ani przechowywany w kodzie klienta. Runtime
potrzebuje uprawnień odczytu Firebase Auth i dostępu do Firestore.

Walidacja:

```powershell
npm ci --prefix functions
npm test
npm run lint
npm run lint --prefix functions
npm run build
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
npx firebase emulators:exec --project demo-nemrod40 --only auth,functions,firestore,storage "npx vitest run --config vitest.firestore.config.ts tests/firestore-rules/userManagement.integration.test.ts tests/firestore-rules/accessRequests.integration.test.ts tests/firestore-rules/firestore.rules.test.ts tests/firestore-rules/forum.integration.test.ts tests/firestore-rules/storage.rules.test.ts"
```

Wdrożenie: najpierw `firebase deploy --project nemrod40pl --only functions:user-management`,
potem `firebase deploy --project nemrod40pl --only firestore:rules`, następnie
publikacja strony przez istniejący workflow GitHub Pages. W produkcji nie
wykonuj testowych zmian ról ani nie twórz fikcyjnych kont do testów. Emulatorowe
testy HTTP wywołują rzeczywiste callable z uwierzytelnieniem emulatora Auth.

Transport callable wymaga roles/run.invoker dla allUsers na usługach
listappusers i manageappuser. To pozwala dotrzeć do sprawdzania tokena Firebase
Auth, nie przyznaje dostępu do listy ani operacji bez roli admin. Po częściowo
nieudanym pierwszym wdrożeniu sprawdź także IAM Cloud Run — sam stan ACTIVE
nie potwierdza możliwości wywołania z aplikacji.