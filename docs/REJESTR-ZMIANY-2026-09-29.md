# Rejestr urządzeń — zmiany lokalne

> **Stan po poprawkach: GOTOWE DO COMMITA (bez wdrożenia).** Trzy regresje zostały naprawione i przeniesione do stałych testów integracyjnych. Wyniki: 106/106 testów aplikacji, 51/51 testów emulatorowych, lint, build i git diff --check PASS. Narzędzie dry-run/apply jest gotowe i sprawdzone na emulatorze; nie uruchamiano go na produkcji. Niżej zachowano historyczny audyt oraz dodano aktualny zakres poprawek.

## Zakres

Zmiany dotyczą właściwej aplikacji React, a nie tylko raportu HTML. Rejestr ma przełącznik Tabela/Karty, zachowane karty, większą miniaturę główną w tabeli, filtr czterech typów i wyszukiwanie po numerze, opiekunie oraz rewirze. Starszy typ `lizawka` zachowuje wartość w bazie i jest uwzględniany pod filtrem „Inne”. Nazwa, numer i zdjęcie prowadzą do istniejącej chronionej trasy `/panel/urzadzenia/:id`.

Szczegóły zawierają opis, usterki, zalecenia, GPS/Maps, ocenę, status, galerię, komentarze oraz historię. Subskrypcja dokumentu odświeża metryczkę po zapisie. Zmiana trasy montuje nowy widok, bez pozostawienia danych poprzedniego urządzenia w formularzach.

## Model i edycja

- Opcjonalne pola urządzenia: `rewir`, `description`, `defects`, `recommendations`, `numberNeedsVerification`, `photoPaths`, `primaryPhotoPath`. Brak GPS lub oceny ma wartość `null`; widok pokazuje „do ustalenia”. Rewir nie jest utożsamiany z obwodem.
- Numer pozostaje tekstem. Zmiana typu/numeru nie zmienia ID dokumentu, ścieżek zdjęć, komentarzy ani podkolekcji. Numery 1001–1007 można później edytować; znacznik weryfikacji jest osobnym polem.
- Formularz pokazuje podsumowanie przed zapisem. Wersja dokumentu jest zapamiętywana podczas przygotowania zmiany; aktualizacja w tle wymaga ponownego przeglądu. Transakcja sprawdza wersję ponownie.
- Transakcja zapisuje historię w `devices/{id}/edits/{version}`. Oryginalne `createdAt`/`createdBy` pozostają niezmienne; `updatedAt`/`updatedBy` i `version` zachowują dotychczasowe techniczne znaczenie. Biznesowa data aktualizacji inwentaryzacji jest oddzielna.
- Komentarze administrator może edytować i ukrywać. Zmiana treści zachowuje autora i oryginalny czas oraz poprzednią treść w niezmiennej historii komentarza. Member może tylko przeglądać i dodawać komentarze.

## Unikalność numerów — warunek przed przyszłym uruchomieniem

Nowe dokumenty nadal otrzymują początkowe ID typu `ambona-4a`. Edytowany dokument zachowuje dotychczasowe ID, również losowe. `deviceNumbers/{typ-numer}` stanowi transakcyjny indeks rezerwacji, nie alternatywny rejestr urządzeń. Transakcja sprawdza również starsze dokumenty z numerami liczbowymi.

**Nie wolno włączać zmian tożsamości ani tworzenia nowych urządzeń przed sprawdzeniem kompletności indeksu starych urządzeń.** Reguły wymagają zaufanego znacznika `deviceRegistry/identityIndex.ready == true`; klient nie może go ustawić. Bez niego zwykła edycja pozostaje dostępna, natomiast tworzenie i zmiana typu/numeru są blokowane. To zabezpiecza stare dokumenty o losowych ID, których reguły nie mogą samodzielnie przeszukać.

Przed ewentualnym wdrożeniem potrzebna jest osobno zatwierdzona operacja administracyjna: wykonać kopię/odczyt istniejących danych, sprawdzić wszystkie znormalizowane pary typ+numer, rozstrzygnąć istniejące kolizje, utworzyć komplet rezerwacji wskazujących zachowane ID, sprawdzić kompletność i dopiero wtedy ustawić znacznik gotowości. Podczas tego przygotowania należy wstrzymać zmiany tożsamości. Nie wykonano tej operacji ani żadnej migracji produkcyjnej. Testy inicjalizują wyłącznie fikcyjne dane emulatora.

