# AUTOlog

AUTOlog to mobile-first web MVP dla właścicieli aut: prosty dziennik historii serwisowej, planowania serwisów i dokumentowania napraw. Aplikacja działa lokalnie na React + Vite + TypeScript, używa Dexie/IndexedDB jako demo warstwy danych i rozdziela dane po `profileId`.

## Zakres MVP

- demo logowanie, rejestracja lokalnego profilu i przełączanie profili
- jeden główny ekran zgodny z mockupem: hero auta, podsumowanie, historia i plan
- karuzela aut z aktywnym autem zapisywanym per profil
- dodawanie i edycja aut
- dodawanie, planowanie, edycja i usuwanie wpisów serwisowych
- lokalne repozytoria nad IndexedDB bez bezpośredniego dostępu UI do bazy
- seed danych demo i puste stany
- testy Vitest/RTL i Playwright dla podstawowego flow

## Stack

- React 19
- Vite
- TypeScript strict
- Tailwind CSS v4
- Radix UI + własne komponenty w stylu shadcn/ui
- Lucide Icons
- React Hook Form
- Zod
- Dexie / IndexedDB
- Vitest + React Testing Library
- Playwright

## Uruchomienie

Wymagania:

- Node.js 20+
- npm 10+

Komendy:

```bash
npm install
npm run dev
```

Aplikacja uruchamia się lokalnie pod adresem zwróconym przez Vite.

## Skrypty

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run verify
```

`npm run verify` uruchamia `lint`, `typecheck`, `test` i `build`.

## Dane i bezpieczeństwo

- każdy rekord domenowy używa `profileId`
- demo auth nie przechowuje haseł
- IndexedDB jest tylko warstwą lokalnego MVP i nie udaje produkcyjnego bezpieczeństwa
- docelowe bezpieczne logowanie wymaga backendu z hashowaniem haseł, sesjami HttpOnly oraz autoryzacją rekordów po stronie serwera

Szczegóły są w dokumentacji:

- [docs/PRODUCT.md](docs/PRODUCT.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/UI_UX.md](docs/UI_UX.md)
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [CHANGELOG.md](CHANGELOG.md)
