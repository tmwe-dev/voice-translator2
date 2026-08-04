// ═══════════════════════════════════════════════════════════════
// GUARDIA SUL SISTEMA DI PARTICELLE
//
// Ne esistevano quattro che facevano quasi la stessa cosa. Il tentativo
// di fonderli alla cieca (b.80) ha nascosto tutta l'interfaccia.
// Ora ce n'è UNO solo, con due modi. Questo test impedisce che se ne
// aggiunga un altro di nascosto.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const COMPONENTI = path.join(__dirname, '..', 'app', 'components');
const TEMI = ['deep', 'ember', 'avorio', 'lilla', 'blubianco', 'dawn'];

function sorgente(nome) {
  return fs.readFileSync(path.join(COMPONENTI, nome), 'utf8');
}

describe('un solo sciame', () => {
  it('esiste un unico componente a particelle su canvas', () => {
    const conCanvas = fs.readdirSync(COMPONENTI)
      .filter(n => n.endsWith('.js'))
      .filter(n => {
        const s = sorgente(n);
        // Un sistema di particelle: canvas + ciclo di animazione + granelli.
        return /<canvas/.test(s) && /requestAnimationFrame/.test(s) && /devicePixelRatio/.test(s);
      });
    expect(conCanvas, `Attesi: Sciame.js e i generatori di QR. Trovati:\n  ${conCanvas.join('\n  ')}`)
      .toEqual(expect.arrayContaining(['Sciame.js']));
    // Nessuno dei due vecchi deve tornare fra i componenti attivi.
    expect(conCanvas).not.toContain('SciameOnboarding.js');
    expect(conCanvas).not.toContain('PolvereBackdrop.js');
  });

  it('lo sciame conosce tutti e sei i temi', () => {
    const s = sorgente('Sciame.js');
    for (const tema of TEMI) {
      expect(s, `Sciame.js: manca la tinta per "${tema}"`).toMatch(new RegExp(`\\b${tema}\\s*:`));
    }
  });

  it('lo sfondo spaziale conosce tutti e sei i temi', () => {
    const s = sorgente('SpatialBackdrop.js');
    for (const tema of TEMI) {
      expect(s, `SpatialBackdrop.js: manca il mesh per "${tema}"`).toMatch(new RegExp(`\\b${tema}\\s*:`));
    }
  });

  it('lo sciame copre lo schermo, sta dietro e non ruba i clic', () => {
    const s = sorgente('Sciame.js');
    // La stessa geometria del velo che sostituisce: fisso, a tutto schermo,
    // dietro a tutto, trasparente ai clic. Se cambia, la UI ci finisce sotto.
    expect(s).toMatch(/position:\s*'fixed'/);
    expect(s).toMatch(/inset:\s*0/);
    expect(s).toMatch(/zIndex:\s*0/);
    expect(s).toMatch(/pointerEvents:\s*'none'/);
  });

  it('nessuna trasformazione avvolge le pagine in page.js (il bug di b.80)', () => {
    // In b.80 un contenitore con transform era diventato il riferimento dei
    // figli position:fixed: alto zero, quindi tutte le pagine invisibili.
    const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.js'), 'utf8');
    const inizio = src.indexOf('const wrap =');
    expect(inizio, 'wrap() non trovato in page.js').toBeGreaterThan(0);
    // Solo il corpo di wrap(): si ferma alla prima riga vuota dopo.
    const fine = src.indexOf('\n\n', inizio);
    const wrap = src.slice(inizio, fine > 0 ? fine : inizio + 400);
    expect(wrap, 'un transform qui rende invisibili le pagine position:fixed')
      .not.toMatch(/transform|scale\(|translateY/);
  });

  it('i parametri approvati del modo vivo non sono stati toccati', () => {
    const s = sorgente('Sciame.js');
    expect(s, 'granelli del benvenuto').toMatch(/granelli:\s*4500/);
    expect(s, 'raggio della bolla sotto il dito').toMatch(/bolla:\s*78/);
    expect(s, 'quota di granelli con accento').toMatch(/quotaAccento:\s*0\.04/);
    expect(s, 'durata della morfosi').toMatch(/DURATA_MORFOSI\s*=\s*88/);
  });
});