## Zdjęcia i dostęp

Istniejąca podkolekcja `media` pozostaje źródłem dokumentacji. `photoStatus` rozdziela `aktualne`, `archiwalne` i nieustaloną aktualność (`null`). Nie wyprowadzamy jej z `isCurrent`, który dotyczy okładki. Podsumowanie `photoPaths`/`primaryPhotoPath` i `currentPhotoId` aktualizują się w tej samej transakcji. Starsze okładki można odczytać przez `currentPhotoId` bez migracji.

Administrator może przypisać istniejącą ścieżkę, dodać plik JPG/PNG/WebP do 10 MB, ustawić główne zdjęcie, zmienić aktualność oraz odłączyć zdjęcie. Przed operacją wymagane jest potwierdzenie. Odłączenie oznacza `hidden`; nie usuwa pliku ani historycznego dokumentu. Reguły Storage blokują nadpisanie i fizyczne usuwanie także administratorowi. Gdy upload się powiedzie, ale przypisanie zawiedzie, interfejs pokazuje ścieżkę zachowanego pliku do ponownego przypisania.

Nowe pliki Storage odczytywane są uwierzytelnionym żądaniem jako blob, bez generowania publicznych linków z tokenem. Reguły Firestore i Storage sprawdzają aktywny wpis `authorizedUsers` oraz rolę administratora. Pliki wcześniej umieszczone w `public/images/` pozostają publicznymi zasobami strony; bramka rejestru nie czyni już opublikowanych plików prywatnymi. Nie przenoszono ich ani nie zmieniano dostępu. Przed przyszłym użyciem Storage w przeglądarce trzeba również zweryfikować konfigurację bucketa i CORS; produkcji nie używano podczas kontroli.

## Dane źródłowe

Nie importowano 21 urządzeń do aplikacyjnej bazy. Zachowano lokalny szkic, dostępne opisy 33/34, osiem istniejących WebP i 11 przypisań opiekunów. Nie zastąpiono braków domysłami. Test lokalnego szkicu sprawdza ich zachowanie oraz niezmienione hashe stagingu. Dane osobowe, rzeczywiste rekordy i zdjęcia nie są dołączone do kodu testów ani do zmian Git. Aplikacja otrzyma je dopiero w odrębnie zatwierdzonym imporcie; nie ma automatycznego zasiewania danych.

## Kontrole

- `npm.cmd test`: **106/106 PASS**, 15 plików testowych.
- `npm.cmd run test:firestore-rules`: 30/30, w tym 27 testów Firestore i 3 Storage, tylko `demo-nemrod40` na 127.0.0.1:8080/9199.
- Testy obejmują widoki, filtrowanie, trasę szczegółową, bramkę logowania, role, podsumowanie edycji, zachowanie ID, kolizje i konkurencyjne rezerwacje, galerię, okładkę, odłączenie oraz blokadę nadpisania/usunięcia pliku.
- Lokalny szkic danych: 14/14. Nie jest to wizualna kontrola przeglądarkowa.
- `npm.cmd run lint`: **PASS**. `npm.cmd run build`: **PASS**. `git diff --check`: **PASS**. Build zgłasza ostrzeżenie o głównym pakiecie większym niż 500 kB.
- Nie wykonywano deployu, importu, uploadu do produkcji, zapisu do produkcyjnego Firestore, commita ani pusha. Testy Storage tworzą wyłącznie fikcyjne obiekty w emulatorze i usuwają środowisko testowe po zakończeniu.

Materiały `_import-local/`, logi, cache emulatorów i `dist/` pozostają poza commitem. Wcześniejsze nieśledzone `registryDraft.ts` i `registryDraft.test.ts` pozostawiono bez zmian; nie są nowym modelem produkcyjnym.

## Pełna lista plików zmienionych w tym etapie

