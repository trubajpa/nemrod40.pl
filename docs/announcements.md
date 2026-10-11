# Ogłoszenia

Osobna strona `/panel/ogloszenia` w strefie członkowskiej korzysta z istniejącego
ProtectedRoute i kolekcji `announcements`. Forum pozostaje niezależne.

Ogłoszenie zawiera subject (1–160 znaków), body (1–10000), kind
(impreza/spotkanie/ustalenie/czyn/inne), authorUid, authorName i createdAt.
Komentarze w `announcements/{id}/comments/{commentId}` zawierają body (1–2000),
authorUid, authorName, createdAt. Odpowiedzi na komentarze nie są obsługiwane
i nie mają uprawnień zapisu w regułach. Daty zapisuje serwer.

Reakcja w `announcements/{id}/reactions/{uid}` zawiera uid, type
(heart/up/down), createdAt i updatedAt. Identyfikator to UID właściciela;
użytkownik może mieć dokładnie jeden dokument reakcji na ogłoszenie. Transakcja
usuwa ponownie klikniętą reakcję lub zastępuje ją innym rodzajem. Liczniki
pochodzą z aktualnych dokumentów; klient nie zapisuje liczników zbiorczych.

Reguły wymagają aktywnego authorizedUsers przy wszystkich odczytach i zapisach,
wiążą UID autora z request.auth.uid i jego nazwę z profilem uprawnień,
odrzucają dodatkowe pola, nieprawidłowe rodzaje i sfałszowane daty.
Tworzenie komentarza/reakcji wymaga istniejącego ogłoszenia. Użytkownik może
zmienić lub usunąć wyłącznie własną reakcję; ogłoszeń i komentarzy nie edytuje.
Widok obserwuje najnowszych 50 ogłoszeń, ich komentarze i reakcje w czasie
rzeczywistym. Dostęp znika zgodnie z istniejącą kontrolą sesji.

Testy komponentu sprawdzają tworzenie ogłoszenia, komentarza, dodawanie i
cofanie wszystkich trzech reakcji, liczniki, błędy i brak dostępu.
`announcements.integration.test.ts` wywołuje rzeczywiste operacje repozytorium
na emulatorze Firestore oraz sprawdza podszywanie się, cudze reakcje,
nieaktywny dostęp, błędne schematy i zakaz odpowiedzi na komentarze.
