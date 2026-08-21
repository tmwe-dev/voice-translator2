// ═══════════════════════════════════════════════════════════════
// LE NOSTRE ANTEPRIME ERANO BLOCCATE DALLA NOSTRA REGOLA (b.130)
//
// Trovato montando il banco di prova a due utenti: due origini diverse
// dello stesso deploy, per simulare due persone senza secondo telefono.
//
// GET passava (200). POST rispondeva **403 con corpo vuoto e nessun
// content-type** — cioe non sembrava nemmeno una risposta
// dell'applicazione. Ho cercato il difetto nel posto sbagliato per un
// bel po' proprio per quello.
//
// ── PRIMO DIFETTO: LA REGEX NON CONOSCEVA VERCEL ──
//
// Si aspettava `voice-translator(-hash).vercel.app`, due segmenti.
// Un indirizzo Vercel vero ne ha tre:
//
//     voice-translator2-n6q9te9sj-tmweapps-projects.vercel.app
//     └── progetto ──┘└─ hash ──┘└──── team ─────┘
//
// E il nome predefinito era `voice-translator`, mentre il progetto si
// chiama `voice-translator2`.
//
// Quindi OGNI anteprima veniva rifiutata dalle proprie API. Il commento
// diceva "consenti solo le nostre" e non ne consentiva nessuna: chi
// voleva provare un deploy prima di pubblicarlo non poteva.
//
// ── SECONDO DIFETTO: IL RIFIUTO ERA MUTO ──
//
//     return new NextResponse(null, { status: 403 });
//
// Nessun corpo, nessun content-type, nessun motivo. La stessa classe di
// b.119 e b.122 — un errore che non dice niente — rimasta nel
// middleware, dove nessuno l'aveva cercata.
//
// ── E LA REGOLA ORA E PIU STRETTA DI PRIMA ──
//
// La vecchia accettava `progetto-qualsiasicosa`. Chiunque poteva
// registrare su Vercel un progetto chiamato `voice-translator2-evil` e
// la sua origine sarebbe passata. Ora si esige anche lo slug del team,
// che non e registrabile da altri.
// ═══════════════════════════════════════════════════════════════
// ── b.363 · QUESTA PROVA NON PROVAVA IL PROGRAMMA ──
//
// Fin qui il file dichiarava di provare la regola sulle origini, ma la
// RICOPIAVA qui dentro riga per riga e poi provava la copia. Se domani
// qualcuno cambiava la regola vera nel middleware — o la cancellava —
// questa copia restava com'era e il test continuava a passare, verde e
// muto. Sorvegliava se stessa, non l'applicazione.
//
// Ora si bussa davvero alla porta: si chiama il middleware vero con una
// richiesta vera e si guarda cosa risponde. Chi e consentito riceve il
// permesso di origine nell'intestazione, chi non lo e viene respinto
// con un 403 parlante.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const sorgente = fs.readFileSync(path.join(RADICE, 'middleware.js'), 'utf8');

// Il middleware fissa la lista delle origini consentite nel momento in
// cui viene caricato: per provarlo con un ambiente pulito va ricaricato
// da zero ogni volta.
const ambienteOriginale = { ...process.env };

async function caricaMiddleware() {
  vi.resetModules();
  // Queste due variabili allargano la lista delle origini consentite. Se
  // la macchina di chi esegue le prove ne ha una, il risultato
  // cambierebbe senza che nessuno se ne accorga.
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.ALLOWED_ORIGIN;
  return (await import('../middleware.js')).middleware;
}

// Una richiesta come la vede il middleware: percorso, metodo, origine.
const richiesta = (origine, percorso = '/api/room', metodo = 'GET') => ({
  method: metodo,
  nextUrl: { pathname: percorso },
  headers: { get: (n) => (n.toLowerCase() === 'origin' ? origine : null) },
});

// La domanda vera: il middleware ha dato il permesso a questa origine?
async function permesso(origine) {
  const mw = await caricaMiddleware();
  return mw(richiesta(origine)).headers.get('Access-Control-Allow-Origin');
}

// E questa: quanto vale il rifiuto?
async function rifiuto(origine) {
  const mw = await caricaMiddleware();
  return mw(richiesta(origine));
}

beforeEach(() => { process.env = { ...ambienteOriginale }; });
afterEach(() => { process.env = { ...ambienteOriginale }; });

describe('le nostre anteprime passano', () => {
  it('l\'indirizzo di deploy vero e accettato', async () => {
    // E l'indirizzo reale che ha fatto emergere il difetto.
    const o = 'https://voice-translator2-n6q9te9sj-tmweapps-projects.vercel.app';
    expect(await permesso(o)).toBe(o);
  });

  it('e anche il dominio del progetto senza suffissi', async () => {
    const o = 'https://voice-translator2.vercel.app';
    expect(await permesso(o)).toBe(o);
  });
});

describe('e nessun altro', () => {
  it('un progetto altrui col nostro nome davanti NON passa', async () => {
    // Era il buco della vecchia regola: bastava chiamare il proprio
    // progetto `voice-translator2-qualcosa`.
    expect((await rifiuto('https://voice-translator2-evil.vercel.app')).status).toBe(403);
    expect((await rifiuto('https://voice-translator2-evil-altrui-projects.vercel.app')).status).toBe(403);
  });

  it('un dominio esterno non passa', async () => {
    for (const o of [
      'https://attacker.com',
      'https://voice-translator2.vercel.app.attacker.com',
      'https://evil.vercel.app',
      'http://voice-translator2.vercel.app',
    ]) {
      const res = await rifiuto(o);
      expect(res.status, `${o} non deve passare`).toBe(403);
    }
  });

  it('e lo slug del team e obbligatorio nelle anteprime', async () => {
    expect((await rifiuto('https://voice-translator2-abc123.vercel.app')).status).toBe(403);
  });

  it('il rifiuto dice chi e stato respinto, non e muto', async () => {
    // E il secondo difetto di b.130: un 403 senza corpo non si
    // distingue da un guasto di rete. Prima questa prova si accontentava
    // di CERCARE la parola giusta nel sorgente; ora legge la risposta.
    const res = await rifiuto('https://attacker.com');
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(await res.json()).toEqual({
      error: 'Origine non consentita',
      origine: 'https://attacker.com',
    });
  });
});

describe('un rifiuto dice perche', () => {
  it('il 403 muto non c\'e piu', () => {
    expect(sorgente, 'un 403 senza corpo non si distingue da un guasto di rete')
      .not.toMatch(/return new NextResponse\(null, \{ status: 403 \}\)/);
  });

  it('e la risposta e JSON, con il motivo', () => {
    const i = sorgente.indexOf("pathname.startsWith('/api/') && !allowedOrigin && origin");
    const corpo = sorgente.slice(i, i + 700);
    expect(corpo).toMatch(/Origine non consentita/);
    expect(corpo).toMatch(/'Content-Type': 'application\/json'/);
  });
});

describe('i valori non sono scritti a mano nel codice', () => {
  it('nome progetto e team vengono dall\'ambiente, con un ripiego', () => {
    // Se un giorno il progetto cambia nome, si cambia una variabile su
    // Vercel — non si va a cercare una regex dentro il middleware.
    expect(sorgente).toMatch(/process\.env\.VERCEL_PROJECT_NAME \|\| 'voice-translator2'/);
    expect(sorgente).toMatch(/process\.env\.VERCEL_TEAM_SLUG \|\| 'tmweapps-projects'/);
  });
});
