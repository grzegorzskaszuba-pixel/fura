# AUTH API STAGE 1

## Cel

Etap 1 przygotowuje lekką i modułową integrację auth bez przebudowy całej aplikacji.

- UI i feature'y domenowe (auta, wpisy) nie znają transportu API
- auth działa przez kontrakt `AuthService`
- implementacja jest wybierana przez konfigurację: `local` lub `remote`

## Konfiguracja

Zmienne środowiskowe:

- `VITE_AUTH_MODE=local|remote`
- `VITE_API_BASE_URL=/api`

Domyślnie: `local`.

## Kontrakt endpointów (remote)

Bazowy prefiks: `${VITE_API_BASE_URL}/auth`

- `GET /session` -> `{ profileId: string | null }`
- `POST /login` body: `{ username: email, password }` -> `{ profile }`
- `POST /register` body: `{ username: email, password, displayName }` -> `{ profile }`
- `POST /reset-password` body: `{ username: email, password }` -> `204/200`
- `POST /password-reset/request` body: `{ username: email }` -> `{ ok: true }` (neutral response)
- `POST /password-reset/confirm` body: `{ token, password }` -> `{ ok: true }`
- `POST /change-password` body: `{ profileId, currentPassword, newPassword }` -> `204/200`
- `POST /switch-profile` body: `{ profileId }` -> `{ profile }`
- `POST /logout` -> `204/200`

## Założenia wydajności i modułowości

- brak dodatkowych zależności runtime
- małe moduły z jedną odpowiedzialnością
- adapter auth podmienialny bez zmian w ekranach biznesowych
- brak zmian w repozytoriach pojazdów i serwisu na etapie 1

Pole `username` zachowuje nazwe dla kompatybilnosci ze storage, ale przechowuje znormalizowany adres e-mail uzywany do logowania. Pole `displayName` jest nazwa uzytkownika widoczna w profilu.

## Następny krok (etap 2)

- backend z sesją HttpOnly
- autoryzacja rekordów po stronie serwera
- synchronizacja danych między urządzeniami
