# mini-jira

Minimalna tablica zadan do pracy z Claude Code. Jeden ticket = jeden plik `.md`
na dysku, obok repozytorium projektu. Interfejs jest tylko wygodna nakladka na te
pliki - nie ma bazy danych, nie ma kont, nie ma chmury. Zero zaleznosci, sam Node.

Zadania (`tickety/*.md`) i zrzuty ekranu nie ida do repozytorium - to prywatna
tresc konkretnego projektu. W repo siedzi samo narzedzie.

## Uruchomienie

```bash
node serwer.mjs        # http://localhost:4000
```

Albo dwuklik na `start.command` w Finderze (odpala serwer i otwiera przegladarke).

## Co potrafi

- **tablica z czterema kolumnami**: do zrobienia / w trakcie / do sprawdzenia / zrobione
- klikniecie w karte wchodzi w ticket (opis, komentarze, edycja); `< tablica` albo
  `esc` wraca
- przycisk **`dalej >`** na karcie przesuwa ticket do nastepnej kolumny bez wchodzenia
  w szczegoly; dowolna zmiana statusu jest w srodku ticketu
- nowy ticket: tytul, status, priorytet, etykiety, opis w markdownie
- **zrzuty ekranu przez ctrl+v** wprost w pole opisu albo komentarza (mozna tez
  przeciagnac plik); ladują do `tickety/zalaczniki/`
- komentarze (ty i Claude w tym samym watku)
- szukajka filtruje wszystkie kolumny naraz
- skroty: `n` nowy ticket, `/` szukajka, `esc` powrot, `ctrl+enter` zapis w polu tekstowym
- tablica sama odswieza sie co 5 s, wiec zmiany zrobione przez Claude widac bez F5
  (na ekranie ticketu odswiezania nie ma, zeby nie skasowac pisanego komentarza)

## Struktura

```
tickety/                     tickety jako .md (to jest cala "baza")
  zalaczniki/                zrzuty ekranu
lib/tickety.mjs              odczyt/zapis plikow ticketow
serwer.mjs                   lokalny serwer + API
jira.mjs                     ten sam dostep z konsoli
public/                      interfejs (html, css, js - bez budowania)
```

## Format ticketu

```markdown
---
id: SMD-1
tytul: "Kalkulator frontow - zapis wyceny w linku"
status: todo            # todo | w-trakcie | do-sprawdzenia | zrobione
priorytet: wysoki       # niski | sredni | wysoki
etykiety: ["fronty", "konfigurator"]
utworzono: 2026-09-12T16:16:39.215Z
zmieniono: 2026-09-12T16:16:39.247Z
---

Opis w markdownie. Zrzuty: ![zrzut](zalaczniki/nazwa.png)

## Komentarze

### Mateusz - 2026-09-12 18:16

tresc komentarza

### Claude - 2026-09-12 18:20

odpowiedz
```

Plik mozna edytowac recznie w dowolnym edytorze - interfejs to podchwyci.
Nazwa pliku jest generowana z id i tytulu, ale liczy sie tylko `id` w naglowku.

## Konsola

```bash
node jira.mjs lista [status]
node jira.mjs pokaz SMD-1
node jira.mjs nowy "Tytul" --opis "..." --priorytet wysoki --etykiety fronty,ui
node jira.mjs komentarz SMD-1 "tresc" --autor Claude
node jira.mjs status SMD-1 zrobione
```

## API

`GET /api/tickety`, `POST /api/tickety`, `GET|PATCH|DELETE /api/tickety/:id`,
`POST /api/tickety/:id/komentarze`, `POST /api/zalacznik`.
Serwer slucha tylko na `127.0.0.1`, nie wychodzi na siec.
