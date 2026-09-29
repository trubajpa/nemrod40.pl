# Indeks numerów — narzędzie administracyjne

Narzędzie: `scripts/device-number-index.mjs`. Korzysta z REST Firestore i jawnie wskazanego projektu; nie odczytuje konfiguracji Firebase aplikacji ani zapisanych sesji Firebase CLI. Nie importuje urządzeń, nie zmienia dokumentów urządzeń, historii, komentarzy ani zdjęć.

## Zakres i zabezpieczenia

- `dry-run` odczytuje wszystkie urządzenia (także archiwalne i z losowymi ID) oraz istniejące rezerwacje. Nie zapisuje niczego do Firestore. Tworzy nowy lokalny manifest; odmawia nadpisania istniejącego pliku.
- Numer normalizowany jest przez `String(number).trim().toUpperCase()`. Typ i numer muszą być poprawne. Klucz rezerwacji to typ + numer zapisany małymi literami; `deviceId` zawsze wskazuje oryginalne ID. Nie nadawane są brakujące numery. Oznaczenia numerów tymczasowych pozostają w urządzeniach bez zmian.
- Manifest zawiera projekt, schemat, uporządkowane tożsamości i SHA-256. Nie zawiera opisów, nazwisk, współrzędnych ani zdjęć.
- Kolizje, brakujące numery, sprzeczne/osierocone rezerwacje, zmienione źródło albo niezgodny manifest zatrzymują zapis/aktywację.
- `apply` wymaga operatora i `--freeze-confirmed`. Transakcyjnie rejestruje `ready:false` i identyfikator budowy. Nie wyłącza już aktywnego indeksu. Inny rozpoczęty manifest wymaga decyzji operatora — nie jest automatycznie zastępowany.
- Rezerwacje są tworzone partiami po maksymalnie 200 z warunkiem `exists:false`. Nie nadpisuje się istniejących wpisów; zgodne pomija się. Checkpoint jest informacyjny, a wznowienie opiera się na ponownym odczycie bazy.
- Po zapisie następuje transakcyjny odczyt całego zbioru urządzeń, rezerwacji i znacznika budowy. Dopiero zgodność wszystkich par/ID pozwala na `ready:true`, i tylko jeśli podano `--activate`.
- Bez `--activate` pozostaje `ready:false`. Powtórne apply tego samego manifestu z `--activate` weryfikuje ponownie i aktywuje. Powtórzenie ukończonego, niezmienionego przebiegu jest idempotentne.
- Opis/opiekun/GPS mogą zmienić się w trakcie budowy: skrót obejmuje tożsamość, nie pozostałe pola. Rzeczywista zmiana numeru/typu lub zbioru urządzeń przerywa aktywację.

## Przećwiczony wariant emulatorowy

Wyłącznie przy uruchomionym emulatorze projektu `demo-nemrod40`:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
node scripts/device-number-index.mjs dry-run --project demo-nemrod40 --manifest _import-local/index-demo.json
node scripts/device-number-index.mjs apply --project demo-nemrod40 --manifest _import-local/index-demo.json --operator emulator-operator --freeze-confirmed
node scripts/device-number-index.mjs apply --project demo-nemrod40 --manifest _import-local/index-demo.json --operator emulator-operator --freeze-confirmed --activate
```

Emulatorowy adres i projekt są sprawdzane przed połączeniem. Inne adresy/projekty w tym trybie są odrzucane. Testy stałe uruchamia `npm.cmd run test:firestore-rules` — obejmują także rzeczywiste wywołanie CLI, plik manifestu i checkpoint.

## Przyszłe uruchomienie produkcyjne — niewykonane, wymaga osobnej zgody

1. Uzgodnić projekt i kopię bezpieczeństwa. Przejrzeć zmiany reguł i wdrożenia jako oddzielną operację; obecna praca nie wykonała deployu.
2. Zapewnić blokadę tworzenia oraz zmian typu/numeru we wszystkich klientach i zewnętrznych procesach. Reguły z bramką gotowości muszą już obowiązywać, a znacznik musi być nieobecny lub `ready:false`. Sam parametr CLI jest oświadczeniem operatora, nie blokadą zewnętrznych skryptów Admin SDK.
3. Uruchomić produkcyjny `dry-run`, przejrzeć manifest, rozstrzygnąć braki/kolizje bez zgadywania danych. Nie importować przy tej okazji lokalnych 21 urządzeń.
4. Uruchomić `apply` bez `--activate`. Zweryfikować manifest, checkpoint i wszystkie rezerwacje.
5. Uruchomić ponownie ten sam manifest z `--activate`. Narzędzie ponownie weryfikuje dane przed aktywacją. Dopiero po sukcesie zdjąć blokadę zmian tożsamości.
6. Po przerwaniu powtórzyć ten sam manifest. Jeśli źródło zmieniło tożsamości albo istnieje sprzeczny indeks, pozostawić blokadę, przeanalizować różnice i jawnie uzgodnić nowy plan. Narzędzie nie usuwa wpisów i nie resetuje innej rozpoczętej budowy.

Tryb produkcyjny wymaga braku `FIRESTORE_EMULATOR_HOST`, jawnych `--production`, `--project <projekt>`, `--confirm-project <ten-sam-projekt>` oraz krótkotrwałego tokenu OAuth w zmiennej `NEMROD_INDEX_ACCESS_TOKEN`, uzyskanego przez zaufany proces administracyjny z właściwymi uprawnieniami IAM. Token nie jest argumentem polecenia, nie jest zapisany w manifeście i nie jest wypisywany. Nie zapisuj tokenu ani kluczy w `.env` lub repozytorium. Żaden taki token ani połączenie produkcyjne nie były użyte w testach.

Zwykła edycja dokumentów nie wymaga indeksu. Tworzenie lub rzeczywista zmiana typu/numeru nadal wymaga kompletnego indeksu. Sam znacznik `ready:true` nie stanowi dowodu kompletności, dlatego nie należy ustawiać go ręcznie zamiast procedury weryfikacji.

## Wycofanie i ograniczenia

W razie niepowodzenia budowy znacznik pozostaje `ready:false`, a zapisane poprawne rezerwacje służą wznowieniu. Narzędzie inicjalizujące nie dezaktywuje aktywnego indeksu. Po późniejszych zmianach numerów nie należy ponownie uruchamiać starego manifestu jako sposobu naprawy: źródło już mu nie odpowiada. Awaryjne wyłączenie przez zaufany backend, analiza i naprawa indeksu są osobno zatwierdzaną operacją. Nie usuwać rezerwacji w ciemno.

Weryfikacja końcowa używa transakcyjnych zapytań do wszystkich trzech kolekcji; musi zmieścić się w limitach czasu i rozmiaru Firestore. Błąd/timeout oznacza brak aktywacji, nie pominięcie kontroli. Działanie sprawdzono na lokalnym emulatorze, nie na produkcji. Manifesty, checkpointy i kopie rzeczywistych danych przechowuj w wykluczonym `_import-local/`.
