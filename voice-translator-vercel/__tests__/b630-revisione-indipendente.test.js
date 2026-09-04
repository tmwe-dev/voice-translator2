import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// b.630 — LE COSE TROVATE DAL SECONDO REVISORE.
//
// Il diff della bonifica e stato letto da chi non l'aveva scritto, come
// vuole la Fase 5. Ha trovato tre difetti che il primo giro non poteva
// vedere — uno dei quali aperto dallo strumento stesso della bonifica.
// Queste prove vedono l'assenza di ciascuno.

const leggi = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

function tutteLeRotte() {
  const radice = path.join(process.cwd(), 'app/api');
  const fuori = [];
  (function cammina(dir) {
    for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, voce.name);
      if (voce.isDirectory()) cammina(p);
      else if (voce.name === 'route.js') fuori.push(p);
    }
  })(radice);
  return fuori;
}

describe('b.630 — il registro delle visite lo scrive solo il servizio', () => {
  it('la funzione e revocata a public, anon e authenticated', () => {
    const sql = leggi('supabase/migrations/016_registro_visite_solo_servizio.sql');
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION segna_visita_rotta\(text\)\s+FROM public, anon, authenticated/);
    expect(sql).toMatch(/REVOKE ALL ON public\.rotte_visite FROM anon, authenticated/);
  });

  it('e il search_path comprende pg_temp', () => {
    const sql = leggi('supabase/migrations/016_registro_visite_solo_servizio.sql');
    expect(sql).toContain('SET search_path = public, pg_temp');
  });

  it('il nome della rotta ha un tetto: una chiave lunga a piacere non entra', () => {
    const sql = leggi('supabase/migrations/016_registro_visite_solo_servizio.sql');
    expect(sql).toMatch(/left\(p_rotta, 200\)/);
  });
});

describe('b.630 — nessuna rotta viva resta invisibile al registro', () => {
  // Il conteggio «83 su 84» era sbagliato: veniva dall'inventario, che
  // conta le rotte non-410, non quelle che passano dalla guardia.
  const FUORI_PER_SCELTA = new Set([
    'app/api/og/route.js',        // la chiedono WhatsApp e i social, senza credenziali
    'app/api/lending/route.js',   // risponde 410 dalla b.??? — non e viva
  ]);

  it('ogni rotta viva o passa da withApiGuard o segna la visita a mano', () => {
    const scoperte = [];
    for (const f of tutteLeRotte()) {
      const rel = path.relative(process.cwd(), f);
      if (FUORI_PER_SCELTA.has(rel)) continue;
      const src = fs.readFileSync(f, 'utf8');
      const guardata = /withApiGuard\(/.test(src);
      const segnata = /segnaVisita\(/.test(src);
      if (!guardata && !segnata) scoperte.push(rel);
    }
    expect(scoperte, 'rotte vive che il registro non vedrebbe').toEqual([]);
  });

  it('la rotta che incassa i pagamenti Stripe e fra quelle contate', () => {
    const src = leggi('app/api/wallet/webhook/route.js');
    expect(src).toContain("segnaVisita('/api/wallet/webhook')");
  });
});

describe('b.630 — la sentinella della versione non da falsi allarmi', () => {
  it('se il diario non dichiara il numero di push, non lo confronta', () => {
    const prova = leggi('__tests__/versione-unica-b421.test.js');
    expect(prova).toMatch(/if \(d\.push === null\) return;/);
  });
});

describe('b.630 — cio che non si e corretto e scritto dove si vede', () => {
  it('costoConversazione dice di non avere piu chiamanti', () => {
    const src = leggi('app/wallet/consumo.js');
    const i = src.indexOf('export function costoConversazione');
    const prima = src.slice(Math.max(0, i - 1400), i);
    expect(prima).toContain('NON HA PIU CHIAMANTI IN PRODUZIONE');
  });

  it('e davvero non ne ha, fuori dalle prove', () => {
    const chiamanti = [];
    (function cammina(dir) {
      for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, voce.name);
        if (voce.isDirectory()) cammina(p);
        else if (/\.jsx?$/.test(voce.name)) {
          const t = fs.readFileSync(p, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
          if (/\bcostoConversazione\s*\(/.test(t) && !p.endsWith('consumo.js')) {
            chiamanti.push(path.relative(process.cwd(), p));
          }
        }
      }
    })(path.join(process.cwd(), 'app'));
    expect(chiamanti).toEqual([]);
  });
});
