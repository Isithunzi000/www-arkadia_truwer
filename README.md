# arkadia_truwer

Chrome extension - asystent odgrywania scen dla oficjalnego klienta [arkadia.rpg.pl](https://arkadia.rpg.pl).

## Pobierz

**[arkadia_truwer.zip](https://isithunzi000.github.io/www-arkadia_truwer/arkadia_truwer.zip)**

## Instalacja

1. Pobierz i rozpakuj `arkadia_truwer.zip`
2. Chrome: `chrome://extensions/` → tryb dewelopera → załaduj rozpakowany folder
3. Przejdź na `arkadia.rpg.pl`

## Użycie

```
/truwer              - otwórz/zamknij (ostatni tryb)
/truwer float        - tryb pływający / toggle
/truwer left         - dok lewy / toggle
/truwer right        - dok prawy / toggle
/truwer help         - ta pomoc
/truwer pomoc        - ta pomoc
```

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

### Ważne

Plugin nigdy nie wysyła komend samodzielnie. Każda wysyłka to świadomy klik.
To wymóg regulaminu Arkadii.

## Aktualizacja

Po pojawieniu się powiadomienia o nowej wersji: pobierz ZIP, rozpakuj do tego samego
folderu, odśwież rozszerzenie w Chrome.
