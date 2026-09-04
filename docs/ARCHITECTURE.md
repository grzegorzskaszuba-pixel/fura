# ARCHITECTURE

## Warstwy

- `src/app`: kompozycja głównego ekranu i przepływ UI
- `src/features`: logika ekranów i formularzy per obszar
- `src/shared`: typy, helpery, stałe i współdzielone komponenty UI
- `src/data/database`: konfiguracja Dexie i seed demo
- `src/data/repositories`: jedyne miejsce dostępu do IndexedDB

## Zasady

- komponenty UI nie rozmawiają bezpośrednio z Dexie
- dane są filtrowane po `profileId` już na poziomie repozytoriów
- aktywny profil i aktywne auto są przechowywane osobno w `appState`
- seed demo jest samonaprawialny: brak demo rekordów powoduje ponowne dosianie danych

## Główny przepływ

1. `main.tsx` inicjalizuje IndexedDB.
2. `App` odczytuje bieżący profil i aktywne auto.
3. Repozytoria ładują auta i wpisy serwisowe dla aktywnego profilu.
4. Formularze zapisują zmiany przez repozytoria.
5. Dexie live queries odświeżają UI.