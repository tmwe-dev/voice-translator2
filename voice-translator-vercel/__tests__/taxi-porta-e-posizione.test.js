// ═══════════════════════════════════════════════════════════════
// TAXITALK: LA PORTA CHE NON C'ERA E IL PERMESSO NEGATO (b.124)
//
// Due difetti segnalati dall'audit esterno, verificati e confermati.
// Sono indipendenti fra loro, e insieme spiegano perche TaxiTalk non
// ha mai funzionato davvero pur essendo tutto scritto.
//
// ── 1. IL QR PUNTAVA A UNA PAGINA INESISTENTE ──
//
// TaxiQRView genera (riga 83):
//     `${window.location.origin}/taxi/${id}#k=${key}`
//
// useInitializeApp e pronto a leggerlo (riga 190):
//     window.location.pathname.match(/^\\/taxi\\/([a-z0-9]+)$/i)
//
// In mezzo mancava la rotta: nell'albero delle pagine non esisteva
// `app/taxi/[id]/page.js`, e in next.config non c'era nessuna regola
// di riscrittura. Il tassista inquadrava il QR e riceveva un 404.
//
// La destinazione cifrata, la chiave nel frammento, la scadenza: tutto
// corretto, tutto inutile, perche mancava la porta d'ingresso.
//
// ── 2. LA GEOLOCALIZZAZIONE ERA VIETATA A NOI STESSI ──
//
// Le intestazioni dicevano `geolocation=()`, cioe: nessuno puo
// chiederla, nemmeno questa origine. In due punti, per giunta —
// middleware.js e next.config.mjs.
//
// E la stessa applicazione chiama getCurrentPosition in SpeakerView e
// in TaxiDriverView, e watchPosition in TaxiMap.
//
// Il browser rifiutava senza nemmeno mostrare la richiesta di permesso.
// Per chi lo usava, TaxiTalk semplicemente "non trovava la posizione",
// e non c'era modo di risalire al perche: non compariva nessun errore,
// solo una cosa che non succedeva.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const esiste = (p) => fs.existsSync(path.join(RADICE, p));

describe('il QR ha una porta dove atterrare', () => {
  it('la rotta esiste nell\'albero delle pagine', () => {
    expect(esiste('app/taxi/[id]/page.js'),
      'senza questa, /taxi/ABC risponde 404 e il client non parte').toBe(true);
  });

  it('e rende la stessa applicazione, non una pagina a parte', () => {
    // Una seconda applicazione per la stessa cosa vorrebbe dire due
    // posti da tenere allineati.
    const p = leggi('app/taxi/[id]/page.js');
    expect(p).toMatch(/import Home from '\.\.\/\.\.\/page\.js'/);
    expect(p).toMatch(/<Home \/>/);
  });

  // b.182 — il QR della mappa NON punta piu alla nostra app: e un link
  // diretto a una mappa vera (Google Maps: dir/?api=1&destination=). Cosi
  // spariscono i due difetti provati dal vivo (pagina tassista a 404 e
  // mappa nostra che non si disegnava). La rotta /taxi resta in piedi per
  // l'eventuale QR "chat tradotta", e il client la sa ancora leggere.
  it('il QR mappa contiene un link a una mappa vera, non l\'URL della nostra app', () => {
    const view = leggi('app/components/TaxiQRView.js');
    expect(view).toContain('buildMapsUrl');
    expect(view).not.toMatch(/\/taxi\/\$\{id\}#k=/);
    expect(leggi('app/lib/mapsLink.js')).toMatch(/google\.com\/maps|geo:|maps\.apple\.com/);
    expect(leggi('app/hooks/useInitializeApp.js'))
      .toMatch(/pathname\.match\(\/\^\\\/taxi\\\/\(\[a-z0-9\]\+\)\$\/i\)/);
  });

  it('la pagina non legge il frammento: la chiave non deve arrivare al server', () => {
    // Cio che sta dopo il cancelletto non viene spedito. E il motivo per
    // cui la destinazione cifrata puo viaggiare su un QR senza che noi
    // si possa leggerla: se questa pagina cominciasse a maneggiarlo,
    // quella garanzia si incrinerebbe.
    const p = leggi('app/taxi/[id]/page.js');
    expect(p).not.toMatch(/location\.hash|searchParams/);
  });
});

describe('la posizione si puo chiedere', () => {
  it('le intestazioni non la vietano piu, in nessuna delle due configurazioni', () => {
    // Erano due, e correggerne una sola avrebbe lasciato il divieto in
    // piedi a seconda di quale percorso serve la richiesta.
    for (const f of ['middleware.js', 'next.config.mjs']) {
      const t = leggi(f).split('\n').filter((r) => !r.trim().startsWith('//')).join('\n');
      expect(t, `${f} vieta ancora la geolocalizzazione`).not.toMatch(/geolocation=\(\)/);
      expect(t, `${f} deve consentirla all'origine`).toMatch(/geolocation=\(?self\)?/);
    }
  });

  it('e resta ristretta a questa origine', () => {
    // `self` e non `*`: puo chiederla questa applicazione, non un
    // riquadro incorporato da qualcun altro. Il permesso vero lo da
    // comunque l'utente.
    for (const f of ['middleware.js', 'next.config.mjs']) {
      expect(leggi(f), `${f} non deve aprire a tutti`).not.toMatch(/geolocation=\(?\*\)?/);
    }
  });

  it('e c\'e davvero chi la usa: non stiamo aprendo un permesso per niente', () => {
    const usi = ['app/components/SpeakerView.js', 'app/components/TaxiDriverView.js', 'app/components/TaxiMap.js']
      .filter((f) => /navigator\.geolocation/.test(leggi(f)));
    expect(usi.length, 'se un giorno nessuno la usa piu, il permesso va richiuso').toBe(3);
  });
});
