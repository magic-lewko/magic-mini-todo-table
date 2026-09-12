// Cala logika interfejsu. Bez frameworka, bez budowania - plik idzie do przegladarki taki jaki jest.

const stan = {
  tickety: [],
  statusy: [],
  priorytety: [],
  otwarty: null, // pelny ticket, gdy patrzymy na pojedyncze zadanie
  szukanie: '',
  widok: 'tablica', // tablica | ticket | nowy | edycja
}

const el = {
  tablica: document.getElementById('tablica'),
  szczegoly: document.getElementById('szczegoly'),
  szukaj: document.getElementById('szukaj'),
  licznik: document.getElementById('licznik'),
  nowy: document.getElementById('nowy'),
}

const OPISY = {
  todo: 'do zrobienia',
  'w-trakcie': 'w trakcie',
  'do-sprawdzenia': 'do sprawdzenia',
  zrobione: 'zrobione',
}

const WAGA = { wysoki: '!!!', sredni: '!!', niski: '!' }

// --- komunikacja z serwerem -------------------------------------------------

async function api(sciezka, opcje = {}) {
  const odpowiedz = await fetch(sciezka, {
    ...opcje,
    headers: opcje.body ? { 'content-type': 'application/json' } : undefined,
    body: opcje.body ? JSON.stringify(opcje.body) : undefined,
  })
  const dane = await odpowiedz.json().catch(() => ({}))
  if (!odpowiedz.ok) throw new Error(dane.blad || 'Blad serwera')
  return dane
}

async function wczytaj() {
  const dane = await api('/api/tickety')
  stan.tickety = dane.tickety
  stan.statusy = dane.statusy
  stan.priorytety = dane.priorytety
  if (stan.otwarty) {
    stan.otwarty = stan.tickety.find((t) => t.id === stan.otwarty.id) || null
    if (!stan.otwarty && stan.widok !== 'nowy') stan.widok = 'tablica'
  }
  rysuj()
}

// --- markdown ---------------------------------------------------------------

function bezpieczny(tekst) {
  return String(tekst).replace(
    /[&<>"]/g,
    (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z],
  )
}

function inline(tekst) {
  const schowek = []
  const odloz = (html) => `@@${schowek.push(html) - 1}@@`

  let t = tekst.replace(/`([^`]+)`/g, (_, kod) => odloz(`<code>${kod}</code>`))
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, zrodlo) => {
    const adres = /^(https?:|\/)/.test(zrodlo) ? zrodlo : `/${zrodlo.replace(/^\.?\//, '')}`
    return odloz(`<a href="${adres}" target="_blank"><img src="${adres}" alt="${alt}" loading="lazy" /></a>`)
  })
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, etykieta, adres) =>
    odloz(`<a href="${adres}" target="_blank">${etykieta}</a>`),
  )
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return t.replace(/@@(\d+)@@/g, (_, i) => schowek[Number(i)])
}

