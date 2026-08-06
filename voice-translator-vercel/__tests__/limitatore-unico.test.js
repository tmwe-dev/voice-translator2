// ═══════════════════════════════════════════════════════════════
// GUARDIA: UN SOLO CONTATORE PER CHIAVE
//
// Nata dal difetto peggiore dell'audit di b.105.
//
// withApiGuard conta le richieste su una chiave `${prefisso}:${IP}` e fa
// INCR. Cinque rotte facevano un SECONDO checkRateLimit con lo STESSO
// prefisso dentro il proprio handler: la chiave era identica, quindi ogni
// richiesta incrementava due volte e valeva il tetto piu basso dei due.
//
// Su /api/room il tetto dichiarato era 420 e quello vero 30 al minuto PER
// INDIRIZZO IP. Il battito della stanza ne fa 40: 429 dopo ventitre
// secondi di conversazione. E per IP significa che due telefoni sullo
// stesso WiFi — il caso del bar, cioe il caso d'uso dell'app — se ne
// dividevano 30.
//
// Il commento in api/room diceva che il tetto era stato alzato a 420
// proprio perche 120 non bastava: la riga interna annullava la correzione
// da allora, e nessuno se n'era accorto perche il degrado e silenzioso
// (il polling smette di aggiornare, non lancia).
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const API = path.join(__dirname, '..', 'app', 'api');

function rotte(dir = API, trovate = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) rotte(p, trovate);
    else if (voce.name === 'route.js') trovate.push(p);
  }
  return trovate;
}

const prefissi = (s, re) => [...s.matchAll(re)].map(m => m[1]);

describe('un solo contatore per chiave', () => {
  const file = rotte();

  it('ci sono rotte da controllare', () => {
    expect(file.length).toBeGreaterThan(30);
  });

  for (const f of file) {
    const nome = path.relative(API, f);
    it(`${nome} non conta due volte la stessa chiave`, () => {
      const s = fs.readFileSync(f, 'utf8');
      // Il prefisso del guard e quelli usati a mano dentro l'handler.
      const delGuard = prefissi(s, /prefix:\s*'([a-z-]+)'/g);
      const aMano = prefissi(s, /getRateLimitKey\(\s*req\s*,\s*'([a-z-]+)'\s*\)/g);
      const scontro = aMano.filter(p => delGuard.includes(p));
      expect(scontro,
        `${nome}: il prefisso "${scontro[0]}" e usato SIA dal guard SIA da un `
        + 'checkRateLimit interno. Stessa chiave, due INCR: ogni richiesta vale '
        + 'due gettoni e il tetto vero e la meta del piu basso dei due.')
        .toEqual([]);
    });
  }

  it('nessuna rotta importa il limitatore senza usarlo', () => {
    const inutili = file.filter(f => {
      const s = fs.readFileSync(f, 'utf8');
      if (!/import .*checkRateLimit.*rateLimit\.js/.test(s)) return false;
      // Occorrenze fuori dalla riga di import.
      const senzaImport = s.split('\n').filter(r => !/^import /.test(r)).join('\n');
      return !/checkRateLimit\s*\(/.test(senzaImport);
    }).map(f => path.relative(API, f));
    expect(inutili, `Import morti in:\n  ${inutili.join('\n  ')}`).toEqual([]);
  });

  it('i tetti delle rotte piu battute sono quelli dichiarati', () => {
    // Se qualcuno rimette un limite basso su queste, il servizio torna a
    // spegnersi da solo durante una conversazione normale.
    const room = fs.readFileSync(path.join(API, 'room', 'route.js'), 'utf8');
    expect(room).toMatch(/maxRequests: 420, prefix: 'room'/);
    const translate = fs.readFileSync(path.join(API, 'translate', 'route.js'), 'utf8');
    expect(translate).toMatch(/maxRequests: 120, prefix: 'translate'/);
  });

  it('sull\'autenticazione e rimasto il tetto piu stretto, non il piu largo', () => {
    for (const [rotta, tetto] of [['auth/apple', 10], ['auth/google', 10]]) {
      const s = fs.readFileSync(path.join(API, ...rotta.split('/'), 'route.js'), 'utf8');
      expect(s, `${rotta} deve restare a ${tetto}/min`)
        .toMatch(new RegExp(`maxRequests: ${tetto},`));
    }
  });
});