- [docs/REJESTR-ZMIANY-2026-09-29.md](../docs/REJESTR-ZMIANY-2026-09-29.md)
- [firebase.json](../firebase.json)
- [firestore.rules](../firestore.rules)
- [package.json](../package.json)
- [src/devices/AdminDeviceForms.test.tsx](../src/devices/AdminDeviceForms.test.tsx)
- [src/devices/AdminDeviceForms.tsx](../src/devices/AdminDeviceForms.tsx)
- [src/devices/CommentEditForm.tsx](../src/devices/CommentEditForm.tsx)
- [src/devices/DeviceEditForm.tsx](../src/devices/DeviceEditForm.tsx)
- [src/devices/DeviceEditHistory.tsx](../src/devices/DeviceEditHistory.tsx)
- [src/devices/DeviceGallery.tsx](../src/devices/DeviceGallery.tsx)
- [src/devices/DeviceViews.test.tsx](../src/devices/DeviceViews.test.tsx)
- [src/devices/DeviceViews.tsx](../src/devices/DeviceViews.tsx)
- [src/devices/RegistryTable.tsx](../src/devices/RegistryTable.tsx)
- [src/devices/commentRepository.ts](../src/devices/commentRepository.ts)
- [src/devices/converters.ts](../src/devices/converters.ts)
- [src/devices/devicePhotos.ts](../src/devices/devicePhotos.ts)
- [src/devices/deviceRepository.test.ts](../src/devices/deviceRepository.test.ts)
- [src/devices/deviceRepository.ts](../src/devices/deviceRepository.ts)
- [src/devices/deviceUtils.ts](../src/devices/deviceUtils.ts)
- [src/devices/firestoreRules.test.ts](../src/devices/firestoreRules.test.ts)
- [src/devices/inventoryModel.test.ts](../src/devices/inventoryModel.test.ts)
- [src/devices/mediaRepository.test.ts](../src/devices/mediaRepository.test.ts)
- [src/devices/mediaRepository.ts](../src/devices/mediaRepository.ts)
- [src/devices/models.ts](../src/devices/models.ts)
- [src/devices/registry.css](../src/devices/registry.css)
- [src/devices/registryApplication.test.tsx](../src/devices/registryApplication.test.tsx)
- [src/devices/useDeviceData.ts](../src/devices/useDeviceData.ts)
- [src/devices/validation.ts](../src/devices/validation.ts)
- [storage.rules](../storage.rules)
- [tests/firestore-rules/firestore.rules.test.ts](../tests/firestore-rules/firestore.rules.test.ts)
- [tests/firestore-rules/storage.rules.test.ts](../tests/firestore-rules/storage.rules.test.ts)

Wcześniejsze pliki nieśledzone, zachowane bez edycji:

- [src/devices/registryDraft.ts](../src/devices/registryDraft.ts)
- [src/devices/registryDraft.test.ts](../src/devices/registryDraft.test.ts)

Indeks Git pozostaje pusty. Kontrola nazw plików nie wykazała materiałów importowych, zdjęć, plików .env ani logów w zestawie zmian. Kontrola typowych sygnatur sekretów nie znalazła dopasowań; nie jest to formalny audyt bezpieczeństwa całego repozytorium.

## Historyczny audyt przed poprawkami — zachowany jako zapis wykrytych błędów

**WYMAGA POPRAWEK.** W tym audycie nie zmieniano kodu aplikacji ani reguł. Dopisano raport i przygotowano izolowane testy diagnostyczne w ignorowanym katalogu `_import-local/ambony-2026-05/work/audit/`. Wszystkie dane testowe są fikcyjne. Nie odczytywano produkcji, więc przypadki regresji nie stanowią twierdzenia, że takie konflikty już występują w produkcyjnych dokumentach.

### Wyniki wykonane ponownie

| Kontrola | Wynik |
|---|---|
| Standardowe testy aplikacji | 106/106 PASS, 15 plików |
| Standardowe testy reguł | 30/30 PASS: 27 Firestore, 3 Storage |
| Dodatkowy audyt repozytoriów na emulatorze | 10/13 PASS, **3 FAIL** |
| `git diff --check` | PASS |
| Indeks Git | pusty |
| Lint i build | PASS w poprzednim etapie; nie uruchamiano ponownie, ponieważ audyt nie zmienił kodu aplikacji |

