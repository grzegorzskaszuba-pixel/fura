# SECURITY

## Obecny etap

Ta aplikacja działa lokalnie i przechowuje profile oraz dane z hasłem w IndexedDB, aby odseparować dane między profilami.

## Czego aplikacja nie robi

- nie przechowuje haseł
- nie zapewnia produkcyjnego uwierzytelniania
- nie daje serwerowej autoryzacji rekordów
- nie chroni danych użytkownika poza lokalnym środowiskiem przeglądarki

## Wymagania dla produkcji

- backend z hashowaniem haseł po stronie serwera
- Argon2id lub równoważny mechanizm
- sesje w cookies `HttpOnly`, `Secure`, `SameSite`
- brak tokenów auth w `localStorage`
- autoryzacja każdego pojazdu, wpisu i załącznika po stronie serwera