# Członkowie koła

Strona `/panel/czlonkowie` korzysta z istniejącego ProtectedRoute. Dane są
pobierane z serwera Firestore, z dokumentu `circleMembers/current`, dopiero
po sprawdzeniu aktywnego dostępu. Reguły pozwalają na odczyt wyłącznie aktywnym
użytkownikom i blokują wszystkie zapisy z aplikacji, również administratorom.
Lista nie jest źródłem uprawnień i nie zmienia authorizedUsers.

Dokument zawiera tablicę `members` z dokładnie 45 obiektami o polach
`firstName` i `lastName`. Przechowuje tylko pierwsze imię i nazwisko.
Wspólne nazwiska nie są scalane. Nazwiska nie są częścią publicznego pakietu
aplikacji ani plików danych w repozytorium. Import odbywa się przez zaufany
interfejs Firestore i dotyczy wyłącznie tego dokumentu.

Widok sortuje według polskiego alfabetu, najpierw po nazwisku, potem imieniu.
Wyszukiwanie ignoruje wielkość liter i polskie znaki. Licznik podaje liczbę
wyników względem wszystkich 45 osób. Odczyt z błędną liczbą wpisów kończy się
komunikatem błędu, bez wyświetlania częściowej listy.

Testy widoku obejmują 45 wpisów, wspólne nazwiska, sortowanie, wyszukiwanie,
błąd pobrania i przekierowanie nieaktywnych lub niezalogowanych do logowania.
Testy emulatora w `circleMembers.integration.test.ts` sprawdzają rzeczywiste
reguły odczytu, blokadę zapisów i odebranie dostępu w tej samej sesji.
