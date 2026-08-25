// ═══════════════════════════════════════════════════════════════
// b.488 — TAVOLA 15 DEL TEMPLATE: entra col codice.
//
// «Quattro caselle, non un campo: si sa quanto e lungo il codice prima
// di cominciare a scriverlo.» La tavola le disegna per un codice da
// quattro; i codici veri ne hanno OTTO da sempre (b.248), e le caselle
// sono quante i caratteri veri — la fedelta e allo scopo, non al numero
// disegnato con un codice d'esempio.
//
// SCOSTAMENTI DICHIARATI (tavola 15):
//  - niente pillola «Inquadra il QR»: uno scanner QR in-app per
//    l'ingresso NON esiste, e una pillola senza funzione e un tasto
//    finto. Si aggiunge quando esiste lo scanner.
//  - niente Aa in testata: lo zoom vive dentro RoomView (stesso
//    scostamento della tavola 14, stessa ragione).
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { t, preloadLang } from '../app/lib/i18n.js';

const src = readFileSync(join(process.cwd(), 'app/components/JoinView.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('tavola 15 — caselle, non un campo', () => {
  it('le caselle sono otto: quante i caratteri del codice vero', () => {
    expect(src).toMatch(/Array\.from\(\{ length: 8 \}/);
  });

  it('la casella corrente si distingue: bordo e fondo d\'accento', () => {
    expect(src).toMatch(/attiva = i === joinCode\.length/);
    expect(src).toMatch(/attiva \? `1px solid \$\{C\.accent\}`/);
  });

  it('sotto il vestito c\'e un input vero: incolla e correzione funzionano', () => {
    // l'input invisibile steso sulla fila, con la stessa pulizia di prima
    expect(src).toMatch(/position: 'absolute', inset: 0[\s\S]{0,200}opacity: 0/);
    expect(src).toMatch(/toUpperCase\(\)\.replace\(\/\[\^A-Z0-9\]\/g,''\)/);
  });

  it('sopra le caselle si dice DI CHI e il codice, non «campo codice»', () => {
    expect(src).toMatch(/codeGiven/);
  });

  it('e il bottone si accende solo a codice COMPLETO: otto, non quattro', () => {
    // con disabled a 4 si poteva premere Entra con mezzo codice, e
    // l'errore arrivava dal server invece che dal disegno.
    expect(src).toMatch(/disabled=\{joinCode\.length < 8/);
  });
});

describe('la chiave nuova esiste in tutte le lingue', () => {
  it('nessuna lingua di serie B', async () => {
    const LINGUE = readdirSync(join(process.cwd(), 'app/lib/locales'))
      .filter((f) => f.endsWith('.js')).map((f) => f.replace('.js', ''));
    for (const l of LINGUE) {
      await preloadLang(l);
      expect(t(l, 'codeGiven'), `${l}/codeGiven`).not.toBe('codeGiven');
    }
  });
});