Emulatory: wyłącznie projekt `demo-nemrod40`, Firestore 127.0.0.1:8080 i Storage 127.0.0.1:9199. Zestaw audytowy wywołuje rzeczywiste `updateDevice`, `createDevice`, funkcje galerii i komentarzy z klientem emulatora; nie są to tylko testy skopiowanych payloadów. Wyniki maszynowe: `_import-local/ambony-2026-05/work/audit/results.json`; szczegóły: `emulator.log`. Pierwsza próba uruchomienia audytu zakończyła się błędem składni ścieżki Windows przed wykonaniem testów; poprawny przebieg zakończył się trzema opisanymi poniżej regresjami.

### Błędy wymagające poprawy

1. **P1 — zwykła edycja zależy od rezerwacji numeru.** `updateDevice()` w `src/devices/deviceRepository.ts:108` zawsze odczytuje rezerwację, a w linii 120 zawsze ją zapisuje, nawet gdy nie zmienia się numer ani typ. Reprodukcja: dwa starsze losowe ID mają ten sam typ i numer; po zmianie opisu pierwszego próba zmiany samego opiekuna drugiego kończy się `device_already_exists`. Formularz przesyła numer/typ również przy zmianie samego opisu, więc dodatkowo sprawdza kolizje całej kolekcji. Poprawka: odseparować zwykłe pola od zmiany tożsamości; przy niezmienionej znormalizowanej parze typ+numer nie wymagać rezerwacji, nie zmieniać surowego numeru i nie blokować poprawiania danych pozostałych. Kolizję nadal należy blokować przy rzeczywistej zmianie typu/numeru i tworzeniu urządzenia.

2. **P1 — normalizacja starego numeru blokuje zwykły formularz przed aktywacją indeksu.** Dla `number: "4a"` formularz wysyła `"4A"`. Repozytorium traktuje to jako tę samą tożsamość po normalizacji, ale `sameIdentity()` w regułach porównuje tekst dosłownie. Zapis samego opisu z pełnego formularza kończy się `PERMISSION_DENIED`, gdy brak znacznika gotowości. Poprawka: spójnie rozpoznawać zmianę tożsamości; bez zmiany znaczenia numeru pozostawić pierwotny zapis w patchu lub usunąć numer/typ z patcha. Nie odblokowywać wszystkich zmian tożsamości przed indeksem.

3. **P2 — można ponownie użyć starej historii komentarza.** Reguła `firestore.rules:116` sprawdza tylko, czy wskazana historia ma `before` zgodne z obecną treścią. Reprodukcja administratora: A→B, B→A, następnie A→C ze wskazaniem historii pierwszej zmiany. Ostatni zapis przechodzi bez nowego wpisu opisującego C. Member nadal nie może edytować komentarza; problem dotyczy gwarancji kompletności historii administratora. Poprawka: powiązać historię także z `after`, autorem, czasem bieżącego żądania i nowym identyfikatorem; dopisać test odrzucający ponowne użycie wpisu.

Testy regresji należy następnie przenieść do utrzymywanego zestawu testów emulatorowych i wymagać ich przejścia przed commitem. Audyt nie naprawia tych błędów ani nie zmienia oczekiwań testów na niebezpieczne zachowanie.

### Co działa i co rzeczywiście sprawdzono

- Unikalny starszy dokument o losowym ID i liczbowym numerze: edycja opisu, opiekuna oraz GPS działa bez znacznika gotowości; historia zostaje zapisana. Zmiana liczbowego 40 na tekstowe "40" w pełnym formularzu także działa.
- Dodanie przypisania zdjęcia, wybór głównego, zmiana aktualności i odłączenie działają bez gotowego indeksu; nie tworzą rezerwacji numerów. Oryginalny dokument medium pozostaje zachowany.
- Aktywny member może czytać i dodawać komentarz, ale nie może edytować metryczki, przypisywać zdjęć ani edytować komentarzy. Niezalogowany nie uzyskuje dostępu w standardowych testach reguł. Storage blokuje upload membera, odczyt anonimowy, nadpisanie i usunięcie pliku.
- Po kompletnym testowym indeksowaniu rezerwacja wskazuje rzeczywiste losowe ID. Kolizja tego samego typu i numeru jest odrzucana, ten sam numer innego typu jest dozwolony, a dwóch równoczesnych kandydatów do tego samego numeru daje dokładnie jeden udany zapis.
- Zmiana numeru zachowuje ID, createdAt i komentarz pod istniejącą ścieżką. Bez gotowości indeksu tworzenie i zmiana numeru są blokowane, a żaden klient admin/member nie może sam ustawić `ready`.

