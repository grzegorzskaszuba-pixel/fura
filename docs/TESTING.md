# TESTING

## Zakres

- Vitest + React Testing Library: logika repozytoriów i główne flow UI
- Playwright: podstawowy mobile-first smoke test

## Pokryte scenariusze

- przełączanie auta
- dodanie auta
- dodanie wykonanego serwisu
- zaplanowanie serwisu
- przełączanie Historia / Plan
- filtrowanie danych po `profileId`
- widoczność sticky akcji mobile

## Komendy

```bash
npm run test
npm run test:e2e
npm run verify
```

## Uwagi

- `npm run test` nie uruchamia Playwrighta
- `npm run test:e2e` używa osobnej konfiguracji i lokalnego serwera Vite