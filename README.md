# arkadia_truwer

Chrome extension - asystent odgrywania scen dla oficjalnego klienta [arkadia.rpg.pl](https://arkadia.rpg.pl).

## Pobierz

**[arkadia_truwer.zip](https://isithunzi000.github.io/www-arkadia_truwer/arkadia_truwer.zip)**

## Instalacja

1. Pobierz i rozpakuj `arkadia_truwer.zip`
2. Chrome: `chrome://extensions/` → tryb dewelopera → zaladuj rozpakowany folder
3. Przejdz na `arkadia.rpg.pl`

## Uzycie

```
/truwer              - otworz/zamknij (ostatni tryb)
/truwer float        - tryb plywajacy / toggle
/truwer left         - dok lewy / toggle
/truwer right        - dok prawy / toggle
/truwer help         - ta pomoc
/truwer pomoc        - ta pomoc
```

Truwer pozwala przygotowac scene (liste krokow z komend gry) i odegrac ja we wlasnym
tempie, krok po kroku. Kazda linie wysylasz recznie - plugin nigdy nie wysyla nic sam.
Tempo ustalasz Ty.

### Rodzaje krokow

```
Komenda  - zwykla komenda gry (np. usmiechnij sie, powiedz ...).
Pauza    - przerwa z odliczaniem, jako podpowiedz tempa. Sama nic nie wysyla.
Notatka  - tekst tylko dla Ciebie. Nigdy nie jest wysylana; prompter ja pomija.
```

### Warianty komendy (znak |)

W jednej komendzie mozesz podac kilka wersji oddzielonych znakiem `|`. Przy odgrywaniu
prompter wylosuje jedna z nich.

```
usmiechnij sie|skin glowa
```

### Import / eksport

- **Importuj plik** - wczytaj scene z `.txt` (lista komend) lub `.json` (pelna scena lub pakiet)
- **Importuj tekst** - wklej zawartosc bezposrednio
- Format `.txt`: kazda linia to komenda; `/pauza` lub `/pauza N` to pauza; `# tekst` to notatka
- **JSON / TXT** - eksport pojedynczej sceny lub zbiorczy eksport zaznaczonych scen

### Wazne

Plugin nigdy nie wysyla komend samodzielnie. Kazda wysylka to swiadomy klik.
To wymog regulaminu Arkadii.

## Aktualizacja

Po pojawieniu sie powiadomienia o nowej wersji: pobierz ZIP, rozpakuj do tego samego
folderu, odswiez rozszerzenie w Chrome.
