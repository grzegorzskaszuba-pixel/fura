# SECURITY

## 1. Cel dokumentu

Ten dokument opisuje model bezpieczenstwa aplikacji AUTOlog (Carlog/Fura), aktualne mechanizmy ochronne, ograniczenia oraz zalecenia hardeningu dla produkcji.

Zakres obejmuje:

- uwierzytelnianie i zarzadzanie sesja
- autoryzacje dostepu do danych
- ochrone transportu i konfiguracji CORS
- ryzyka rezydualne i powierzchnie ataku
- praktyki operacyjne i testowe dla security

## 2. Kontekst architektoniczny

Aplikacja dziala w modelu backend-first:

- frontend realizuje logike UI i wywoluje API
- backend odpowiada za auth, autoryzacje i persystencje danych
- dane domenowe sa izolowane per aktywne `profileId` sesji

Kluczowe pliki implementacyjne:

- `server/auth-server.mjs` - transport HTTP, CORS, sesje, endpointy auth i data
- `server/auth-core.mjs` - logika domenowa auth, walidacje, hashowanie hasel
- `server/storage.mjs` - storage PostgreSQL/file fallback, retry policy, mapowanie bledow
- `src/shared/lib/http-client.ts` - klient HTTP, cookie credentials, fallback Authorization

## 3. Uwierzytelnianie

### 3.1 Mechanizm logowania i rejestracji

Endpointy auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/auth/reset-password`

Przeplyw:

1. Uzytkownik wysyla dane logowania/rejestracji do API.
2. Backend waliduje input i credentials.
3. Backend tworzy `sessionId`, ustawia cookie sesyjne i zwraca dane profilu.
4. Frontend kontynuuje prace w kontekcie sesji.

### 3.2 Hasla i weryfikacja

Aktualna implementacja:

- hashowanie hasel po stronie backendu z wykorzystaniem `scrypt`
- losowa sol per haslo
- porownanie hashy przez `timingSafeEqual`

Wnioski:

- hasla jawne nie sa przechowywane
- ograniczone jest ryzyko prostych atakow timingowych
- model jest adekwatny dla MVP, ale wymaga dalszego hardeningu produkcyjnego

## 4. Sesje, cookies i token fallback

### 4.1 Sesja podstawowa

Serwer utrzymuje mapowanie `sessionId -> profileId` w pamieci procesu.

Cookie sesyjne:

- `HttpOnly`
- `SameSite` konfigurowalne
- `Secure` wlaczane zaleznie od konfiguracji/srodowiska

### 4.2 Fallback bearer token

Frontend wspiera fallback `Authorization: Bearer <sessionId>`.

Cel:

- poprawa niezawodnosci auth przy roznych zachowaniach przegladarek i urzadzen dla cookie cross-origin

Konsekwencje bezpieczenstwa:

- token fallback moze byc przechowywany po stronie klienta
- wymaga szczegolnej ostroznosci przy XSS hardeningu i politykach CSP

## 5. Autoryzacja i izolacja danych

### 5.1 Zasady globalne

- brak aktywnej sesji: odpowiedz `401` dla zasobow chronionych
- operacje profilu wymagaja zgodnosci `sessionProfileId` i docelowego `profileId`
- endpoint `GET /api/profiles` zwraca tylko profil biezacej sesji

### 5.2 Scope rekordow domenowych

- pojazdy i wpisy serwisowe sa odczytywane i modyfikowane tylko w zakresie aktywnego profilu
- operacje CRUD waliduja przynaleznosc rekordow do profilu sesji
- blokowane sa proby dostepu horyzontalnego miedzy profilami

## 6. CORS i ochrona transportu

### 6.1 CORS

API wspiera jawna liste originow przez `AUTH_API_ALLOWED_ORIGINS`.

Naglowki i polityki:

- `Access-Control-Allow-Origin` (origin dopuszczony)
- `Access-Control-Allow-Credentials: true`
- kontrola metod i naglowkow
- `Vary: Origin`

### 6.2 TLS

W srodowisku produkcyjnym wymagane jest HTTPS end-to-end:

- frontend przez HTTPS
- API przez HTTPS
- cookies sesyjne z `Secure`

## 7. Storage i ochrona danych

### 7.1 Tryby storage

- docelowo: PostgreSQL
- fallback deweloperski: plik JSON (`server/data/auth-db.json`)

### 7.2 Kontrole i odpornosc

- retry dla bledow transient PostgreSQL (backoff + jitter)
- mapowanie bledow storage do bezpiecznych odpowiedzi API
- ograniczenie wycieku szczegolow technicznych do klienta

### 7.3 Migracje i spojnosc

- backend inicjalizuje schemat znormalizowany (`profiles`, `credentials`, `vehicles`, `service_events`)
- wspierana jest migracja danych legacy z `app_state`

## 8. Powierzchnie ataku

Istotne obszary:

- endpointy auth (`register`, `login`, `change-password`, `reset-password`)
- sesje i token fallback po stronie klienta
- konfiguracja CORS i origin whitelist
- formularze i payloady JSON wejscia
- komponenty UI przetwarzajace dane od uzytkownika

## 9. Ryzyka rezydualne

Najwazniejsze ryzyka w aktualnym stanie:

- sesje in-memory (restart procesu konczy wszystkie sesje)
- brak dedykowanego centralnego session store
- fallback bearer token po stronie klienta
- brak rate limitingu i mechanizmow anti-bruteforce na endpointach auth
- brak MFA i zaawansowanego IAM

## 10. Wymagania hardeningu produkcyjnego

Wymagania krytyczne:

- wymuszenie HTTPS i stale `Secure` dla cookies
- rate limiting dla endpointow auth
- ochrona brute-force (throttling, lockout policy, telemetry)
- trwaly session store (np. Redis lub tabela sesji)
- polityka TTL sesji i globalne uniewaznianie

Wymagania zalecane:

- audit log zdarzen auth i zmian krytycznych
- monitorowanie metryk `401/403/5xx` i alerting
- regularny przeglad zaleznosci i skan CVE
- jawna polityka zarzadzania sekretami

## 11. Security testing i gates

Minimalny zestaw walidacji security przy zmianach auth/API:

1. test autoryzacji per profil (brak dostepu do obcych danych)
2. testy regresyjne dla znalezionych bledow security
3. testy negatywne dla blednych payloadow i przypadkow braku sesji
4. uruchomienie co najmniej `npm run test:api` i `npm run test:regression`
5. przed wydaniem: `npm run verify` (lub `npm run verify:full` przy zmianach krytycznych)

## 12. Security checklist dla PR

Przy kazdym PR dotykajacym auth lub API:

- potwierdzic kontrole dostepu po `profileId`
- sprawdzic brak wycieku danych w odpowiedziach bledow
- zweryfikowac CORS dla docelowych originow
- upewnic sie, ze hasla nie trafiaja do logow
- dopisac/utrzymac testy regresyjne dla security

## 13. Podsumowanie

Aktualna architektura zapewnia podstawowa izolacje danych i backendowa kontrole dostepu, zgodna z celem MVP. Najwazniejszym krokiem do poziomu produkcyjnego jest utwardzenie warstwy sesji, auth endpointow i operacyjnej obserwowalnosci security.