# Import urządzeń i zdjęć

Narzędzie `scripts/device-import.mjs` pracuje wyłącznie z jawnym projektem i bucketem. Domyślnie używa lokalnego stagingu `_import-local/ambony-2026-05/prepared/import-local.json` oraz planu zdjęć z tego samego katalogu.

## Dry-run

```powershell
npm.cmd run import:devices -- dry-run --project nemrod40pl --confirm-project nemrod40pl --bucket nemrod40pl.firebasestorage.app
```

Dry-run nie wykonuje zapisów. Sprawdza 21 rekordów, typy, potwierdzone numery i kanoniczne ID, GPS oraz linki Maps, wykonywalne szablony, przypisania i hashe zdjęć, dokładnie jedną okładkę na urządzenie, kolizje ze wszystkimi dokumentami `devices`, rezerwacjami `deviceNumbers` i obiektami `devices/` w Storage. Raport JSON i Markdown trafia do ignorowanego katalogu `_import-local`.

## Apply

Apply jest możliwe wyłącznie dla raportu z `readyForApply=true`. Wymaga identycznego hasha manifestu, UID operatora oraz dokładnej frazy zatwierdzenia:

```powershell
npm.cmd run import:devices -- apply --project nemrod40pl --confirm-project nemrod40pl --bucket nemrod40pl.firebasestorage.app --manifest-sha256 HASH_Z_DRY_RUN --operator-uid UID --approval "POTWIERDZAM IMPORT 21 URZĄDZEŃ, GPS I ZDJĘĆ" --bindings _import-local/ambony-2026-05/prepared/import-bindings.json
```

Wiązania historycznego autora i zatwierdzeń są odczytywane z lokalnego pliku podanego przez `--bindings`; plik nie może trafić do Git. Obiekty Storage są tworzone z warunkiem `ifGenerationMatch=0`, a dokumenty Firestore z warunkiem `exists=false`. Istniejące dane nie są nadpisywane ani usuwane. Checkpoint i dziennik NDJSON umożliwiają wznowienie zakończonych etapów. Zmiana stanu Firestore lub Storage po dry-run wymusza nowy dry-run.

Importer nie zapisuje i nie aktywuje `deviceRegistry/identityIndex.ready` ani nie zmienia `deviceNumbers`.
