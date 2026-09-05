// ═══════════════════════════════════════════════════════════════
// b.633 — DUE FRASI UGUALI, UNA RICEVUTA SOLA: SI PAGAVA DUE VOLTE
//
// Terzo dei difetti trovati dal revisore indipendente della bonifica.
// La chiave della ricevuta e sha256(pagante|testo): due frasi IDENTICHE
// dello stesso utente dentro i sessanta secondi producono la STESSA
// chiave, e la ricevuta era un interruttore (SET '1' / DEL).
//
//   parlo «si» → transcribe addebita la voce, SET ricevuta
//   parlo «si» → transcribe addebita la voce, SET la STESSA ricevuta
//   traduco #1 → DEL: gratis, giusto
//   traduco #2 → DEL torna 0: PAGA il testo, sopra la voce gia pagata
//
// In una conversazione tradotta «si», «ok», «grazie» si ripetono di
// continuo, e il minuto di vita della ricevuta li copre tutti.
//
// Secondo difetto, stesso file: con Redis irraggiungibile il DEL si
// rilancia (le scritture non fanno fail-open, redis.js b.566), l'errore
// veniva inghiottito e valeva «non pagato» — quindi OGNI messaggio
// vocale si pagava due volte per tutta la durata del guasto.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── Redis finto, con interruttore per simulare il guasto ──
let redisGiu = false;
const store = {};
const mockRedis = vi.fn(async (cmd, ...a) => {
  if (redisGiu && cmd !== 'GET') throw new Error('CIRCUIT_OPEN');
  switch (cmd) {
    case 'GET': return store[a[0]] ?? null;
    case 'SET': { store[a[0]] = a[1]; return 'OK'; }
    case 'DEL': { const c = store[a[0]] !== undefined ? 1 : 0; delete store[a[0]]; return c; }
    case 'EXPIRE': return 1;
    case 'INCR': { const v = (parseInt(store[a[0]] || '0', 10) || 0) + 1; store[a[0]] = String(v); return v; }
    case 'DECR': { const v = (parseInt(store[a[0]] || '0', 10) || 0) - 1; store[a[0]] = String(v); return v; }
    default: return null;
  }
});
vi.mock('../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));

const PAGANTE = 'chi-parla@esempio.it';

describe('b.633 — la ricevuta e un contatore, non un interruttore', () => {
  beforeEach(() => { redisGiu = false; for (const k of Object.keys(store)) delete store[k]; });

  it('due voci uguali pagate valgono DUE traduzioni gratis', async () => {
    const { ricevutaVoce, strappaRicevutaVoce } = await import('../app/lib/ricevute.js');
    await ricevutaVoce(PAGANTE, 'si');   // primo audio addebitato
    await ricevutaVoce(PAGANTE, 'si');   // secondo audio addebitato

    const uno = await strappaRicevutaVoce(PAGANTE, 'si');
    const due = await strappaRicevutaVoce(PAGANTE, 'si');

    expect(uno.pagata).toBe(true);
    // Prima di b.633 questa era false: il secondo «si» pagava il testo
    // sopra la voce che aveva gia pagato.
    expect(due.pagata, 'la seconda voce uguale era gia stata pagata').toBe(true);
  });

  it('finite le ricevute si paga, come ha sempre fatto', async () => {
    const { ricevutaVoce, strappaRicevutaVoce } = await import('../app/lib/ricevute.js');
    await ricevutaVoce(PAGANTE, 'grazie');
    expect((await strappaRicevutaVoce(PAGANTE, 'grazie')).pagata).toBe(true);
    expect((await strappaRicevutaVoce(PAGANTE, 'grazie')).pagata, 'la terza traduzione paga').toBe(false);
  });

  it('la ricevuta di uno non vale per un altro (b.107, invariata)', async () => {
    const { ricevutaVoce, strappaRicevutaVoce } = await import('../app/lib/ricevute.js');
    await ricevutaVoce(PAGANTE, 'ok');
    expect((await strappaRicevutaVoce('altro@esempio.it', 'ok')).pagata).toBe(false);
  });

  it('non copre un testo diverso da quello trascritto (b.107, invariata)', async () => {
    const { ricevutaVoce, strappaRicevutaVoce } = await import('../app/lib/ricevute.js');
    await ricevutaVoce(PAGANTE, 'buongiorno');
    expect((await strappaRicevutaVoce(PAGANTE, 'buonasera')).pagata).toBe(false);
  });

  it('una ricevuta mai emessa non lascia in giro una chiave negativa', async () => {
    const { strappaRicevutaVoce } = await import('../app/lib/ricevute.js');
    await strappaRicevutaVoce(PAGANTE, 'mai-detto');
    const chiavi = Object.keys(store).filter((k) => k.startsWith('ricevuta:voce:'));
    expect(chiavi.length, 'il DECR a vuoto va ripulito, o resterebbe senza scadenza').toBe(0);
  });

  it('ogni emissione rinfresca la scadenza', async () => {
    const { ricevutaVoce } = await import('../app/lib/ricevute.js');
    mockRedis.mockClear();
    await ricevutaVoce(PAGANTE, 'pronto');
    const expire = mockRedis.mock.calls.filter((c) => c[0] === 'EXPIRE');
    expect(expire.length).toBe(1);
    expect(expire[0][2]).toBe(60);
  });
});

describe('b.633 — «non lo so» non e piu «non pagato»', () => {
  beforeEach(() => { redisGiu = false; for (const k of Object.keys(store)) delete store[k]; });

  it('con Redis giu lo dichiara invece di rispondere "non pagato"', async () => {
    const { strappaRicevutaVoce } = await import('../app/lib/ricevute.js');
    redisGiu = true;
    const esito = await strappaRicevutaVoce(PAGANTE, 'si');
    expect(esito.pagata).toBe(false);
    expect(esito.sistemaGiu, 'il guasto va distinto dall assenza di ricevuta').toBe(true);
  });

  it('translate non addebita quando il sistema delle ricevute e giu', () => {
    const src = senzaCommenti(leggi('app/api/translate/route.js'));
    expect(src).toMatch(/const esito = await strappaRicevutaVoce\(billingEmail, text\)/);
    expect(src, 'guasto e ricevuta valida portano entrambi a NON addebitare')
      .toMatch(/giaPagatoDavvero = esito\.pagata \|\| esito\.sistemaGiu/);
  });

  it('il vecchio ritorno booleano non e rimasto da nessuna parte', () => {
    const lib = senzaCommenti(leggi('app/lib/ricevute.js'));
    expect(lib).not.toMatch(/return c === 1/);
    expect(lib).toMatch(/return \{ pagata: true, sistemaGiu: false \}/);
  });
});
