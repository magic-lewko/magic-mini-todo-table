// Warstwa dostepu do ticketow. Jeden ticket = jeden plik .md w katalogu tickety/.
// Format pliku: frontmatter YAML (podzbior), opis w markdownie, sekcja "## Komentarze".

import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), '..')
export const KATALOG = join(KORZEN, 'tickety')
export const KATALOG_ZALACZNIKOW = join(KATALOG, 'zalaczniki')

export const PREFIKS = 'SMD'
export const STATUSY = ['todo', 'w-trakcie', 'do-sprawdzenia', 'zrobione']
export const PRIORYTETY = ['niski', 'sredni', 'wysoki']
const NAGLOWEK_KOMENTARZY = '## Komentarze'

// --- pomocnicze -------------------------------------------------------------

const ZNAKI = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' }

export function slug(tekst) {
  return (tekst || '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (z) => ZNAKI[z])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function cytuj(tekst) {
  return '"' + String(tekst).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function odcytuj(tekst) {
  const t = tekst.trim()
  if (t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return t
}

export function terazISO() {
  return new Date().toISOString()
}

export function dataCzytelna(iso) {
  const d = iso ? new Date(iso) : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// --- parsowanie i zapis -----------------------------------------------------

export function parsuj(tekst, plik) {
  const dopasowanie = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(tekst)
  const meta = {}
  let reszta = tekst

  if (dopasowanie) {
    reszta = tekst.slice(dopasowanie[0].length)
    for (const linia of dopasowanie[1].split(/\r?\n/)) {
      const para = /^([a-zA-Z_]+):\s*(.*)$/.exec(linia)
      if (!para) continue
      const klucz = para[1]
      const wartosc = para[2].trim()
      if (wartosc.startsWith('[')) {
        meta[klucz] = wartosc
          .slice(1, wartosc.endsWith(']') ? -1 : undefined)
          .split(',')
          .map((e) => odcytuj(e))
          .filter(Boolean)
      } else {
        meta[klucz] = odcytuj(wartosc)
      }
    }
  }

  const indeks = reszta.indexOf(NAGLOWEK_KOMENTARZY)
  const opis = (indeks === -1 ? reszta : reszta.slice(0, indeks)).trim()
  const blok = indeks === -1 ? '' : reszta.slice(indeks + NAGLOWEK_KOMENTARZY.length)

  const komentarze = []
  for (const kawalek of blok.split(/\r?\n### /).slice(1)) {
    const koniec = kawalek.indexOf('\n')
    const naglowek = koniec === -1 ? kawalek : kawalek.slice(0, koniec)
    const tresc = koniec === -1 ? '' : kawalek.slice(koniec + 1)
    const rozdziel = naglowek.split(' - ')
    komentarze.push({
      autor: (rozdziel[0] || 'ktos').trim(),
      data: (rozdziel[1] || '').trim(),
      tresc: tresc.trim(),
    })
  }

  return {
    id: meta.id || '',
    plik: plik || '',
    tytul: meta.tytul || '(bez tytulu)',
    status: STATUSY.includes(meta.status) ? meta.status : 'todo',
    priorytet: PRIORYTETY.includes(meta.priorytet) ? meta.priorytet : 'sredni',
    etykiety: Array.isArray(meta.etykiety) ? meta.etykiety : [],
    utworzono: meta.utworzono || '',
    zmieniono: meta.zmieniono || '',
    opis,
    komentarze,
  }
}

export function zapisz(ticket) {
  const linie = [
    '---',
    `id: ${ticket.id}`,
    `tytul: ${cytuj(ticket.tytul)}`,
    `status: ${ticket.status}`,
    `priorytet: ${ticket.priorytet}`,
    `etykiety: [${(ticket.etykiety || []).map((e) => cytuj(e)).join(', ')}]`,
    `utworzono: ${ticket.utworzono}`,
    `zmieniono: ${ticket.zmieniono}`,
    '---',
    '',
    (ticket.opis || '').trim(),
    '',
    NAGLOWEK_KOMENTARZY,
    '',
  ]

  for (const k of ticket.komentarze || []) {
    linie.push(`### ${k.autor} - ${k.data}`, '', k.tresc.trim(), '')
  }

  return linie.join('\n').replace(/\n{3,}/g, '\n\n')
}

// --- operacje na katalogu ---------------------------------------------------

async function upewnijKatalogi() {
  if (!existsSync(KATALOG_ZALACZNIKOW)) await mkdir(KATALOG_ZALACZNIKOW, { recursive: true })
}

export function poprawneId(id) {
  return typeof id === 'string' && new RegExp(`^${PREFIKS}-\\d+$`).test(id)
}

export async function wszystkie() {
  await upewnijKatalogi()
  const pliki = (await readdir(KATALOG)).filter((p) => p.endsWith('.md'))
  const lista = []
  for (const plik of pliki) {
    const tekst = await readFile(join(KATALOG, plik), 'utf8')
    const ticket = parsuj(tekst, plik)
    if (ticket.id) lista.push(ticket)
  }
  lista.sort((a, b) => numer(b.id) - numer(a.id))
  return lista
}

function numer(id) {
  return Number(String(id).split('-')[1] || 0)
}

export async function znajdzPlik(id) {
  if (!poprawneId(id)) return null
  await upewnijKatalogi()
  const pliki = await readdir(KATALOG)
  return pliki.find((p) => p.endsWith('.md') && (p === `${id}.md` || p.startsWith(`${id}-`))) || null
}

export async function pobierz(id) {
  const plik = await znajdzPlik(id)
  if (!plik) return null
  return parsuj(await readFile(join(KATALOG, plik), 'utf8'), plik)
}

export async function zapiszNaDysk(ticket) {
  const stary = await znajdzPlik(ticket.id)
  const nowy = `${ticket.id}-${slug(ticket.tytul) || 'ticket'}.md`
  ticket.zmieniono = terazISO()
  await writeFile(join(KATALOG, nowy), zapisz(ticket), 'utf8')
  if (stary && stary !== nowy) await unlink(join(KATALOG, stary))
  ticket.plik = nowy
  return ticket
}

export async function utworz({ tytul, opis = '', priorytet = 'sredni', etykiety = [], status = 'todo' }) {
  const lista = await wszystkie()
  const kolejny = lista.reduce((max, t) => Math.max(max, numer(t.id)), 0) + 1
  const ticket = {
    id: `${PREFIKS}-${kolejny}`,
    tytul: (tytul || '').trim() || 'Bez tytulu',
    status: STATUSY.includes(status) ? status : 'todo',
    priorytet: PRIORYTETY.includes(priorytet) ? priorytet : 'sredni',
    etykiety,
    utworzono: terazISO(),
    zmieniono: terazISO(),
    opis,
    komentarze: [],
  }
  return zapiszNaDysk(ticket)
}

export async function usun(id) {
  const plik = await znajdzPlik(id)
  if (!plik) return false
  await unlink(join(KATALOG, plik))
  return true
}

export async function dodajKomentarz(id, autor, tresc) {
  const ticket = await pobierz(id)
  if (!ticket) return null
  ticket.komentarze.push({
    autor: (autor || 'ktos').trim().replace(/\s+-\s+/g, ' '),
    data: dataCzytelna(),
    tresc: String(tresc || '').trim(),
  })
  return zapiszNaDysk(ticket)
}
