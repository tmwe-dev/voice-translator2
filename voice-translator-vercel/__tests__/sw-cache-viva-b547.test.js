import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══════════════════════════════════════════════════════════════
// b.547 — LA CACHE NON PUO PIU RESTARE INDIETRO.
//
// Luca ha visto per settimane versioni MESCOLATE: l'indirizzo diceva
// «?v=819» mentre in produzione girava il numero 832, e ne usciva
// «ReferenceError: Cannot access 'T' before initialization» — un errore
// che sembrava del codice e invece era della cache.
//
// Causa: CACHE_VERSION nel service worker era ferma a 19 dal b.372,
// quattrocentosessanta rilasci prima. Il ramo `activate` butta solo le
// cache col nome DIVERSO da quello corrente: con il numero fermo, il
// nome non cambiava mai e il guscio HTML di allora restava li, insieme
// ai pezzi di programma di allora.
//
// Questa prova impedisce che succeda di nuovo: se il numero di rilascio
// corre avanti e la cache resta indietro, diventa rossa PRIMA che se ne
// accorga Luca.
// ═══════════════════════════════════════════════════════════════

const SCARTO_MASSIMO = 40;   // una manciata di rilasci di tolleranza

describe('b.547 — la cache del service worker segue i rilasci', () => {
  it('CACHE_VERSION non e rimasta indietro rispetto a PUSH', () => {
    const sw = leggi('public/sw.js');
    const cost = leggi('app/lib/constants.js');
    const mSw = sw.match(/const CACHE_VERSION = (\d+);/);
    const mPush = cost.match(/export const PUSH = (\d+);/);
    expect(mSw, 'CACHE_VERSION deve esistere in public/sw.js').toBeTruthy();
    expect(mPush, 'PUSH deve esistere in app/lib/constants.js').toBeTruthy();
    const cache = Number(mSw[1]);
    const push = Number(mPush[1]);
    const scarto = push - cache;
    expect(scarto,
      `la cache e ferma a ${cache} mentre i rilasci sono a ${push}: `
      + 'alza CACHE_VERSione in public/sw.js allo stesso numero di PUSH, '
      + 'altrimenti chi usa l\'app continuera a ricevere il guscio vecchio '
      + 'mescolato al codice nuovo (b.547)').toBeLessThanOrEqual(SCARTO_MASSIMO);
    // e non deve nemmeno correre AVANTI: sarebbe un numero inventato
    expect(scarto).toBeGreaterThanOrEqual(-1);
  });

  it('e le cache vecchie vengono davvero buttate quando il nome cambia', () => {
    const sw = leggi('public/sw.js');
    expect(sw).toMatch(/const CACHE_NAME = `vt-cache-v\$\{CACHE_VERSION\}`/);
    // il ramo activate cancella tutto cio che non ha il nome corrente
    expect(sw).toMatch(/\.filter\(\(n\) => n !== CACHE_NAME && n !== TTS_CACHE_NAME && n !== TRANSLATE_CACHE_NAME\)/);
    expect(sw).toMatch(/self\.clients\.claim\(\)/);
  });

  it('i pezzi di programma vengono presi PRIMA dalla rete (b.363, non si tocca)', () => {
    const sw = leggi('public/sw.js');
    const ramo = sw.slice(sw.indexOf("request.destination === 'script'"));
    expect(ramo.slice(0, 1400), 'la rete comanda, la cache e solo la riserva offline')
      .toMatch(/return networkFetch\.catch\(\(\) => cached\)/);
  });
});
