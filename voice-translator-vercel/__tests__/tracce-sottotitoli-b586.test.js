import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tracceDaElenco, ordinaTracce, parametriTraccia } from '../app/lib/tracceSottotitoli.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.586 — la traccia YouTube non perde la propria identita', () => {
  it('conserva kind=asr e name invece di tenere soltanto la lingua', () => {
    const tracce = tracceDaElenco(`<?xml version="1.0"?><transcript_list>
      <track id="0" name="" lang_code="en" kind="asr" lang_default="true" />
      <track id="1" name="Italiano &amp; CC" lang_code="it-IT" />
    </transcript_list>`);
    expect(tracce).toEqual([
      { lingua: 'en', kind: 'asr', nome: '', default: true },
      { lingua: 'it-IT', kind: '', nome: 'Italiano & CC', default: false },
    ]);
    const p = parametriTraccia('abcdefghijk', tracce[0]);
    expect(p.get('lang')).toBe('en');
    expect(p.get('kind')).toBe('asr');
    expect(p.get('fmt')).toBe('json3');
  });

  it('prova prima la lingua richiesta, poi inglese, poi il resto', () => {
    const tracce = [
      { lingua: 'fr', kind: '', nome: '' },
      { lingua: 'en', kind: 'asr', nome: '' },
      { lingua: 'it-IT', kind: '', nome: 'CC' },
    ];
    expect(ordinaTracce(tracce, 'it').map((t) => t.lingua)).toEqual(['it-IT', 'en', 'fr']);
  });

  it('il parser non inventa tracce quando YouTube restituisce vuoto', () => {
    expect(tracceDaElenco('')).toEqual([]);
    expect(tracceDaElenco('<transcript_list></transcript_list>')).toEqual([]);
  });

  it('b.588 — un 200 vuoto non viene piu memorizzato come «nessun sottotitolo»', () => {
    const route = leggi('app/api/video/sottotitoli/route.js');
    expect(route).toMatch(/VERSIONE_CACHE = 'v3'/);
    expect(route).toMatch(/!lista\.ok \|\| tracceDichiarate\.length === 0/);
    expect(route).toMatch(/motivo: 'elenco_vuoto_non_affidabile'/);
    expect(route).not.toMatch(/TTL_VUOTI|memoria vuota non scritta/);
  });
});
