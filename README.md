# arkadia_truwer

Rozszerzenie Chrome: asystent odgrywania scen dla oficjalnego klienta [arkadia.rpg.pl](https://arkadia.rpg.pl).

## Instalacja

1. Pobierz [arkadia_truwer.zip](https://isithunzi000.github.io/www-arkadia_truwer/arkadia_truwer.zip)
2. Rozpakuj ZIP — powstanie folder `arkadia_truwer`
3. Chrome: `chrome://extensions/` → włącz **Tryb deweloperski** → **Wczytaj rozpakowany** → wskaż folder `arkadia_truwer`

## Aktualizacja

Rozszerzenie samo sprawdza dostępność nowej wersji i wyświetla powiadomienie.

1. Pobierz nowy [arkadia_truwer.zip](https://isithunzi000.github.io/www-arkadia_truwer/arkadia_truwer.zip)
2. Rozpakuj do **tego samego folderu** `arkadia_truwer` (nadpisz pliki)
3. Chrome: `chrome://extensions/` → kliknij **↺** na rozszerzeniu arkadia_truwer

## Użycie

| Komenda | Opis |
|---|---|
| `/truwer` | Otwórz/zamknij (ostatni tryb) |
| `/truwer float` | Tryb pływający / toggle |
| `/truwer left` | Dok lewy / toggle |
| `/truwer right` | Dok prawy / toggle |
| `/truwer help` | Pomoc |
| `/truwer pomoc` | Pomoc |

Truwer pozwala przygotować scenę (listę kroków z komend gry) i odegrać ją we własnym
tempie, krok po kroku. Tempo ustalasz Ty.

### Rodzaje kroków

```
Komenda  - zwykła komenda gry (np. uśmiechnij się, powiedz ...).
Pauza    - przerwa z odliczaniem, jako podpowiedź tempa. Sama nic nie wysyła.
Notatka  - tekst tylko dla Ciebie. Nigdy nie jest wysyłana; prompter ją pomija.
```

### Warianty komendy (znak |)

W jednej komendzie możesz podać kilka wersji oddzielonych znakiem `|`. Przy odgrywaniu
prompter wylosuje jedną z nich.

```
uśmiechnij się|skin głową
```

### Import / eksport

- **Importuj plik** - wczytaj scenę z `.txt` (lista komend) lub `.json` (pełna scena lub pakiet)
- **Importuj tekst** - wklej zawartość bezpośrednio
- Format `.txt`: każda linia to komenda; `/pauza` lub `/pauza N` to pauza; `# tekst` to notatka
- **JSON / TXT** - eksport pojedynczej sceny lub zbiorczy eksport zaznaczonych scen

## Ważne

Plugin nigdy nie wysyła komend samodzielnie. Każda wysyłka to świadomy klik.
To wymóg regulaminu Arkadii.
