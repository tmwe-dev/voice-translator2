import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// b.631 — LA SINTESI DEL MONDO SI PAGA PRIMA, NON DOPO.
//
// Era l'ultima rotta rimasta col vecchio giro: leggeva il saldo, chiamava
// OpenAI, e addebitava dopo ignorando l'esito. Leggere il saldo non lo
// blocca: due richieste dello stesso utente con un secondo di credito
// passavano entrambe, chiamavano entrambe il fornitore, e una sola
// pagava. La stessa finestra di corsa che b.171 aveva chiuso su
// /api/summary — che fa lo stesso lavoro, allo stesso prezzo.

const leggi = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const senzaCommenti = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const ROTTA = 'app/api/topics/riassunto/route.js';

describe('b.631 — /api/topics/riassunto riserva prima di chiamare il fornitore', () => {
  it('non usa piu il vecchio giro di addebito', () => {
    const src = senzaCommenti(leggi(ROTTA));
    expect(src).not.toMatch(/addebitaRiassunto/);
    expect(src).not.toMatch(/creditoInsufficiente\s*\(/);
    expect(src).not.toMatch(/creditoFinito\s*\(/);
  });

  it('riserva, poi commit, e sono lo stesso importo', () => {
    const src = senzaCommenti(leggi(ROTTA));
    expect(src).toMatch(/import\s*\{[^}]*riserva[^}]*commit[^}]*release[^}]*\}\s*from/);
    expect(src).toMatch(/const costoR = costoRiassunto\(\);/);
    expect(src).toMatch(/riserva\(billingEmail, costoR/);
    expect(src).toMatch(/commit\(riservaId, costoR/);
  });

  it('la riserva viene presa PRIMA della chiamata a OpenAI', () => {
    const src = leggi(ROTTA);
    const iRiserva = src.indexOf('await riserva(billingEmail, costoR');
    const iFornitore = src.indexOf('openai.chat.completions.create');
    expect(iRiserva).toBeGreaterThan(-1);
    expect(iFornitore).toBeGreaterThan(-1);
    expect(iRiserva, 'la riserva deve venire prima del fornitore').toBeLessThan(iFornitore);
  });

  it('se la riserva non riesce, il fornitore non viene chiamato', () => {
    const src = leggi(ROTTA);
    const i = src.indexOf('await riserva(billingEmail, costoR');
    const dopo = src.slice(i, i + 400);
    expect(dopo).toMatch(/if\s*\(\s*!\s*r\.ok\s*\)/);
    expect(dopo).toMatch(/return NextResponse\.json[\s\S]{0,120}402/);
  });

  it('ogni uscita fra riserva e commit restituisce il credito', () => {
    const src = senzaCommenti(leggi(ROTTA));
    // fornitore caduto, sintesi vuota, imprevisto: tre rilasci distinti
    for (const motivo of ['fornitore_non_disponibile', 'sintesi_vuota', 'errore_imprevisto']) {
      expect(src, `manca il rilascio per ${motivo}`).toContain(`release(riservaId, '${motivo}')`);
    }
  });

  it('dopo ogni commit o release la riserva non resta in mano a nessuno', () => {
    const src = senzaCommenti(leggi(ROTTA));
    const usi = src.match(/(commit|release)\(riservaId[\s\S]{0,160}?riservaId = null/g) || [];
    expect(usi.length, 'ogni commit/release deve azzerare riservaId').toBeGreaterThanOrEqual(4);
  });
});

describe('b.631 — lo stesso lavoro si paga allo stesso modo ovunque', () => {
  it('riassunto del Mondo e riassunto della conversazione usano lo stesso conto e lo stesso giro', () => {
    const mondo = senzaCommenti(leggi(ROTTA));
    const conversazione = senzaCommenti(leggi('app/api/summary/route.js'));
    for (const src of [mondo, conversazione]) {
      expect(src).toContain('costoRiassunto()');
      expect(src).toMatch(/riserva\(/);
      expect(src).toMatch(/commit\(/);
      expect(src).toMatch(/release\(/);
    }
  });
});