### Jak powstaje indeks obecnie

Kod aplikacji tworzy tylko pojedynczą rezerwację przy `createDevice()` albo `updateDevice()`. Nie skanuje wszystkich starszych dokumentów w celu zapisania kompletnego indeksu i nie ustawia znacznika gotowości. Odczyt `getDocs()` służy wykryciu kolizji, a nie backfillowi. W `scripts/` nie ma narzędzia budowy/weryfikacji indeksu. Objęcie wszystkich losowych ID jest więc **możliwe i sprawdzone na testowej inicjalizacji**, lecz **nie jest zaimplementowaną automatyczną operacją aplikacji ani wykonanym działaniem na produkcji**.

Istniejący zestaw reguł ustawia w fixture `ready:true`, mimo że nie indeksuje starszego `device-test`. Taki fixture nie potwierdza kompletności indeksu. Dodatkowy test wykazał, że przedwczesne `ready:true` z brakującą rezerwacją pozwala bezpośredniemu zapisowi admina utworzyć duplikat starszego losowego ID. Interfejs dodatkowo wyszukuje starsze numery, ale nie zastępuje to kompletności indeksu. Jest to warunek zaufanej inicjalizacji, a nie uprawnienie przyznane memberowi.

### Dokładny plan uruchomienia indeksu — do wykonania dopiero po odrębnej zgodzie

1. Najpierw naprawić trzy regresje. Przygotować osobne narzędzie administracyjne z trybem tylko-odczyt/dry-run, walidacją projektu, jawnym trybem apply, manifestem wyników, bezpiecznym wznowieniem i kontrolą istniejących rezerwacji. Obecnie takie narzędzie nie istnieje; nie ma gotowej komendy produkcyjnej do uruchomienia.
2. Po zgodzie na późniejsze wdrożenie zapewnić blokadę tworzenia i zmian tożsamości we wszystkich klientach i zewnętrznych procesach. Wdrożyć reguły wymagające gotowości; znacznik pozostawić nieobecny lub `ready:false`. Dopiero po poprawce nr 1 zwykłe zmiany opisu/GPS/opiekuna będą całkowicie niezależne od budowy indeksu. Nie zakładać, że samo zablokowanie przycisku w interfejsie wystarczy.
3. Wykonać kopię i pełny odczyt kolekcji `devices`, obejmujący dokumenty aktywne, wyłączone i archiwalne, ID kanoniczne oraz losowe. Nie importować przy tej operacji lokalnych 21 urządzeń. Zachować źródłowe ID, wersję i parę typ+numer w manifeście.
4. W dry-run znormalizować numer dokładnie jak aplikacja: `String(number).trim().toUpperCase()`, następnie zweryfikować format. Klucz rezerwacji: `${type}-${normalizedNumber.toLowerCase()}`. Typ pozostaje źródłowy; nie zmieniać automatycznie `lizawka` ani nie łączyć urządzeń różnych typów. Numery tymczasowe pozostają tymczasowe. Braki, niepoprawne wartości, dwie takie same pary typ+numer oraz sprzeczne rezerwacje zatrzymują aktywację i trafiają do decyzji, bez zgadywania numerów.
5. Po zaakceptowaniu bezkonfliktowego manifestu zapisać wyłącznie `deviceNumbers/{klucz}` z polami `deviceId` = oryginalne ID, `type`, tekstowe `number`, `updatedBy`, `updatedAt`. Nie przepisywać samych dokumentów urządzeń, ich pól audytowych ani podkolekcji. Rezerwacja zgodna z manifestem jest idempotentna; wskazująca inne ID powoduje przerwanie, nigdy ciche nadpisanie. Zapisywać partiami z checkpointami, przez zaufane środowisko administracyjne, bez kluczy w repozytorium.
6. Nadal przy zablokowanych zmianach tożsamości ponownie odczytać wszystkie urządzenia i rezerwacje. Wymagać pełnej zgodności manifestu: każda poprawna para ma dokładnie jedną rezerwację właściwego ID, każda rezerwacja wskazuje istniejące urządzenie tej samej tożsamości, nie ma pominiętych losowych ID, duplikatów ani osieroconych wpisów. Sprawdzać pary i ID, nie tylko równość liczników. Zmiana zbioru urządzeń/tożsamości od dry-run wymaga ponowienia weryfikacji.
7. Dopiero po niezależnej weryfikacji ustawić przez zaufany backend `deviceRegistry/identityIndex.ready:true`; zachować identyfikator przebiegu, datę, liczby rekordów i skrót manifestu w dokumentacji inicjalizacji. Aplikacja kliencka nadal nie może ustawiać tego znacznika. Zdjąć blokadę zmian tożsamości dopiero po potwierdzeniu poprawnego wdrożenia reguł i zgodnej wersji aplikacji.
8. Przy przerwaniu inicjalizacji pozostawić `ready:false` i wznowić idempotentnie z manifestu. Przy wykryciu problemu po aktywacji ustawić `ready:false` z zaufanego backendu, wstrzymać zmiany tożsamości i porównać dane z manifestem. Nie kasować w ciemno rezerwacji ani nie przywracać starego indeksu po nowych zmianach numerów. Odrębnie uzgodnić każdą korektę danych. Próbne operacje kolizji wykonywać na emulatorze; ten audyt nie autoryzuje próbnych zapisów produkcyjnych.

