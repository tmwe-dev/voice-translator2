// ═══════════════════════════════════════════════════════════════
// b.566 — TUTTI I 500 AVEVANO UNA SOLA CAUSA
//
// Dai registri di produzione, cercando da dove venissero gli errori
// server: 35 in quattro ore, su tre rotte diverse — /api/reazioni,
// /api/room, /api/messages — e TUTTI lo stesso messaggio:
//
//     Circuit OPEN for redis:upstash — retry after 30s
//
// LE DUE CAUSE, una dentro l'altra:
// ① `redis()` faceva fail-open per GET, SET, INCR, EXPIRE e TTL — ma
//    stanze e messaggi vivono su LISTE e HASH, e per quelle rilanciava.
//    Un rallentamento di Upstash diventava una schermata rotta.
// ② l'interruttore restava aperto TRENTA secondi dopo tre inciampi: un
//    istante di lentezza diventava mezzo minuto di applicazione ferma.
//
// LA REGOLA CHE NE ESCE, e vale oltre Redis: **una LETTURA che non
// riesce torna vuota, una SCRITTURA no.** «Adesso non ho niente da
// darti» e' una risposta; fingere che un messaggio sia stato salvato
// quando non lo e' sarebbe una bugia.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('l interruttore di Redis e suo, e piu paziente', () => {
  const c = leggi('app/lib/circuitBreaker.js');

  it('cinque inciampi prima di aprire, otto secondi di riposo', () => {
    expect(c).toMatch(/export const redisCircuitBreaker = new CircuitBreaker\(\{ failureThreshold: 5, cooldownMs: 8000 \}\)/);
  });

  it('e quello dei fornitori di intelligenza resta severo', () => {
    // li un errore costa davvero e ritentare costa di piu.
    expect(c).toMatch(/export const apiCircuitBreaker = new CircuitBreaker\(\{ failureThreshold: 3, cooldownMs: 30000 \}\)/);
  });

  it('Redis usa il proprio, non quello degli altri', () => {
    const r = leggi('app/lib/redis.js');
    expect(r).toMatch(/import \{ redisCircuitBreaker \}/);
    expect(r).toMatch(/redisCircuitBreaker\.execute\(circuitKey/);
    expect(r, 'e non tocca piu quello condiviso').not.toMatch(/apiCircuitBreaker/);
  });
});

describe('una lettura che non riesce torna vuota, non esplode', () => {
  const r = leggi('app/lib/redis.js');

  it('le liste e le mappe hanno il loro «niente»', () => {
    expect(r).toMatch(/LRANGE: \[\]/);
    expect(r).toMatch(/HGETALL: \{\}/);
    expect(r, 'e i conteggi tornano zero, non undefined').toMatch(/LLEN: 0/);
  });

  it('sono censite tutte le letture che usiamo davvero', () => {
    for (const cmd of ['LRANGE', 'HGETALL', 'ZRANGE', 'SMEMBERS', 'EXISTS', 'LLEN']) {
      expect(r, `${cmd} deve poter fallire senza rompere`).toMatch(new RegExp(`'${cmd}'`));
    }
  });

  it('ma una SCRITTURA rilancia: un messaggio perso non si finge salvato', () => {
    const dopo = r.slice(r.indexOf('Le SCRITTURE no'));
    expect(dopo).toMatch(/throw err;/);
  });
});

describe('«riprova fra poco» non e «guasto del server»', () => {
  const g = leggi('app/lib/apiGuard.js');

  it('l interruttore aperto diventa 503, non 500', () => {
    expect(g).toMatch(/if \(e\?\.code === 'CIRCUIT_OPEN'\)/);
    expect(g).toMatch(/status: 503/);
  });

  it('e dice a chi chiama fra quanto riprovare', () => {
    expect(g).toMatch(/'Retry-After': String\(e\.retryAfterSec \|\| 8\)/);
    expect(g).toMatch(/riprova: true/);
  });

  it('il 500 resta per i difetti veri', () => {
    // se tutto e 500, il difetto vero resta nascosto nel rumore — che e
    // esattamente quello che e successo per settimane.
    expect(g).toMatch(/trackError\(prefix, e, req\);\s*\n\s*return NextResponse\.json\(\{ error: 'Internal server error' \}, \{ status: 500 \}\)/);
  });
});
