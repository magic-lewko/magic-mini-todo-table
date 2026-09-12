# mini-jira - instrukcja dla Claude

Tablica zadan do projektu, ktory lezy obok tego katalogu. Tickety to zwykle pliki
`.md` w katalogu `tickety/` - czytaj je i edytuj bezposrednio, nie potrzebujesz
uruchomionego serwera.

## Jak pracowac z ticketami

Najszybciej przez konsole (nie trzeba parsowac naglowka recznie):

```bash
node jira.mjs lista                       # wszystkie
node jira.mjs lista todo                  # tylko do zrobienia
node jira.mjs pokaz SMD-1                 # opis + komentarze
node jira.mjs komentarz SMD-1 "tresc"     # domyslny autor to Claude
node jira.mjs status SMD-1 do-sprawdzenia
node jira.mjs nowy "Tytul" --opis "..." --priorytet wysoki --etykiety fronty
```

Mozesz tez edytowac pliki wprost - format jest opisany w README.md.

## Zasady

- **Nie zmieniaj** `id` ani `utworzono`. `zmieniono` aktualizuje sie samo przy zapisie
  przez `jira.mjs`; przy recznej edycji ustaw je na biezaca date ISO.
- Statusy: `todo`, `w-trakcie`, `do-sprawdzenia`, `zrobione`. Priorytety: `niski`,
  `sredni`, `wysoki`. Innych wartosci nie wpisuj - interfejs je zignoruje.
- Komentarz podpisuj `### Claude - RRRR-MM-DD GG:MM`. Nie kasuj cudzych komentarzy.
- Po skonczeniu zadania: przestaw status na `do-sprawdzenia` i dopisz komentarz
  z tym, co zostalo zmienione (pliki, decyzje, co zostalo do sprawdzenia przez Mateusza).
  Status `zrobione` ustawia Mateusz.
- **Bez dlugich myslnikow.** Em dash i en dash sa zakazane w tresci ticketow,
  komentarzach, kodzie i dokumentacji. Zawsze zwykly dywiz `-`.
- Zalaczniki leza w `tickety/zalaczniki/` i w markdownie maja postac
  `![zrzut](zalaczniki/nazwa.png)`. Zrzuty od Mateusza mozesz czytac narzedziem Read.

## Kod aplikacji

Zero zaleznosci, czysty Node i waniliowy JS w przegladarce. Nie dokladaj bibliotek,
nie wprowadzaj kroku budowania, nie dodawaj animacji ani efektow - calosc ma
zostac turbo minimalistyczna.
