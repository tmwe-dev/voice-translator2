// ═══════════════════════════════════════════════════════════════
// b.487 — TAVOLA 14 DEL TEMPLATE: la sala d'attesa.
//
// Il template (artefatto «BarTalk, layout completo») per LobbyView
// prescrive quattro cose, e questa prova le tiene vere:
//
//  1. IL CODICE E' LA COSA PIU GRANDE A SCHERMO — 48 punti, cifre
//     tabulari: e quello che si detta al telefono o si urla in un bar.
//  2. Sotto il codice c'e scritto COSA FARCI («Leggi questo codice a
//     chi deve entrare») — prima non lo diceva nessuno.
//  3. «In attesa» e una RIGA CON UN PALLINO verde, non un riquadro,
//     e cambia da sola quando entra qualcuno.
//  4. IL BOTTONE IN FONDO C'E' SEMPRE: da soli dice «Entra tu per
//     primo». Prima si poteva entrare solo quando qualcuno era gia
//     dentro — chiusi fuori dalla propria stanza.
//
// Piu la regola di casa: `members` si legge con membriDi() (b.485),
// mai a mano.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { t, preloadLang } from '../app/lib/i18n.js';

const src = readFileSync(join(process.cwd(), 'app/components/LobbyView.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('tavola 14 — il codice comanda', () => {
  it('quarantotto punti, cifre tabulari, testo pieno', () => {
    expect(src).toMatch(/fontSize:48[\s\S]{0,120}tabular-nums/);
    expect(src, 'niente colore d\'accento sul codice: e testo, non decorazione')
      .not.toMatch(/fontSize:48[^}]*accent/);
  });

  it('e sotto dice cosa farci', () => {
    expect(src).toMatch(/readCodeAloud/);
  });

  it("l'etichetta «CODICE» non c'e piu: non informava", () => {
    expect(src).not.toMatch(/L\('code'\)/);
  });
});

describe('tavola 14 — l\'attesa e una riga con un pallino', () => {
  it('il pallino c\'e, e verde quando si aspetta', () => {
    expect(src).toMatch(/width:7, height:7, borderRadius:999/);
    expect(src).toMatch(/#3ddc84/);
  });

  it('e i membri si leggono con membriDi, mai a mano (b.485)', () => {
    expect(src).toMatch(/membriDi\(roomInfo\)/);
    expect(src).not.toMatch(/roomInfo\s*\?\.\s*members/);
  });
});

describe('tavola 14 — si entra anche da soli', () => {
  it('il bottone non e piu prigioniero di partnerConnected', () => {
    expect(src).toMatch(/partnerConnected \? L\('letsStart'\) : L\('enterFirst'\)/);
  });

  it('e le pillole Copia/Condividi ci sono tutte e due', () => {
    expect(src).toMatch(/copyWord/);
    expect(src).toMatch(/shareLink/);
    expect(src, 'la copia scrive il link vero, con la lingua dell\'invito')
      .toMatch(/clipboard\.writeText[\s\S]{0,80}room=\$\{roomId\}&lang=\$\{inviteLang\}/);
  });
});

describe('le tre chiavi nuove esistono in tutte le lingue', () => {
  it('nessuna lingua di serie B (b.370)', async () => {
    const LINGUE = readdirSync(join(process.cwd(), 'app/lib/locales'))
      .filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''));
    for (const l of LINGUE) {
      await preloadLang(l);
      for (const k of ['enterFirst', 'readCodeAloud', 'copyWord']) {
        expect(t(l, k), `${l}/${k}`).not.toBe(k);
        expect(String(t(l, k)).trim(), `${l}/${k}`).not.toBe('');
      }
    }
  });
});