function markdown(tekst) {
  const linie = bezpieczny(tekst || '').split('\n')
  const wynik = []
  let akapit = []
  let lista = null
  let kod = null

  const zamknijAkapit = () => {
    if (akapit.length) wynik.push(`<p>${inline(akapit.join('<br />'))}</p>`)
    akapit = []
  }
  const zamknijListe = () => {
    if (lista) wynik.push(`</${lista}>`)
    lista = null
  }

  for (const linia of linie) {
    if (/^```/.test(linia)) {
      if (kod === null) {
        zamknijAkapit()
        zamknijListe()
        kod = []
      } else {
        wynik.push(`<pre><code>${kod.join('\n')}</code></pre>`)
        kod = null
      }
      continue
    }
    if (kod !== null) {
      kod.push(linia)
      continue
    }

    const naglowek = /^(#{1,4})\s+(.*)$/.exec(linia)
    const punkt = /^\s*[-*]\s+(.*)$/.exec(linia)
    const numer = /^\s*\d+[.)]\s+(.*)$/.exec(linia)
    const cytat = /^&gt;\s?(.*)$/.exec(linia)

    if (!linia.trim()) {
      zamknijAkapit()
      zamknijListe()
    } else if (naglowek) {
      zamknijAkapit()
      zamknijListe()
      const poziom = Math.min(naglowek[1].length + 1, 5)
      wynik.push(`<h${poziom}>${inline(naglowek[2])}</h${poziom}>`)
    } else if (/^(-{3,}|\*{3,})$/.test(linia.trim())) {
      zamknijAkapit()
      zamknijListe()
      wynik.push('<hr />')
    } else if (cytat) {
      zamknijAkapit()
      zamknijListe()
      wynik.push(`<blockquote>${inline(cytat[1])}</blockquote>`)
    } else if (punkt || numer) {
      zamknijAkapit()
      const typ = punkt ? 'ul' : 'ol'
      if (lista !== typ) {
        zamknijListe()
        wynik.push(`<${typ}>`)
        lista = typ
      }
      // pole wyboru rysujemy encja, bo tresc jest juz zescapowana
      const tresc = (punkt || numer)[1].replace(/^\[( |x|X)\]\s*/, (_, znak) =>
        znak === ' ' ? '&#9744; ' : '&#9745; ',
      )
      wynik.push(`<li>${inline(tresc)}</li>`)
    } else {
      zamknijListe()
      akapit.push(linia)
    }
  }

  if (kod !== null) wynik.push(`<pre><code>${kod.join('\n')}</code></pre>`)
  zamknijAkapit()
  zamknijListe()
  return wynik.join('\n')
}

// --- zalaczniki -------------------------------------------------------------

function czytajPlik(plik) {
  return new Promise((spelnij) => {
    const czytnik = new FileReader()
    czytnik.onload = () => spelnij(czytnik.result)
    czytnik.readAsDataURL(plik)
  })
}

async function wyslijZrzut(plik) {
  const dane = await czytajPlik(plik)
  const typ = (plik.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
  const nazwa = plik.name ? plik.name.replace(/\.[^.]+$/, '') : 'zrzut'
  const wynik = await api('/api/zalacznik', { method: 'POST', body: { dane, typ, nazwa } })
  return wynik.sciezka
}

function wstawWKursor(pole, tekst) {
  const start = pole.selectionStart ?? pole.value.length
  pole.value = pole.value.slice(0, start) + tekst + pole.value.slice(pole.selectionEnd ?? start)
  pole.selectionStart = pole.selectionEnd = start + tekst.length
  pole.focus()
}

function obslugaZrzutow(pole) {
  const dodaj = async (pliki) => {
    for (const plik of pliki) {
      if (!plik.type.startsWith('image/')) continue
      const znacznik = `[wysylam ${Date.now()}]`
      wstawWKursor(pole, `\n${znacznik}\n`)
      try {
        const sciezka = await wyslijZrzut(plik)
        pole.value = pole.value.replace(znacznik, `![zrzut](${sciezka})`)
      } catch (blad) {
        pole.value = pole.value.replace(znacznik, `(nie udalo sie wyslac: ${blad.message})`)
      }
    }
  }
  pole.addEventListener('paste', (zdarzenie) => {
    const pliki = [...zdarzenie.clipboardData.items]
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter(Boolean)
    if (pliki.length) {
      zdarzenie.preventDefault()
      dodaj(pliki)
    }
  })
  pole.addEventListener('dragover', (zdarzenie) => zdarzenie.preventDefault())
  pole.addEventListener('drop', (zdarzenie) => {
    if (zdarzenie.dataTransfer.files.length) {
      zdarzenie.preventDefault()
      dodaj([...zdarzenie.dataTransfer.files])
    }
  })
}

// --- tablica ----------------------------------------------------------------

function pasujeDoSzukania(ticket) {
  if (!stan.szukanie) return true
  const szukane = stan.szukanie.toLowerCase()
  return [ticket.id, ticket.tytul, ticket.opis, ticket.etykiety.join(' ')]
    .join(' ')
    .toLowerCase()
    .includes(szukane)
}

async function otworz(id) {
  stan.otwarty = await api(`/api/tickety/${id}`)
  stan.widok = 'ticket'
  rysuj()
}

async function przesun(ticket, kierunek) {
  const indeks = stan.statusy.indexOf(ticket.status) + kierunek
  if (indeks < 0 || indeks >= stan.statusy.length) return
  await api(`/api/tickety/${ticket.id}`, { method: 'PATCH', body: { status: stan.statusy[indeks] } })
  await wczytaj()
}

function karta(ticket) {
  const korzen = document.createElement('div')
  korzen.className = 'karta'

  const gora = document.createElement('div')
  gora.className = 'gora'
  gora.textContent = `${ticket.id} ${WAGA[ticket.priorytet] || ''}`

  const tytul = document.createElement('div')
  tytul.className = 'tytul'
  tytul.textContent = ticket.tytul

  const dol = document.createElement('div')
  dol.className = 'dol'

  const opis = document.createElement('span')
  opis.className = 'gora'
  const etykiety = ticket.etykiety.length ? `#${ticket.etykiety.join(' #')}` : ''
  const komentarze = ticket.komentarze.length ? `kom. ${ticket.komentarze.length}` : ''
  opis.textContent = [etykiety, komentarze].filter(Boolean).join('  ')

  const otworzKarte = () => otworz(ticket.id)
  korzen.tabIndex = 0
  korzen.addEventListener('click', otworzKarte)
  korzen.addEventListener('keydown', (z) => {
    if (z.key === 'Enter') otworzKarte()
  })

  dol.append(opis)

  const ostatni = stan.statusy.indexOf(ticket.status) === stan.statusy.length - 1
  if (!ostatni) {
    const dalej = document.createElement('button')
    dalej.type = 'button'
    dalej.className = 'dalej'
    dalej.textContent = 'dalej >'
    dalej.title = `przenies do: ${OPISY[stan.statusy[stan.statusy.indexOf(ticket.status) + 1]]}`
    dalej.onclick = (z) => {
      z.stopPropagation()
      przesun(ticket, 1)
    }
    dol.append(dalej)
  }

  korzen.append(gora, tytul, dol)
  return korzen
}

function rysujTablice() {
  const widoczne = stan.tickety.filter(pasujeDoSzukania)
  el.licznik.textContent = `${widoczne.length} z ${stan.tickety.length}`

  el.tablica.replaceChildren(
    ...stan.statusy.map((status) => {
      const kolumna = document.createElement('div')
      kolumna.className = 'kolumna'

      const naglowek = document.createElement('h2')
      const wKolumnie = widoczne.filter((t) => t.status === status)
      naglowek.textContent = `${OPISY[status] || status} (${wKolumnie.length})`

      const karty = document.createElement('div')
      karty.className = 'karty'
      if (!wKolumnie.length) {
        const pusto = document.createElement('p')
        pusto.className = 'pusto'
        pusto.textContent = '-'
        karty.append(pusto)
      } else {
        karty.append(...wKolumnie.map(karta))
      }

      kolumna.append(naglowek, karty)
      return kolumna
    }),
  )
}

// --- formularz --------------------------------------------------------------

function pole(etykieta, wezel) {
  const opakowanie = document.createElement('label')
  opakowanie.className = 'grupa'
  opakowanie.append(etykieta, wezel)
  return opakowanie
}

function wybor(opcje, wartosc) {
  const lista = document.createElement('select')
  for (const opcja of opcje) {
    const pozycja = document.createElement('option')
    pozycja.value = opcja
    pozycja.textContent = OPISY[opcja] || opcja
    lista.append(pozycja)
  }
  lista.value = wartosc
  return lista
}

function przyciskPowrotu() {
  const wroc = document.createElement('button')
  wroc.type = 'button'
  wroc.textContent = '< tablica'
  wroc.onclick = () => {
    stan.widok = 'tablica'
    stan.otwarty = null
    rysuj()
  }
  return wroc
}

function formularz({ ticket, naZapis, tytulSekcji }) {
  const korzen = document.createElement('div')
  korzen.className = 'formularz'

  const tytul = document.createElement('input')
  tytul.type = 'text'
  tytul.value = ticket.tytul || ''
  tytul.placeholder = 'Tytul ticketu'

  const status = wybor(stan.statusy, ticket.status || 'todo')
  const priorytet = wybor(stan.priorytety, ticket.priorytet || 'sredni')

  const etykiety = document.createElement('input')
  etykiety.type = 'text'
  etykiety.value = (ticket.etykiety || []).join(', ')
  etykiety.placeholder = 'etykiety po przecinku, np. fronty, ui'

  const opis = document.createElement('textarea')
  opis.value = ticket.opis || ''
  opis.placeholder = 'Opis w markdownie. Zrzut ekranu wklej przez ctrl+v albo przeciagnij tutaj.'
  obslugaZrzutow(opis)

  const zapisz = document.createElement('button')
  zapisz.type = 'button'
  zapisz.textContent = 'zapisz'
  zapisz.onclick = () =>
    naZapis({
      tytul: tytul.value,
      status: status.value,
      priorytet: priorytet.value,
      etykiety: etykiety.value
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
      opis: opis.value,
    })

  const anuluj = document.createElement('button')
  anuluj.type = 'button'
  anuluj.textContent = 'anuluj'
  anuluj.onclick = () => {
    stan.widok = stan.otwarty ? 'ticket' : 'tablica'
    rysuj()
  }

  const naglowek = document.createElement('h1')
  naglowek.textContent = tytulSekcji

  const przyciski = document.createElement('div')
  przyciski.className = 'grupa'
  przyciski.append(zapisz, anuluj)

  const podpowiedz = document.createElement('p')
  podpowiedz.className = 'podpowiedz'
  podpowiedz.textContent = 'ctrl+enter w opisie zapisuje'

  korzen.append(
    naglowek,
    tytul,
    pole('status', status),
    pole('priorytet', priorytet),
    etykiety,
    opis,
    przyciski,
    podpowiedz,
  )
  opis.addEventListener('keydown', (z) => {
    if ((z.metaKey || z.ctrlKey) && z.key === 'Enter') zapisz.click()
  })
  setTimeout(() => tytul.focus(), 0)
  return korzen
}

// --- ekran ticketu ----------------------------------------------------------

function rysujTicket() {
  const ticket = stan.otwarty
  const korzen = document.createElement('div')

  const pasek = document.createElement('div')
  pasek.className = 'pasek'

  const id = document.createElement('span')
  id.className = 'id'
  id.textContent = `${ticket.id} / ${ticket.plik}`

  const status = wybor(stan.statusy, ticket.status)
  status.onchange = async () => {
    await api(`/api/tickety/${ticket.id}`, { method: 'PATCH', body: { status: status.value } })
    await otworz(ticket.id)
  }

  const priorytet = wybor(stan.priorytety, ticket.priorytet)
  priorytet.onchange = async () => {
    await api(`/api/tickety/${ticket.id}`, { method: 'PATCH', body: { priorytet: priorytet.value } })
    await otworz(ticket.id)
  }

  const edytuj = document.createElement('button')
  edytuj.type = 'button'
  edytuj.textContent = 'edytuj'
  edytuj.onclick = () => {
    stan.widok = 'edycja'
    rysuj()
  }

  const usun = document.createElement('button')
  usun.type = 'button'
  usun.textContent = 'usun'
  usun.onclick = async () => {
    if (!confirm(`Usunac ${ticket.id}?`)) return
    await api(`/api/tickety/${ticket.id}`, { method: 'DELETE' })
    stan.otwarty = null
    stan.widok = 'tablica'
    await wczytaj()
  }

  pasek.append(przyciskPowrotu(), id, status, priorytet, edytuj, usun)

  const naglowek = document.createElement('h1')
  naglowek.textContent = ticket.tytul

  const etykiety = document.createElement('div')
  etykiety.className = 'pasek'
  for (const etykieta of ticket.etykiety) {
    const znacznik = document.createElement('span')
    znacznik.className = 'znacznik'
    znacznik.textContent = `#${etykieta}`
    etykiety.append(znacznik)
  }

  const tresc = document.createElement('div')
  tresc.className = 'tresc'
  tresc.innerHTML = markdown(ticket.opis) || '<p class="pusto">Brak opisu.</p>'

  const naglowekKomentarzy = document.createElement('h2')
  naglowekKomentarzy.textContent = `Komentarze (${ticket.komentarze.length})`
  naglowekKomentarzy.className = 'naglowek-komentarzy'

  const komentarze = document.createElement('div')
  for (const komentarz of ticket.komentarze) {
    const wezel = document.createElement('div')
    wezel.className = 'komentarz'
    const kto = document.createElement('div')
    kto.className = 'kto'
    kto.textContent = `${komentarz.autor} / ${komentarz.data}`
    const tekst = document.createElement('div')
    tekst.className = 'tresc bez-kreski'
    tekst.innerHTML = markdown(komentarz.tresc)
    wezel.append(kto, tekst)
    komentarze.append(wezel)
  }

  const nowy = document.createElement('textarea')
  nowy.placeholder = 'Komentarz (markdown, zrzut przez ctrl+v). Ctrl+Enter wysyla.'
  nowy.className = 'niski'
  obslugaZrzutow(nowy)

  const autor = document.createElement('input')
  autor.type = 'text'
  autor.value = localStorage.getItem('autor') || 'Mateusz'
  autor.size = 12

  const wyslij = document.createElement('button')
  wyslij.type = 'button'
  wyslij.textContent = 'dodaj komentarz'
  wyslij.onclick = async () => {
    if (!nowy.value.trim()) return
    localStorage.setItem('autor', autor.value)
    await api(`/api/tickety/${ticket.id}/komentarze`, {
      method: 'POST',
      body: { autor: autor.value, tresc: nowy.value },
    })
    nowy.value = ''
    await otworz(ticket.id)
  }
  nowy.addEventListener('keydown', (z) => {
    if ((z.metaKey || z.ctrlKey) && z.key === 'Enter') wyslij.click()
  })

  const stopka = document.createElement('div')
  stopka.className = 'grupa'
  stopka.append(autor, wyslij)

  korzen.append(pasek, naglowek, etykiety, tresc, naglowekKomentarzy, komentarze, nowy, stopka)
  el.szczegoly.replaceChildren(korzen)
}

// --- rysowanie --------------------------------------------------------------

function rysuj() {
  const naTablicy = stan.widok === 'tablica'
  el.tablica.hidden = !naTablicy
  el.szczegoly.hidden = naTablicy

  if (naTablicy) {
    rysujTablice()
    return
  }

  if (stan.widok === 'nowy') {
    el.szczegoly.replaceChildren(
      formularz({
        ticket: {},
        tytulSekcji: 'Nowy ticket',
        naZapis: async (dane) => {
          if (!dane.tytul.trim()) return alert('Podaj tytul')
          const ticket = await api('/api/tickety', { method: 'POST', body: dane })
          await wczytaj()
          await otworz(ticket.id)
        },
      }),
    )
    return
  }

  if (!stan.otwarty) {
    stan.widok = 'tablica'
    rysuj()
    return
  }

  if (stan.widok === 'edycja') {
    el.szczegoly.replaceChildren(
      formularz({
        ticket: stan.otwarty,
        tytulSekcji: `Edycja ${stan.otwarty.id}`,
        naZapis: async (dane) => {
          await api(`/api/tickety/${stan.otwarty.id}`, { method: 'PATCH', body: dane })
          await wczytaj()
          await otworz(stan.otwarty.id)
        },
      }),
    )
    return
  }

  rysujTicket()
}

// --- start ------------------------------------------------------------------

el.szukaj.addEventListener('input', () => {
  stan.szukanie = el.szukaj.value.trim()
  if (stan.widok === 'tablica') rysujTablice()
})

el.nowy.addEventListener('click', () => {
  stan.widok = 'nowy'
  rysuj()
})

const POLA = ['INPUT', 'TEXTAREA', 'SELECT']

document.addEventListener('keydown', (z) => {
  const wPolu = POLA.includes(document.activeElement?.tagName)
  if (z.key === 'Escape' && stan.widok !== 'tablica' && !wPolu) {
    stan.widok = 'tablica'
    stan.otwarty = null
    rysuj()
    return
  }
  if (document.activeElement !== document.body) return
  if (z.key === '/') {
    z.preventDefault()
    el.szukaj.focus()
  }
  if (z.key === 'n') {
    stan.widok = 'nowy'
    rysuj()
  }
})

// Odswiezanie tablicy, zeby zmiany zrobione przez Claude w plikach byly widoczne bez F5.
// Na ekranie ticketu nie odswiezamy, zeby nie kasowac wpisywanego komentarza.
setInterval(() => {
  if (stan.widok === 'tablica') wczytaj().catch(() => {})
}, 5000)

wczytaj().catch((blad) => {
  el.tablica.innerHTML = `<p class="pusto">${bezpieczny(blad.message)}</p>`
})
