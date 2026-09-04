import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// b.628 — IL REGISTRO DELLE VISITE.
//
// Serve a rispondere alla domanda che l'audit della b.627 ha lasciato
// aperta: quali rotte non serve piu a nessuno. Ma un registro che
// disturba il prodotto e peggio del non saperlo — quindi queste prove
// verificano soprattutto che NON dia fastidio.

const leggi = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('b.628 — il registro non disturba mai chi sta usando l_app', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://finto.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chiave-finta';
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('non si aspetta: segnaVisita torna subito, senza promessa da attendere', async () => {
    let risolvi;
    const maiFinita = new Promise((r) => { risolvi = r; });
    vi.stubGlobal('fetch', vi.fn(() => maiFinita));
    const { segnaVisita } = await import('../app/lib/registroRotte.js');

    const esito = segnaVisita('/api/qualcosa');
    expect(esito).toBeUndefined();          // niente da attendere
    risolvi(new Response('{}'));
  });

  it('se il registro esplode, l_errore non esce da qui', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('database a terra'))));
    const { segnaVisita } = await import('../app/lib/registroRotte.js');

    expect(() => segnaVisita('/api/qualcosa')).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));   // lascia fallire la promessa
  });

  it('senza le chiavi non prova nemmeno a scrivere', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const spia = vi.fn();
    vi.stubGlobal('fetch', spia);
    const { segnaVisita } = await import('../app/lib/registroRotte.js');

    segnaVisita('/api/qualcosa');
    expect(spia).not.toHaveBeenCalled();
  });

  it('una raffica sulla stessa rotta scrive una volta sola', async () => {
    const spia = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', spia);
    const { segnaVisita } = await import('../app/lib/registroRotte.js');

    for (let i = 0; i < 50; i++) segnaVisita('/api/campanella');
    expect(spia).toHaveBeenCalledTimes(1);
  });

  it('ma due rotte diverse si contano tutte e due', async () => {
    const spia = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', spia);
    const { segnaVisita } = await import('../app/lib/registroRotte.js');

    segnaVisita('/api/una');
    segnaVisita('/api/altra');
    expect(spia).toHaveBeenCalledTimes(2);
  });
});

describe('b.628 — il registro non guarda le persone', () => {
  it('il nome della rotta e il solo percorso: niente query, niente gettoni', async () => {
    const { nomeRotta } = await import('../app/lib/registroRotte.js');
    const finta = { url: 'https://x.app/api/mondo/avvisi?token=SEGRETO&chiavi=pippo' };
    expect(nomeRotta(finta)).toBe('/api/mondo/avvisi');
    expect(nomeRotta(finta)).not.toContain('SEGRETO');
  });

  it('non manda mai indirizzi, gettoni o corpi della richiesta', () => {
    const src = leggi('app/lib/registroRotte.js');
    for (const vietato of ['x-forwarded-for', 'getRateLimitKey', 'req.body', 'authorization\'', 'userAgent']) {
      expect(src.toLowerCase()).not.toContain(vietato.toLowerCase());
    }
    // il corpo spedito contiene solo la rotta
    expect(src).toMatch(/JSON\.stringify\(\{\s*p_rotta:\s*rotta\s*\}\)/);
  });
});

describe('b.628 — e agganciato dove passano quasi tutte le rotte', () => {
  it('withApiGuard segna la visita', () => {
    const guard = leggi('app/lib/apiGuard.js');
    expect(guard).toContain("from './registroRotte.js'");
    expect(guard).toMatch(/segnaVisita\(nomeRotta\(req\)\)/);
  });

  it('e lo fa senza await, per non allungare la richiesta', () => {
    const guard = leggi('app/lib/apiGuard.js');
    expect(guard).not.toMatch(/await\s+segnaVisita/);
  });

  it('la migrazione del registro esiste ed e atomica', () => {
    const sql = leggi('supabase/migrations/015_registro_visite_rotte.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS rotte_visite');
    expect(sql).toContain('ON CONFLICT (rotta) DO UPDATE');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  });
});