### Pozostałe ryzyka i zakres commita

- Dopóki nie istnieje sprawdzone narzędzie inicjalizacji i kompletna weryfikacja, funkcji tworzenia/zmiany numerów nie można bezpiecznie aktywować na starszej bazie.
- Osiem istniejących zdjęć w `public/images/` pozostaje publicznymi zasobami; same reguły Storage nie ukrywają plików publicznej strony. Produkcyjne CORS/bucket i wizualny przebieg uploadu nie były sprawdzane.
- Build z poprzedniego etapu ostrzega o dużym pakiecie JavaScript. To nie jest przyczyna negatywnej oceny commita; przyczyną są potwierdzone regresje.
- Lista 31 plików powyżej pozostaje aktualna. Dwa wcześniejsze pliki `registryDraft.ts` i `registryDraft.test.ts` są osobną, niezmienioną pracą. Nowe diagnostyczne testy/logi tego audytu są wyłącznie w ignorowanym `_import-local/`; nie należy ich przypadkowo dodawać do commita razem z materiałami importowymi.
- Nie wykonano `git add`, commita, pusha, deployu, importu ani operacji na produkcyjnym Firestore/Storage.

## Wykonane poprawki po audycie

- Zwykłe edycje nie dotykają deviceNumbers. Niezmieniona znormalizowana tożsamość zachowuje surowy zapis numeru, także liczbowy lub małe litery. Kolizje nadal blokują tworzenie i rzeczywiste zmiany tożsamości.
- Reguły komentarzy wymagają nowego wpisu historii, zgodnego z before, after, autorem i czasem bieżącego zapisu. Nie można ponownie użyć starego wpisu.
- 13 dodatkowych scenariuszy audytowych przeniesiono do tests/firestore-rules/registryRepository.integration.test.ts; wszystkie przechodzą. Test niekompletnego indeksu z ręcznie ustawionym ready:true pozostaje ilustracją zakazanego sposobu aktywacji — zastępuje go zweryfikowana procedura narzędzia.
- Dodano scripts/device-number-index.mjs oraz 8 testów emulatorowych jego logiki i CLI. Sprawdzono dry-run bez zapisów, losowe ID, zgodność typów, kolizje/braki, ochronę przed nadpisaniem, wznowienie, brak zmian dokumentów i komentarzy, zmianę źródła oraz jawne zatwierdzenie aktywacji.
- Narzędzie jest objęte lintem i nie wymaga nowych zależności. Instrukcja: [INDEKS-NUMEROW.md](INDEKS-NUMEROW.md). Historyczne stwierdzenia o braku narzędzia w poprzednim audycie nie opisują już aktualnego stanu.

