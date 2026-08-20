import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// b.351 — LE PORTE SENSIBILI RESTANO CHIUSE (dal terzo audit esterno,
// blocco D): le cinque rotte amministrative erano protette, ma nessun
// test lo GARANTIVA nel tempo — e la regressione silenziosa e gia
// successa una volta (modalita Diretta). Qui si bussa a ognuna SENZA
// credenziali e si pretende un rifiuto: se un domani qualcuno allenta
// una guardia, questo test diventa rosso prima del deploy.
// ═══════════════════════════════════════════════════════════════

const ROTTE = [
  { nome: 'admin', modulo: '../app/api/admin/route.js', metodi: ['POST'] },
  { nome: 'debug', modulo: '../app/api/debug/route.js', metodi: ['POST'] },
  { nome: 'keys', modulo: '../app/api/keys/route.js', metodi: ['GET', 'POST'] },
  { nome: 'wallet/admin', modulo: '../app/api/wallet/admin/route.js', metodi: ['GET', 'POST'] },
  { nome: 'analytics', modulo: '../app/api/analytics/route.js', metodi: ['POST'] },
  // b.349 — anche la rotta PeepOff pretende la sessione: dentro ci sono
  // chiavi pubbliche e presenza, e il risolutore non deve essere anonimo.
  { nome: 'peepoff', modulo: '../app/api/peepoff/route.js', metodi: ['POST'] },
];

function richiestaNuda(metodo, nome) {
  return new Request(`http://localhost/api/${nome}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    ...(metodo === 'POST' ? { body: JSON.stringify({ azione: 'risolvi', indirizzo: 'x#y.it' }) } : {}),
  });
}

describe('b.351 — nessuna porta sensibile si apre senza credenziali', () => {
  for (const rotta of ROTTE) {
    for (const metodo of rotta.metodi) {
      it(`${metodo} /api/${rotta.nome} senza credenziali viene RESPINTA`, async () => {
        const mod = await import(rotta.modulo);
        const handler = mod[metodo];
        expect(handler, `la rotta ${rotta.nome} non esporta ${metodo}`).toBeTypeOf('function');
        const res = await handler(richiestaNuda(metodo, rotta.nome));
        // 401/403 = porta chiusa. 429 = il cancello di frequenza ha morso
        // prima: comunque chiusa. Tutto il resto (200, 500...) e un buco.
        expect([401, 403, 429], `/${rotta.nome} ${metodo} ha risposto ${res.status}`).toContain(res.status);
      });
    }
  }
});
