# magic-mini-todo-table

Mini tablica zadan do pracy z Claude Code. Jeden ticket = jeden plik `.md` na dysku.
Interfejs jest tylko nakladka na te pliki: nie ma bazy danych, kont ani chmury.
Zero zaleznosci, sam Node.

Pomysl jest taki, zeby czlowiek klikal, a agent czytal i pisal w tych samych plikach.

## Uruchomienie

```bash
node serwer.mjs        # http://localhost:4000
```

Na macOS dziala tez dwuklik na `start.command` (odpala serwer i otwiera przegladarke).

## Tablica

Cztery kolumny: do zrobienia, w trakcie, do sprawdzenia, zrobione.

- klikniecie w karte otwiera ticket (opis, komentarze, edycja); `< tablica` albo `esc` wraca
- `dalej >` na karcie przesuwa zadanie do nastepnej kolumny bez wchodzenia w szczegoly
- **zrzuty ekranu przez ctrl+v** wprost w pole opisu albo komentarza (mozna tez przeciagnac plik)
- szukajka filtruje wszystkie kolumny naraz
- skroty: `n` nowy ticket, `/` szukajka, `esc` powrot, `ctrl+enter` zapis
- tablica odswieza sie co 5 s, wiec zmiany zrobione w plikach widac bez F5; ekran
  ticketu sie nie odswieza, zeby nie skasowac pisanego komentarza

## Ticket

Pliki leza w `tickety/`, zalaczniki w `tickety/zalaczniki/`.

```markdown
---
id: TASK-1
tytul: "Poprawic komunikat bledu przy zapisie"
status: todo            # todo | w-trakcie | do-sprawdzenia | zrobione
priorytet: wysoki       # niski | sredni | wysoki
etykiety: ["ui", "pilne"]
utworzono: 2026-09-12T16:16:39.215Z
zmieniono: 2026-09-12T16:16:39.247Z
---

Opis w markdownie. Zrzut: ![zrzut](zalaczniki/nazwa.png)

## Komentarze

### ja - 2026-09-12 18:16

tresc komentarza

### Claude - 2026-09-12 18:20

odpowiedz
```

Plik mozna edytowac recznie w dowolnym edytorze, interfejs to podchwyci. Nazwa pliku
powstaje z id i tytulu, ale liczy sie tylko `id` z naglowka.

## Konsola

```bash
node todo.mjs lista [status]
node todo.mjs pokaz TASK-1
node todo.mjs nowy "Tytul" --opis "..." --priorytet wysoki --etykiety ui,pilne
node todo.mjs komentarz TASK-1 "tresc" --autor Claude
node todo.mjs status TASK-1 zrobione
```

## API

`GET /api/tickety`, `POST /api/tickety`, `GET|PATCH|DELETE /api/tickety/:id`,
`POST /api/tickety/:id/komentarze`, `POST /api/zalacznik`.

Serwer slucha wylacznie na `127.0.0.1` i nie wychodzi na siec.

## Prywatnosc

`.gitignore` trzyma `tickety/*.md` i zalaczniki poza repozytorium. Do gita idzie samo
narzedzie, tresc zadan zostaje na dysku.
