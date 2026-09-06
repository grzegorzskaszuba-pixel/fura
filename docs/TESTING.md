# TESTING

## Cel

System testow ma byc prosty na start, ale stale rozwijany. Kazda nowa funkcja i kazda poprawka regresji powinna dopisac lub zaktualizowac testy.

## Warstwy testow

- backend unit: logika domenowa backendu bez HTTP (np. auth-core)
- API integration: endpointy HTTP i sesje (autoryzacja, profile scope)
- frontend integration: UI i warstwa danych po stronie aplikacji (Vitest + RTL)
- functional e2e: krytyczne flow uzytkownika (Playwright)
- regression: testy pod konkretne bledy, ktore juz kiedys wystapily

## Komendy

```bash
npm run test
npm run test:backend
npm run test:api
npm run test:frontend
npm run test:regression
npm run test:functional
npm run test:e2e
npm run test:all
npm run verify
npm run verify:full
```

## Startowy zakres

- backend unit: rejestracja/logowanie/zmiana hasla (auth core)
- API integration: izolacja profilu sesji, brak switch-profile, ochrona resetu hasla
- frontend integration: glowny flow MVP (auta, historia/plan, formularze)
- regression: brak podgladu obcych profili w menu uzytkownika
- e2e: mobile-first smoke flow

## Zasada rozbudowy

Przy kazdej zmianie kodu:

1. dodaj lub zaktualizuj co najmniej 1 test w najbardziej adekwatnej warstwie,
2. jesli naprawiasz bug, dodaj test regresyjny,
3. uruchom minimum `npm run test` i warstwe, ktorej dotyczy zmiana,
4. przed mergem uruchom `npm run verify`.

Przy duzych zmianach (nie kosmetycznych), nowych feature i zmianach w auth/API:

1. uruchom lokalnie `npm run verify:full`,
2. upewnij sie, ze PR zawiera aktualizacje testow warstwy dotknietej zmiana,
3. jesli zmiana dotyka flow uzytkownika, dodaj lub rozszerz test E2E.

## CI i bramki

- workflow CI uruchamia lint, typecheck i pelny Vitest na push/PR,
- testy E2E uruchamiaja sie automatycznie dla zmian aplikacyjnych (`src`, `server`, `tests`, `scripts`, konfiguracja),
- E2E mozna wymusic recznie przez `workflow_dispatch` z `run_e2e=true`.

## Uwagi

- `npm run test` uruchamia testy Vitest (frontend + backend)
- `npm run test:e2e` uruchamia Playwright na osobnym serwerze