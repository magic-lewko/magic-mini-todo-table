// Lokalny serwer mini-jiry. Bez zaleznosci, czysty Node.
// Uruchomienie: node serwer.mjs  (domyslnie http://localhost:4000)

import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  KATALOG_ZALACZNIKOW,
  STATUSY,
  PRIORYTETY,
  wszystkie,
  pobierz,
  utworz,
  usun,
  zapiszNaDysk,
  dodajKomentarz,
  poprawneId,
  slug,
} from './lib/tickety.mjs'

const KORZEN = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(KORZEN, 'public')
const PORT = Number(process.env.PORT) || 4000
const LIMIT_BAJTOW = 25 * 1024 * 1024

const TYPY = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

function json(res, dane, kod = 200) {
  const tresc = JSON.stringify(dane)
  res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(tresc)
}

function czytajCialo(req) {
  return new Promise((spelnij, odrzuc) => {
    const kawalki = []
    let rozmiar = 0
    req.on('data', (k) => {
      rozmiar += k.length
      if (rozmiar > LIMIT_BAJTOW) {
        odrzuc(new Error('Za duze zadanie'))
        req.destroy()
        return
      }
      kawalki.push(k)
    })
    req.on('end', () => {
      const tekst = Buffer.concat(kawalki).toString('utf8')
      if (!tekst) return spelnij({})
      try {
        spelnij(JSON.parse(tekst))
      } catch {
        odrzuc(new Error('Niepoprawny JSON'))
      }
    })
    req.on('error', odrzuc)
  })
}

async function plikStatyczny(res, katalog, nazwa) {
  const sciezka = join(katalog, normalize(nazwa).replace(/^(\.\.(\/|\\|$))+/, ''))
  if (!sciezka.startsWith(katalog) || !existsSync(sciezka)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Nie ma takiego pliku')
    return
  }
  const typ = TYPY[extname(sciezka).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': typ, 'cache-control': 'no-store' })
  res.end(await readFile(sciezka))
}

function oczysc(dane, ticket) {
  if (typeof dane.tytul === 'string' && dane.tytul.trim()) ticket.tytul = dane.tytul.trim()
  if (STATUSY.includes(dane.status)) ticket.status = dane.status
  if (PRIORYTETY.includes(dane.priorytet)) ticket.priorytet = dane.priorytet
  if (typeof dane.opis === 'string') ticket.opis = dane.opis
  if (Array.isArray(dane.etykiety)) {
    ticket.etykiety = dane.etykiety.map((e) => String(e).trim()).filter(Boolean).slice(0, 10)
  }
  return ticket
}

const serwer = createServer(async (req, res) => {
  const adres = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const sciezka = decodeURIComponent(adres.pathname)

  try {
    // --- API ---
    if (sciezka === '/api/tickety' && req.method === 'GET') {
      return json(res, { tickety: await wszystkie(), statusy: STATUSY, priorytety: PRIORYTETY })
    }

    if (sciezka === '/api/tickety' && req.method === 'POST') {
      const dane = await czytajCialo(req)
      if (!dane.tytul || !String(dane.tytul).trim()) return json(res, { blad: 'Brak tytulu' }, 400)
      return json(res, await utworz(dane), 201)
    }

    const dopasowanie = /^\/api\/tickety\/([^/]+)(\/komentarze)?$/.exec(sciezka)
    if (dopasowanie) {
      const id = dopasowanie[1]
      const komentarze = Boolean(dopasowanie[2])
      if (!poprawneId(id)) return json(res, { blad: 'Niepoprawne id' }, 400)

      if (komentarze && req.method === 'POST') {
        const dane = await czytajCialo(req)
        if (!String(dane.tresc || '').trim()) return json(res, { blad: 'Pusty komentarz' }, 400)
        const wynik = await dodajKomentarz(id, dane.autor, dane.tresc)
        return wynik ? json(res, wynik) : json(res, { blad: 'Nie ma takiego ticketu' }, 404)
      }

      if (!komentarze && req.method === 'GET') {
        const ticket = await pobierz(id)
        return ticket ? json(res, ticket) : json(res, { blad: 'Nie ma takiego ticketu' }, 404)
      }

      if (!komentarze && req.method === 'PATCH') {
        const ticket = await pobierz(id)
        if (!ticket) return json(res, { blad: 'Nie ma takiego ticketu' }, 404)
        return json(res, await zapiszNaDysk(oczysc(await czytajCialo(req), ticket)))
      }

      if (!komentarze && req.method === 'DELETE') {
        const usuniety = await usun(id)
        return usuniety ? json(res, { ok: true }) : json(res, { blad: 'Nie ma takiego ticketu' }, 404)
      }
    }

    if (sciezka === '/api/zalacznik' && req.method === 'POST') {
      const dane = await czytajCialo(req)
      const rozszerzenie = (TYPY[`.${dane.typ}`] ? dane.typ : 'png').toLowerCase()
      const podstawa = slug(dane.nazwa || '') || 'zrzut'
      const nazwa = `${Date.now()}-${podstawa}.${rozszerzenie}`
      const bajty = Buffer.from(String(dane.dane || '').split(',').pop(), 'base64')
      if (!bajty.length) return json(res, { blad: 'Pusty plik' }, 400)
      await writeFile(join(KATALOG_ZALACZNIKOW, nazwa), bajty)
      return json(res, { sciezka: `zalaczniki/${nazwa}` })
    }

    // --- pliki ---
    if (sciezka.startsWith('/zalaczniki/')) {
      return plikStatyczny(res, KATALOG_ZALACZNIKOW, sciezka.slice('/zalaczniki/'.length))
    }

    return plikStatyczny(res, PUBLIC, sciezka === '/' ? 'index.html' : sciezka)
  } catch (blad) {
    json(res, { blad: blad.message || 'Blad serwera' }, 500)
  }
})

serwer.listen(PORT, '127.0.0.1', () => {
  console.log(`mini-jira: http://localhost:${PORT}`)
})