| Końcowa kontrola | Wynik |
|---|---|
| npm.cmd test | 106/106 PASS |
| npm.cmd run test:firestore-rules | 51/51 PASS: 30 wcześniejszych, 13 audytowych, 8 indeksu |
| npm.cmd run lint | PASS, w tym nowe narzędzie |
| npm.cmd run build | PASS; ostrzeżenie o pakiecie >500 kB pozostaje |
| node --check scripts/device-number-index.mjs | PASS |
| git diff --check | PASS |

Zachowano materiały źródłowe i wcześniejszy lokalny szkic. Brak produkcyjnych zapisów, importu, uploadu, inicjalizacji indeksu, deployu, git add, commita i pusha. Wszystkie zapisy testowe dotyczyły fikcyjnych danych demo-nemrod40. Indeks Git pozostaje pusty.

### Aktualna lista 36 plików do przeglądu

- [docs/INDEKS-NUMEROW.md](../docs/INDEKS-NUMEROW.md)
- [docs/REJESTR-ZMIANY-2026-09-29.md](../docs/REJESTR-ZMIANY-2026-09-29.md)
- [eslint.config.js](../eslint.config.js)
- [firebase.json](../firebase.json)
- [firestore.rules](../firestore.rules)
- [package.json](../package.json)
- [scripts/device-number-index.mjs](../scripts/device-number-index.mjs)
- [src/devices/AdminDeviceForms.test.tsx](../src/devices/AdminDeviceForms.test.tsx)
- [src/devices/AdminDeviceForms.tsx](../src/devices/AdminDeviceForms.tsx)
- [src/devices/CommentEditForm.tsx](../src/devices/CommentEditForm.tsx)
- [src/devices/DeviceEditForm.tsx](../src/devices/DeviceEditForm.tsx)
- [src/devices/DeviceEditHistory.tsx](../src/devices/DeviceEditHistory.tsx)
- [src/devices/DeviceGallery.tsx](../src/devices/DeviceGallery.tsx)
- [src/devices/DeviceViews.test.tsx](../src/devices/DeviceViews.test.tsx)
- [src/devices/DeviceViews.tsx](../src/devices/DeviceViews.tsx)
- [src/devices/RegistryTable.tsx](../src/devices/RegistryTable.tsx)
- [src/devices/commentRepository.ts](../src/devices/commentRepository.ts)
- [src/devices/converters.ts](../src/devices/converters.ts)
- [src/devices/devicePhotos.ts](../src/devices/devicePhotos.ts)
- [src/devices/deviceRepository.test.ts](../src/devices/deviceRepository.test.ts)
- [src/devices/deviceRepository.ts](../src/devices/deviceRepository.ts)
- [src/devices/deviceUtils.ts](../src/devices/deviceUtils.ts)
- [src/devices/firestoreRules.test.ts](../src/devices/firestoreRules.test.ts)
- [src/devices/inventoryModel.test.ts](../src/devices/inventoryModel.test.ts)
- [src/devices/mediaRepository.test.ts](../src/devices/mediaRepository.test.ts)
- [src/devices/mediaRepository.ts](../src/devices/mediaRepository.ts)
- [src/devices/models.ts](../src/devices/models.ts)
- [src/devices/registry.css](../src/devices/registry.css)
- [src/devices/registryApplication.test.tsx](../src/devices/registryApplication.test.tsx)
- [src/devices/useDeviceData.ts](../src/devices/useDeviceData.ts)
- [src/devices/validation.ts](../src/devices/validation.ts)
- [storage.rules](../storage.rules)
- [tests/firestore-rules/firestore.rules.test.ts](../tests/firestore-rules/firestore.rules.test.ts)
- [tests/firestore-rules/numberIndex.integration.test.ts](../tests/firestore-rules/numberIndex.integration.test.ts)
- [tests/firestore-rules/registryRepository.integration.test.ts](../tests/firestore-rules/registryRepository.integration.test.ts)
- [tests/firestore-rules/storage.rules.test.ts](../tests/firestore-rules/storage.rules.test.ts)

Dwa wcześniejsze pliki registryDraft.ts i registryDraft.test.ts pozostają niezmienione i nie są doliczone do tej listy. Manifesty, checkpointy, logi i materiały importowe nie należą do zestawu commita. Gotowość kodu do commita nie jest zgodą na wdrożenie ani uruchomienie produkcyjnego indeksu.
