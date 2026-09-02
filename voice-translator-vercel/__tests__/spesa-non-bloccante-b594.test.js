// ═══════════════════════════════════════════════════════════════
// GUARDIA — trackDailySpend fuoco-e-dimentica ovunque (b.594)
//
// Prima di b.594, 3 chiamate erano `await trackDailySpend(...)` con
// try/catch attorno: non potevano mai far fallire la richiesta (l'errore
// resta dentro trackDailySpend, vedi apiAuth.js), ma un Redis lento la
// allungava per niente — 41 timeout/mese in produzione. Questo file
// blocca il regresso: se qualcuno rimette un `await` davanti a
// trackDailySpend in una di queste tre rotte, questo test diventa rosso.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('trackDailySpend non blocca la risposta (b.594)', () => {
  const casi = [
    ['app/api/summary/route.js', 1],
    ['app/api/topics/riassunto/route.js', 1],
    ['app/api/tts-elevenlabs/route.js', 2],
  ];

  for (const [file, atteseChiamate] of casi) {
    it(`${file}: trackDailySpend e' fuoco-e-dimentica, non await`, () => {
      const src = leggi(file);
      const chiamate = src.match(/trackDailySpend\(/g) || [];
      expect(chiamate.length, `mi aspettavo ${atteseChiamate} chiamata/e a trackDailySpend`).toBe(atteseChiamate);

      // Nessuna deve essere preceduta da `await` sulla stessa chiamata:
      // cerchiamo "await trackDailySpend(" e deve essere assente.
      expect(src, 'trovato "await trackDailySpend(" — il timeout Redis tornerebbe a bloccare la risposta').not.toMatch(/await\s+trackDailySpend\(/);

      // E deve gestire l'errore con .catch(, non lasciarlo non gestito
      // (un rejection non gestito su una promise fuori attesa e' un
      // altro modo silenzioso di rompere le cose).
      expect(src, 'trackDailySpend(...) senza .catch(...) dietro — rejection non gestita').toMatch(/trackDailySpend\([^;]*\)\s*\.catch\(/s);
    });
  }
});
