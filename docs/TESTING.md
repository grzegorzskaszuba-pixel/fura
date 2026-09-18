# TESTING

## 1. Cel dokumentu

Ten dokument opisuje strategie testowania AUTOlog (Carlog/Fura), standardy jakosci testow, warstwy pokrycia oraz bramki jakosci dla zmian frontend i backend.

Cel praktyczny:

- szybkie wykrywanie regresji funkcjonalnych i security
- utrzymanie stabilnosci API i UI podczas iteracji MVP
- przewidywalny proces walidacji zmian przed mergem i release

## 2. Zasady nadrzedne

- kazda zmiana funkcjonalna wymaga testu adekwatnego do warstwy ryzyka
- kazdy naprawiany bug wymaga testu regresyjnego
- testy powinny chronic zachowanie biznesowe, a nie przypadkowe detale implementacji
- suite testowe musza byc deterministyczne, niezalezne i powtarzalne

## 3. Stack i konfiguracja testow

Narzedzia:

- Vitest - testy unit i integration
- React Testing Library - testy UI
- Playwright - testy end-to-end
- jsdom - srodowisko testowe frontendu
- fake-indexeddb - wsparcie dla scenariuszy lokalnych/testowych

Konfiguracja:

- `vite.config.ts`: konfiguracja Vitest (`environment`, `setupFiles`, `include`)
- `src/test/setup.ts`: setup globalny testow frontend
- `playwright.config.ts`: konfiguracja E2E

## 4. Warstwy testow

### 4.1 Backend unit

Cel:

- izolowane testowanie logiki domenowej auth bez transportu HTTP

Zakres:

- rejestracja, logowanie, walidacja hasel
- reset i zmiana hasla
- oczekiwane bledy domenowe

Przyklad:

- `server/test/auth-core.unit.test.ts`

### 4.2 API integration

Cel:

- weryfikacja kontraktow endpointow, sesji i autoryzacji rekordow

Zakres:

- kody odpowiedzi i payloady
- ochrona endpointow przy braku sesji
- izolacja profilu i blokady dostepu do obcych danych
- CRUD dla `vehicles` i `service-events`

Przyklady:

- `server/test/auth-api.integration.test.ts`
- `server/test/data-api.integration.test.ts`

### 4.3 Frontend integration

Cel:

- testowanie zachowania UI i przeplywow formularzy z perspektywy uzytkownika

Zakres:

- ekran auth, walidacja i obsluga bledow
- przeplyw pracy z pojazdami i wpisami serwisowymi
- izolacja widokow i danych profilu

Przyklady:

- `src/test/app.test.tsx`
- `src/test/repositories.test.ts`
- `src/test/profile-isolation.regression.test.tsx`
- `src/test/auth-screen.regression.test.tsx`

### 4.4 Regression tests

Cel:

- utrzymanie stalej ochrony przed ponownym wystapieniem znanych bledow

Regula:

- kazdy istotny bug produkcyjny lub security musi pozostawic po sobie test regresyjny

Przyklad:

- `server/test/auth-security.regression.test.ts`

### 4.5 E2E (functional)

Cel:

- potwierdzenie krytycznych scenariuszy biznesowych na poziomie calej aplikacji

Zakres:

- mobile-first smoke flow
- kluczowe scenariusze uzytkownika koncowego

Przyklad:

- `tests/e2e/mobile.spec.ts`

### 4.6 Smoke test wysylki emaila

Na planie Render z dostepnym Shell mozna uruchomic test bezposrednio w backendzie:

```bash
npm run email:test -- grzegorz.s.kaszuba@gmail.com
```

Na planie Free nalezy tymczasowo dodac w `fura-api` zmienna `RESEND_TEST_TOKEN`, wykonac redeploy, a nastepnie wywolac backendowy endpoint z PowerShella:

```powershell
$headers = @{ 'X-Resend-Test-Token' = '<wartosc-RESEND_TEST_TOKEN>' }
$body = @{ to = 'grzegorz.s.kaszuba@gmail.com' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'https://api.fura.info/api/email/test' -Headers $headers -ContentType 'application/json' -Body $body
```

Endpoint wymaga jednoczesnie `RESEND_API_KEY` i `RESEND_TEST_TOKEN` w `fura-api`; bez tokenu zwraca `404` i pozostaje nieaktywny. Po potwierdzeniu wysylki usun `RESEND_TEST_TOKEN` z Render.

### 4.7 Potwierdzenie adresu e-mail

