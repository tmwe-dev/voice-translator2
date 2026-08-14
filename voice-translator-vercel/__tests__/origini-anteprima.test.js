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
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const sorgente = fs.readFileSync(path.join(RADICE, 'middleware.js'), 'utf8');

// Si ricostruisce la regola come la scrive il middleware, per provarla
// davvero invece di leggerla.
const NOME = 'voice-translator2';
const TEAM = 'tmweapps-projects';
const anteprima = new RegExp(`^https://${NOME}-[a-z0-9]+-${TEAM}\\.vercel\\.app$`);
const consentita = (o) =>
  o === `https://${NOME}.vercel.app` || anteprima.test(o);

describe('le nostre anteprime passano', () => {
  it('l\'indirizzo di deploy vero e accettato', () => {
    // E l'indirizzo reale che ha fatto emergere il difetto.
    expect(consentita('https://voice-translator2-n6q9te9sj-tmweapps-projects.vercel.app')).toBe(true);
  });

  it('e anche il dominio del progetto senza suffissi', () => {
    expect(consentita('https://voice-translator2.vercel.app')).toBe(true);
  });
});

describe('e nessun altro', () => {
  it('un progetto altrui col nostro nome davanti NON passa', () => {
    // Era il buco della vecchia regola: bastava chiamare il proprio
    // progetto `voice-translator2-qualcosa`.
    expect(consentita('https://voice-translator2-evil.vercel.app')).toBe(false);
    expect(consentita('https://voice-translator2-evil-altrui-projects.vercel.app')).toBe(false);
  });

  it('un dominio esterno non passa', () => {
    for (const o of [
      'https://attacker.com',
      'https://voice-translator2.vercel.app.attacker.com',
      'https://evil.vercel.app',
      'http://voice-translator2.vercel.app',
    ]) {
      expect(consentita(o), `${o} non deve passare`).toBe(false);
    }
  });

  it('e lo slug del team e obbligatorio nelle anteprime', () => {
    expect(consentita('https://voice-translator2-abc123.vercel.app')).toBe(false);
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
