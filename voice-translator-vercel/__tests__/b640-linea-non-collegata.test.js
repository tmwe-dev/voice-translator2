import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
// b.640 — IL SILENZIO SPIEGATO ANCHE QUANDO LA LINEA NON SI COLLEGA
//
// Trovato dal collaudo fisico del 05/09: due schede in videochiamata
// vera, stanza vera, lingue diverse, microfono con voce sintetica.
// Chi RISPONDE si collega e l'interprete parte (2 richieste a
// /api/stt-token). Chi CHIAMA resta su «Connessione...» e l'interprete
// non parte MAI: zero richieste di trascrizione, su tre chiamate
// consecutive.
//
// L'avvio automatico (RoomView, b.286) aspetta `webrtcConnected`, e
// l'auto-stop di useInterpreterMode spegne comunque finche lo stato non
// e 'connected'. Corretto: e la linea che non c'e. Ma a schermo restava
// scritto «le traduzioni appariranno appena parlate», per sempre — e
// chi legge parla, e non capisce perche non succede niente.
//
// Questa registrazione NON corregge la connessione (causa ancora da
// stabilire con due dispositivi veri, vedi il fascicolo): dice la
// verita mentre la linea non c'e.
// ═══════════════════════════════════════════════════════════════

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('b.640 — la schermata dice perche non arrivano i sottotitoli', () => {
  const src = leggi('app/components/VideoCallOverlay.js');

  it('c\'e un ramo per «traduzione accesa ma linea non collegata»', () => {
    expect(src).toMatch(/interpreterActive && webrtc\?\.webrtcState !== 'connected' \?/);
    expect(src).toMatch(/L\('lineaNonCollegata'\)/);
  });

  it('viene PRIMA del segnaposto muto: altrimenti non lo vedrebbe nessuno', () => {
    const iLinea = src.indexOf("webrtcState !== 'connected' ?");
    const iSegnaposto = src.indexOf("L('captionsWillAppear')");
    expect(iLinea).toBeGreaterThan(-1);
    expect(iSegnaposto).toBeGreaterThan(iLinea);
  });

  it('non ruba il posto agli avvisi gia esistenti (spenta, avvio fallito, audio)', () => {
    // «traduzione spenta» resta il primo caso: se e spenta, il motivo e quello.
    const iSpenta = src.indexOf("L('translationOffTap')");
    const iLinea = src.indexOf("webrtcState !== 'connected' ?");
    expect(iSpenta).toBeGreaterThan(-1);
    expect(iSpenta, 'prima si dice che e spenta').toBeLessThan(iLinea);
    // e gli altri due restano raggiungibili dopo
    expect(src.indexOf("L('interpreterFailed')")).toBeGreaterThan(iLinea);
    expect(src.indexOf("L('audioNonChiaro')")).toBeGreaterThan(iLinea);
  });
});

describe('b.640 — la frase esiste in tutte le lingue', () => {
  const dir = path.join(RADICE, 'app/lib/locales');
  const file = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

  it('trentotto pacchetti, e tutti hanno la chiave nuova', () => {
    expect(file.length).toBe(38);
    const senza = file.filter((f) => !fs.readFileSync(path.join(dir, f), 'utf8').includes('"lineaNonCollegata"'));
    expect(senza, `mancano in: ${senza.join(', ')}`).toEqual([]);
  });

  it('nessun pacchetto la lascia vuota', () => {
    const vuote = [];
    for (const f of file) {
      const s = fs.readFileSync(path.join(dir, f), 'utf8');
      const m = s.match(/"lineaNonCollegata":"([^"]*)"/);
      if (!m || m[1].trim().length < 10) vuote.push(f);
    }
    expect(vuote, `vuote o troppo corte in: ${vuote.join(', ')}`).toEqual([]);
  });

  it('l\'intestazione di ogni pacchetto dichiara il conto giusto', () => {
    const sbagliate = [];
    for (const f of file) {
      const s = fs.readFileSync(path.join(dir, f), 'utf8');
      const dichiarato = Number((s.match(/BarTalk \((\d+) keys\)/) || [])[1]);
      if (dichiarato !== 1770) sbagliate.push(`${f}:${dichiarato}`);
    }
    expect(sbagliate, `intestazioni non allineate: ${sbagliate.join(', ')}`).toEqual([]);
  });
});
