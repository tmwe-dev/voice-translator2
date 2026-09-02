import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// b.604 — Modulo E dell'audit di architettura (b.598): quattro modi di
// scrivere nel registro (createLogger come `log` in 112 file e come `dbg`
// in 12, console.* diretto in 68 file / 254 chiamate, traccia, Sentry).
// Ora: un logger, un nome, e la regola eslint `no-console` e' un errore.

function tuttiIFile(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) tuttiIFile(p, acc);
    else if (/\.js$/.test(n)) acc.push(p);
  }
  return acc;
}
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

describe('b.604 — un registro solo', () => {
  const radice = join(process.cwd(), 'app');
  it('nessun console.* fuori da lib/logger.js', () => {
    const colpevoli = [];
    for (const f of tuttiIFile(radice)) {
      if (f.endsWith('lib/logger.js')) continue;
      const s = senzaCommenti(readFileSync(f, 'utf8'));
      const m = s.match(/\bconsole\.(log|warn|error|info|debug)\b/g);
      if (m) colpevoli.push(`${relative(radice, f)}: ${m.length}`);
    }
    expect(colpevoli).toEqual([]);
  });
  it('il logger si chiama `log` dappertutto, mai piu `dbg`', () => {
    const colpevoli = [];
    for (const f of tuttiIFile(radice)) {
      const s = senzaCommenti(readFileSync(f, 'utf8'));
      if (/const dbg = createLogger\(/.test(s)) colpevoli.push(relative(radice, f));
    }
    expect(colpevoli).toEqual([]);
  });
  it('la regola eslint e\' un errore senza eccezioni', () => {
    const cfg = readFileSync(join(process.cwd(), 'eslint.config.mjs'), 'utf8');
    expect(cfg).toMatch(/'no-console': 'error'/);
    expect(cfg).not.toMatch(/allow: \['warn', 'error'\]/);
  });
});

describe('b.604 — il logger e\' variadico: niente argomenti persi', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it('uno, due, tre argomenti: nessuno sparisce nel JSON di produzione', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { createLogger } = await import('../app/lib/logger.js');
    const righe = [];
    vi.spyOn(console, 'warn').mockImplementation((r) => righe.push(JSON.parse(r)));
    const log = createLogger('prova');
    log.warn('solo messaggio');
    log.warn('con dato', { a: 1 });
    log.warn('con stringa', 'dettaglio');
    log.warn('con tre', 'x', 2);
    expect(righe[0]).toMatchObject({ level: 'warn', tag: 'prova', msg: 'solo messaggio' });
    expect(righe[1]).toMatchObject({ msg: 'con dato', a: 1 });
    expect(righe[2]).toMatchObject({ msg: 'con stringa', detail: 'dettaglio' });
    expect(righe[3]).toMatchObject({ msg: 'con tre', dettagli: ['x', 2] });
  });
});
