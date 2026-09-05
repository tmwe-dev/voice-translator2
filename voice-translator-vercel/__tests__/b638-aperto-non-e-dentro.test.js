// ═══════════════════════════════════════════════════════════════
// b.638 — «APERTO» E «DENTRO» NON SONO LA STESSA COSA
//
// Trovato dal collaudo fisico del 05/09, dal Chrome di Luca, aprendo un
// socket vero verso ElevenLabs con un gettone finto di proposito:
// il socket SI APRE, poi arriva
//   {"message_type":"auth_error","error":"You must be authenticated..."}
// e si chiude con code 1000. Deepgram invece rifiuta la stretta di mano
// e il socket non si apre proprio.
//
// Prendere `onopen` per «sono dentro» voleva dire: interprete che si
// dichiara partito, muore in silenzio, niente sottotitoli, niente voce,
// e NESSUN ripiego sui blocchi — perche chi chiama crede che vada tutto
// bene. E' esattamente la classe di guasto che stiamo chiudendo.
// Non era deducibile leggendo il codice: lo dice solo il fornitore vero.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('b.638 — «aperto» e «dentro» non sono la stessa cosa', () => {
  const src = leggi('app/lib/audio/sttLive.js');

  it('con ElevenLabs l\'apertura del socket NON risolve da sola', () => {
    expect(src).toMatch(/if \(!eleven\) concludi\(true\);/);
  });

  it('session_started e il segnale di ingresso; ogni *error e un guasto', () => {
    expect(src).toMatch(/if \(tipo === 'session_started'\) return \{ tipo: 'pronto' \};/);
    expect(src).toMatch(/tipo\.endsWith\('error'\)/);
  });

  it('un guasto prima dell\'ingresso fa fallire l\'avvio: chi chiama ripiega', () => {
    const i = src.indexOf("if (m.tipo === 'guasto')");
    expect(i).toBeGreaterThan(-1);
    const corpo = src.slice(i, i + 400);
    expect(corpo).toMatch(/if \(!risolto\) \{ concludi\(false\); return; \}/);
  });

  it('e se non si e mai entrati non si aspetta nessun commiato', () => {
    expect(src).toMatch(/if \(entrato && s\.readyState === 1/);
    expect(src).toMatch(/else \{ entrato = true; resolve\(/);
  });
});
