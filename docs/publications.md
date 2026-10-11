# Wspólna publikacja treści

Jeden formularz w `/panel/informacje`, jedno repozytorium i jedna kolekcja
Firestore `announcements` (nazwa zachowana dla zgodności identyfikatorów).
`/panel/ogloszenia` przekierowuje do informacji dla członków. Publiczne
Aktualności, Działalność oraz aktualności na stronie głównej czytają ten sam
model. Forum, konta i rejestr urządzeń pozostają niezależne.

Wpis ma tytuł (`subject`), treść, autora/UID, serwerową datę, typ,
`placements` (members/news/activity), `publicStatus` (private/pending/approved),
`photos` (kolejność ścieżek), `mainPhoto`, `ready`, `approvedBy`, `approvedAt`.
Wszystkie nowe wpisy trafiają do members; dwa publiczne miejsca są opcjonalne
i mogą być zaznaczone jednocześnie. Samo zaznaczenie nie publikuje publicznie.
Nawet wpis administratora wymaga osobnego zatwierdzenia po zapisaniu zdjęć.
Reguły dopuszczają zatwierdzenie tylko przez aktualnego aktywnego admina.

Najpierw powstaje szkic ready=false. Autor przesyła do 12 zdjęć (JPG/PNG/WebP,
do 10 MB) do `publications/{id}/{file}`, następnie zapisuje kolejność, zdjęcie
główne i ready=true. Nieudany zapis nie pokazuje częściowego wpisu w listach.
Po tym etapie autor nie może zmienić treści lub zdjęć zatwierdzanych przez admina.
Storage nie pozwala nadpisać obiektów. Publiczny odczyt wymaga approved,
ready=true i obecności konkretnego pliku w photos. Nieprzypisane pliki pozostają
prywatne. Blob jest pobierany przez getBlob i zwalniany po zamknięciu widoku;
getDownloadURL i linki z tokenami nie są używane. Rejestr urządzeń korzysta
z tego samego pomocniczego pobierania blobów, z dotychczasowymi regułami.

Komentarze bez odpowiedzi i jedno serduszko na UID są wyłącznie w strefie
członkowskiej, również pod wpisami publicznymi. Stare kciuki nie są usuwane
z danych historycznych; nowy formularz i reguły pozwalają tylko na serduszko.

Przejście zachowuje sześć starych aktualności, ich slugi, daty tekstowe,
zdjęcia i film. Autor nieznany w starym materiale jest oznaczony nazwą koła.
Adapter archiwum chroni dostępność tych treści do zakończenia migracji;
legacySlug zapobiega duplikatom po imporcie. Opis i galeria Działalności
pozostają stałą treścią strony, a nowe wpisy pokazują się pod nimi.

Migracja używa Admin SDK i poświadczeń środowiska serwera, nigdy klucza w
przeglądarce. Domyślnie tylko raportuje plan. Tryb --apply uzupełnia stare
ogłoszenia jako prywatne, zachowując autora, datę i podkolekcje. Importuje
brakujące aktualności pod stałymi ID legacy-{slug}; ponowienie nie duplikuje
ani nie nadpisuje istniejących wpisów.

```powershell
node scripts/migrate-publications.mjs --project demo-nemrod40
node scripts/migrate-publications.mjs --project demo-nemrod40 --apply
```

Produkcja wymaga osobnego wdrożenia reguł Firestore i Storage oraz indeksu
z firestore.indexes.json, migracji z --project nemrod40pl i publikacji aplikacji.
Nie należy migrować produkcji z poświadczeniami emulatora. Testy migracji
uruchamiają skrypt dwa razy na demo-nemrod40 i sprawdzają zachowanie danych.
