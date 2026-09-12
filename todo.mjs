#!/usr/bin/env node
// Konsolowy dostep do ticketow - wygodne dla Claude Code i do szybkich zmian z terminala.
//
//   node todo.mjs lista [status]
//   node todo.mjs pokaz TASK-1
//   node todo.mjs nowy "Tytul" [--opis "tresc"] [--priorytet wysoki] [--etykiety ui,pilne]
//   node todo.mjs komentarz TASK-1 "tresc"        (bez tresci czyta ze stdin)
//   node todo.mjs status TASK-1 zrobione

import { wszystkie, pobierz, utworz, dodajKomentarz, zapiszNaDysk, STATUSY, PRIORYTETY } from './lib/tickety.mjs'

const [polecenie, ...argumenty] = process.argv.slice(2)

function opcja(nazwa, domyslna = '') {
  const indeks = argumenty.indexOf(`--${nazwa}`)
  return indeks === -1 ? domyslna : argumenty[indeks + 1] || domyslna
}

function pozycyjne() {
  const wynik = []
  for (let i = 0; i < argumenty.length; i += 1) {
    if (argumenty[i].startsWith('--')) i += 1
    else wynik.push(argumenty[i])
  }
  return wynik
}

function czytajStdin() {
  return new Promise((spelnij) => {
    let tekst = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (k) => (tekst += k))
    process.stdin.on('end', () => spelnij(tekst))
  })
}

function wypisz(ticket) {
  const etykiety = ticket.etykiety.length ? ` #${ticket.etykiety.join(' #')}` : ''
  console.log(`${ticket.id}\t${ticket.status}\t${ticket.priorytet}\t${ticket.tytul}${etykiety}`)
}

const wolne = pozycyjne()

switch (polecenie) {
  case 'lista': {
    const filtr = wolne[0]
    const lista = await wszystkie()
    for (const ticket of lista) {
      if (!filtr || ticket.status === filtr) wypisz(ticket)
    }
    break
  }

  case 'pokaz': {
    const ticket = await pobierz(wolne[0])
    if (!ticket) {
      console.error('Nie ma takiego ticketu')
      process.exit(1)
    }
    console.log(`# ${ticket.id} ${ticket.tytul}`)
    console.log(`status: ${ticket.status} | priorytet: ${ticket.priorytet} | plik: tickety/${ticket.plik}`)
    console.log(`\n${ticket.opis}\n`)
    for (const k of ticket.komentarze) {
      console.log(`--- ${k.autor} (${k.data})\n${k.tresc}\n`)
    }
    break
  }

  case 'nowy': {
    const ticket = await utworz({
      tytul: wolne[0],
      opis: opcja('opis'),
      priorytet: opcja('priorytet', 'sredni'),
      etykiety: opcja('etykiety').split(',').map((e) => e.trim()).filter(Boolean),
      status: opcja('status', 'todo'),
    })
    console.log(`Utworzono ${ticket.id} -> tickety/${ticket.plik}`)
    break
  }

  case 'komentarz': {
    const tresc = wolne[1] || (await czytajStdin())
    const ticket = await dodajKomentarz(wolne[0], opcja('autor', 'Claude'), tresc)
    if (!ticket) {
      console.error('Nie ma takiego ticketu')
      process.exit(1)
    }
    console.log(`Dodano komentarz do ${ticket.id}`)
    break
  }

  case 'status': {
    const ticket = await pobierz(wolne[0])
    if (!ticket || !STATUSY.includes(wolne[1])) {
      console.error(`Uzycie: status <id> <${STATUSY.join('|')}>`)
      process.exit(1)
    }
    ticket.status = wolne[1]
    await zapiszNaDysk(ticket)
    console.log(`${ticket.id} -> ${ticket.status}`)
    break
  }

  default:
    console.log(
      [
        'Polecenia:',
        '  lista [status]                          lista ticketow',
        '  pokaz <id>                              pelna tresc z komentarzami',
        '  nowy "Tytul" [--opis ...] [--priorytet] [--etykiety a,b]',
        '  komentarz <id> "tresc" [--autor Claude]',
        '  status <id> <status>',
        '',
        `statusy: ${STATUSY.join(', ')}`,
        `priorytety: ${PRIORYTETY.join(', ')}`,
      ].join('\n'),
    )
}
