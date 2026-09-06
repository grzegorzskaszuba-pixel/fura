# ARCHITECTURE

## Warstwy

- `src/app`: kompozycja głównego ekranu i przepływ UI
- `src/features`: logika ekranów i formularzy per obszar
- `src/shared`: typy, helpery, stałe i współdzielone komponenty UI
- `src/data/database`: konfiguracja Dexie i migracje lokalnej bazy
- `src/data/repositories`: jedyne miejsce dostępu do IndexedDB
- `src/features/auth`: kontrakt `AuthService` i adaptery `local` / `remote`

## Zasady

- komponenty UI nie rozmawiają bezpośrednio z Dexie
- dane są filtrowane po `profileId` już na poziomie repozytoriów
- aktywny profil i aktywne auto są przechowywane osobno w `appState`
- profile i dane użytkownika są przechowywane lokalnie w IndexedDB, bez automatycznego seedowania
- warstwa auth jest wymienna przez fabrykę serwisu (adapter pattern), bez wpływu na feature'y domenowe

## Główny przepływ

1. `main.tsx` inicjalizuje IndexedDB.
2. `App` odczytuje bieżący profil i aktywne auto.
3. Repozytoria ładują auta i wpisy serwisowe dla aktywnego profilu.
4. Formularze zapisują zmiany przez repozytoria.
5. Dexie live queries odświeżają UI.