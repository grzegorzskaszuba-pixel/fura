# AUTOlog

AUTOlog to mobile-first web MVP dla właścicieli aut: prosty dziennik historii serwisowej, planowania serwisów i dokumentowania napraw. Aplikacja działa lokalnie na React + Vite + TypeScript, używa Dexie/IndexedDB jako warstwy danych i rozdziela dane po `profileId`.

## Zakres MVP

- logowanie/rejestracja lokalnego profilu z hasłem i przełączanie profili
- jeden główny ekran zgodny z mockupem: hero auta, podsumowanie, historia i plan
- karuzela aut z aktywnym autem zapisywanym per profil
- dodawanie i edycja aut
- dodawanie, planowanie, edycja i usuwanie wpisów serwisowych
- lokalne repozytoria nad IndexedDB bez bezpośredniego dostępu UI do bazy
- puste stany i dane tworzone przez użytkownika
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

`npm run dev` uruchamia stabilny launcher stacka (API + web) w trybie single-instance.
Kolejne wywołania `npm run dev` wykrywają aktywną instancję i nie ubijają działającego serwera.

Jedyny poprawny flow developerski to uruchamianie całego stacka:

- `npm run dev`

Komenda uruchamia stabilny lokalny stack (API + frontend) na stałych portach:

- Web: `http://localhost:5173`
- API: `http://localhost:8787`

Skrypt startup nadzoruje procesy API/web i wznawia je po awarii, bez agresywnego ubijania procesów po porcie przy każdym starcie.

Tryb trwały w VS Code:

- po otwarciu workspace VS Code automatycznie uruchamia task `Carlog: Dev Stack`
- task działa do zamknięcia VS Code i utrzymuje dostępność lokalną/LAN przez auto-restart

Testowanie desktop + telefon (ta sama sieć Wi-Fi/LAN):

- uruchom `npm run dev` na komputerze
- otwórz web na komputerze: `http://localhost:5173`
- na telefonie otwórz adres LAN komputera, np. `http://192.168.x.x:5173`

W tym trybie frontend wysyła `/api/*` przez proxy Vite do `VITE_API_PROXY_TARGET`.

Szybki check dostępności API:

- `GET /api/health` (np. `http://localhost:8787/api/health`)

Jeśli frontend i API działają na różnych originach (inne hosty/porty), ustaw w środowisku API `AUTH_API_ALLOWED_ORIGINS` (lista originów oddzielona przecinkami), np.:

```bash
AUTH_API_ALLOWED_ORIGINS=http://localhost:5173,http://192.168.50.4:5173
```

Aplikacja uruchamia się lokalnie pod adresem zwróconym przez Vite.

## Konfiguracja auth

Aplikacja działa w jednym trybie runtime: backend-first (remote-only).

- logowanie i rejestracja są obsługiwane przez API
- profile, auta i wpisy serwisowe są przechowywane po stronie serwera
- frontend nie używa IndexedDB jako runtime source of truth

Ustawienia środowiskowe:

```bash
VITE_API_BASE_URL=/api
```

`npm run dev` jest domyślną i zalecaną komendą deweloperską, uruchamia web + API i zapewnia spójne konto między urządzeniami.

## Skrypty

```bash
npm run dev
npm run dev:stack
npm run dev:watchdog
npm run dev:local
npm run dev:remote
npm run api
npm run build
npm run preview
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run verify
```

`npm run verify` uruchamia `lint`, `typecheck`, `test` i `build`.

`npm run dev:local` i `npm run dev:remote` są aliasami do tego samego flow (`npm run dev`) dla zgodności wstecznej.

## Dane i bezpieczeństwo

- każdy rekord domenowy używa `profileId`
- hasła są hashowane i przechowywane z solą po stronie backendu
- współdzielone konto między urządzeniami działa przez backendowe sesje HttpOnly i autoryzację rekordów po stronie serwera

Szczegóły są w dokumentacji:

- [docs/PRODUCT.md](docs/PRODUCT.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/UI_UX.md](docs/UI_UX.md)
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/AUTH_API_STAGE1.md](docs/AUTH_API_STAGE1.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [CHANGELOG.md](CHANGELOG.md)
