# Lista testów Firestore Rules Playground

Reguł nie należy wdrażać przed wykonaniem poniższych prób. Używaj wyłącznie danych syntetycznych. Dokument `authorizedUsers/member@example.test` powinien mieć `active: true`, `role: "member"`, `displayName: "Członek testowy"`; dokument administratora analogicznie `role: "admin"`.

| # | Ścieżka | Operacja | Uwierzytelnienie / token | Dane wejściowe | Wynik |
|---|---|---|---|---|---|
| 1 | `devices/device-test` | get/list | brak | — | DENY |
| 2 | `devices/device-test` | get/list | e-mail `inactive@example.test`, dokument z `active: false` | — | DENY |
| 3 | `devices/device-test` | get/list | UID `member-uid`, e-mail `member@example.test` | — | ALLOW |
| 4 | `devices/device-test/comments/comment-test` | create | UID `member-uid`, e-mail `member@example.test` | Pełny model komentarza; `authorUid: member-uid`, `authorName: Członek testowy`, `createdAt` jako czas żądania, status `nowy`, pola moderacji `null` | ALLOW |
| 5 | ta sama ścieżka | create | ten sam członek | Jak wyżej, ale inny `authorUid` albo `authorName` | DENY |
| 6 | `devices/device-test` | create/update/delete | aktywny member | Poprawny dokument urządzenia | DENY |
| 7 | `devices/device-test/inspections/inspection-test` | create | aktywny member | Poprawny przegląd | DENY |
| 8 | `devices/device-test/repairs/repair-test` | create | aktywny member | Poprawna naprawa | DENY |
| 9 | `devices/device-test` | create | UID `admin-uid`, e-mail `admin@example.test` | Pełna metryczka; `createdBy/updatedBy: admin-uid`, oba czasy równe czasowi żądania, `version: 1` | ALLOW |
| 10 | `devices/device-test` | update | administrator | Zachowane `createdBy/createdAt`, `updatedBy: admin-uid`, `updatedAt` jako czas żądania, `version` zwiększone dokładnie o 1 | ALLOW |
| 11 | `devices/device-test` | update | administrator | Próba zmiany `createdBy`, `createdAt` albo pominięcia inkrementacji wersji | DENY |
| 12 | `devices/device-test/comments/comment-test` | update | administrator | Zmiana tylko statusu i pól moderacji; `moderatedBy: admin-uid`, `moderatedAt` jako czas żądania | ALLOW |
| 13 | ta sama ścieżka | update | administrator | Jednoczesna zmiana `content`, `authorUid`, `authorName` lub `createdAt` | DENY |
| 14 | `devices/device-test/media/media-old` | update | administrator | Zmiana tylko `isCurrent`, `replacedBy` lub `hidden` | ALLOW |
| 15 | ta sama ścieżka | update | administrator | Próba zmiany `path`, `uploadedBy` lub `uploadedAt` | DENY |
| 16 | dowolny dokument urządzenia, komentarza, usterki, przeglądu, naprawy lub medium | delete | member lub admin | — | DENY |
| 17 | `authorizedUsers/member@example.test` | update | member lub admin | Próba ustawienia `role: admin` | DENY |
| 18 | `devices/device-test` | get | token z e-mailem `Member@example.test`, istnieje tylko dokument lowercase | — | DENY — bezpieczne potwierdzenie ryzyka wielkości liter |

W testach transakcji należy zasymulować wszystkie zapisy jednocześnie: przegląd + aktualizacja urządzenia, naprawa + aktualizacje usterek + aktualizacja urządzenia oraz nowe medium + aktualizacja starego medium + aktualizacja urządzenia.