Scenariusz MVP:

1. Rejestracja zapisuje oczekujace zgloszenie bez tworzenia profilu i sesji, a nastepnie wysyla link wazny 24 godziny.
2. Wejscie w link otwiera `/verify-email?token=...` i dopiero wtedy tworzy aktywny profil oraz dane logowania.
3. Niepoprawny token, wygasniecie lub blad wysylki nie tworza profilu.
4. Ekran oczekiwania pozwala wyslac link ponownie; poprzedni token zostaje uniewazniony.

Pokrycie automatyczne:

- `server/test/email-verification.unit.test.ts`
- `server/test/email-verification-api.integration.test.ts`

## 5. Komendy uruchamiania testow

Podstawowe komendy:

```bash
npm run test
npm run test:backend
npm run test:api
npm run test:frontend
npm run test:regression
npm run test:functional
npm run test:e2e
npm run test:all
```

Bramki jakosci:

```bash
npm run verify
npm run verify:full
```

Znaczenie bramek:

- `verify`: lint + typecheck + test + build
- `verify:full`: `verify` + Playwright E2E

## 6. Strategia doboru testu do zmiany

Dobieraj warstwe najnizej, na ktorej mozna wiarygodnie wykryc problem:

- logika czysta -> backend unit
- kontrakt HTTP / sesja / autoryzacja -> API integration
- zachowanie komponentu i formularza -> frontend integration
- przeplyw cross-modulowy i runtime -> E2E

To podejscie minimalizuje koszt utrzymania testow i skraca feedback loop.

## 7. Standardy jakosci testow

Wymagania dla nowych testow:

- czytelny model Arrange-Act-Assert
- brak zaleznosci miedzy przypadkami testowymi
- deterministyczne dane i stan poczatkowy
- asercje na zachowanie biznesowe i kontrakty
- brak flaky source (przypadkowe timeouty, niestabilne selektory)

Praktyki zalecane:

- test names opisujace efekt biznesowy
- minimalna liczba mockow tam, gdzie mozliwa jest lekka integracja
- dla security bugfixow: test negatywny + test pozytywny

## 8. Coverage minimalne (MVP+)

### 8.1 Auth

- register/login/session/logout
- change-password i ochrona reset-password
- przypadki braku sesji i niepoprawnych danych

### 8.2 Data API

- profile scope isolation
- vehicle CRUD z autoryzacja
- service-event CRUD z autoryzacja i walidacja payloadow

### 8.3 Frontend

- ekran auth i handling bledow API
- scenariusze dodawania/edycji/usuwania pojazdu
- scenariusze dodawania/edycji/usuwania wpisu
- puste stany i podstawowa nawigacja widokow

### 8.4 Regression

- stale utrzymanie testow dla wykrytych incydentow
- zero usuwania testu regresyjnego bez zamiennika

## 9. Procedura dla PR

Przy kazdej zmianie kodu:

1. Okresl warstwy ryzyka (auth/API/UI/E2E).
2. Dodaj lub zaktualizuj testy adekwatne do zmiany.
3. Uruchom minimum `npm run test` oraz suite dotkniete zmiana.
4. Przed merge uruchom `npm run verify`.
5. Dla zmian krytycznych auth/API lub flow uzytkownika uruchom `npm run verify:full`.

## 10. CI i quality gates

Minimalne wymagania CI:

- lint
- typecheck
- Vitest suites
- E2E dla zmian aplikacyjnych lub recznie wymuszonych

Wymagania merge:

- zielone testy warstwy dotknietej zmiana
- aktualizacja testow przy zmianie zachowania
- dodany test regresyjny przy naprawie bledow

## 11. Ryzyka testowe i mitigacje

Typowe ryzyka:

- flaky E2E przez niestabilne selektory i timeouty
- luki w testach negatywnych auth i autoryzacji
- rozjazd dokumentacji testowej i rzeczywistego workflow

Mitigacje:

- standaryzacja selektorow i helperow testowych
- regularny przeglad suite regresyjnych
- utrzymywanie dokumentu w zgodzie z aktualnymi skryptami i konfiguracja

## 12. Kryterium Done dla testow

Zmiana jest gotowa, gdy:

- testy sa dodane lub zaktualizowane adekwatnie do zakresu zmiany
- lokalne suite przechodza dla dotknietej warstwy
- bramka `verify` (lub `verify:full` dla zmian krytycznych) jest zielona
- dokumentacja testowa pozostaje zgodna z implementacja