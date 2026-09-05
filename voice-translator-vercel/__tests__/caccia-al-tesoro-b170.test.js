// ═══════════════════════════════════════════════════════════════
// b.170 — chiusura dei punti aperti dopo l'audit del 15/8
//
// Cinque interventi, tutti richiesti esplicitamente dall'utente dopo
// aver letto l'analisi:
//   1. P0-3 — nome dell'host non basta piu a ottenere il ruolo host
//      (segreto di rientro separato; test in roomActions.test.js)
//   2. P1 — "blocca" ora revoca davvero la capability: un gettone di
//      stanza valido non autorizza piu se chi lo porta non e piu membro
//   3. P1 — resolveAuth fail-closed anche per lending e host (non solo
//      Path 1): un pagante dichiarato ma inesistente non usa piu la
//      chiave di piattaforma gratis
//   4. P2 — budget/tetto giornaliero: riserva atomica prima della
//      chiamata invece di GET+confronto, chiude la race concorrente
//   5. Chat Action e Summary NON convertiti a reservation in questo
//      round (vedi nota nel messaggio all'utente): restano check-then-
//      charge, un intervento economico a se.
//
// CLAUDE.md trappola 1: dove serve, si legge il codice senza i commenti
// (che CITANO il difetto vecchio) per non prendere per buona la nota.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommentiDiRiga = (src) =>
  src.split('\n').filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*')).join('\n');

// ── Mock Redis in-memory (comandi usati da apiAuth/store/moderazione) ──
const store = {};
const sets = {};
const mockRedis = vi.fn(async (cmd, ...a) => {
  switch (cmd) {
    case 'GET': return store[a[0]] ?? null;
    case 'SET': { store[a[0]] = a[1]; return 'OK'; }
    case 'DEL': { delete store[a[0]]; return 1; }
    case 'EXPIRE': return 1;
    case 'INCRBYFLOAT': {
      const v = (parseFloat(store[a[0]] || '0') || 0) + parseFloat(a[1]);
      store[a[0]] = String(v);
      return String(v);
    }
    case 'SADD': { (sets[a[0]] ||= new Set()).add(a[1]); return 1; }
    case 'SREM': { sets[a[0]]?.delete(a[1]); return 1; }
    case 'SISMEMBER': return sets[a[0]]?.has(a[1]) ? 1 : 0;
    default: return null;
  }
});
vi.mock('../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));
vi.mock('../app/lib/encryption.js', () => ({ encryptKeys: (k) => k, decryptKeys: (k) => k }));

// ───────────────────────────────────────────────────────────────
// 1. Budget: riserva atomica prima della chiamata (comportamento)
// ───────────────────────────────────────────────────────────────
describe('Budget giornaliero: la riserva e atomica, non piu GET+confronto', () => {
  const src = leggi('app/lib/apiAuth.js');
  const codice = senzaCommentiDiRiga(src);

  it('config.js definisce la costante di riserva', () => {
    expect(leggi('app/lib/config.js')).toMatch(/export const BUDGET_RESERVE_CENTS\s*=\s*\d/);
  });

  it('il controllo tetto usa INCRBYFLOAT (riserva) e non piu un GET del contatore', () => {
    // Nel corpo reale (senza commenti) non deve piu comparire la vecchia
    // lettura `GET` del contatore giornaliero prima del confronto.
    const iCheck = codice.indexOf('Check daily spending limits');
    // il marker e in un commento: si cerca invece il blocco del tetto.
    const blocco = codice.slice(codice.indexOf('riservatoUtenteCents = 0'), codice.indexOf('return { apiKey'));
    expect(blocco).toMatch(/INCRBYFLOAT', dailyKey, BUDGET_RESERVE_CENTS/);
    expect(blocco).toMatch(/INCRBYFLOAT', platformDailyKey, BUDGET_RESERVE_CENTS/);
    expect(blocco).not.toMatch(/parseFloat\(await redis\('GET', platformDailyKey\)/);
  });

  it('quando rifiuta per tetto superato, ANNULLA la riserva presa (non la lascia a gonfiare il contatore)', () => {
    const blocco = codice.slice(codice.indexOf('riservatoUtenteCents = 0'), codice.indexOf('return { apiKey'));
    // b.636 — il rollback era scritto due volte, in due rami, e il ramo
    // di piattaforma doveva ricordarsi anche di quello utente. Ora c'e
    // UN posto solo che rende tutto quello che si e preso (`rendiTutto`),
    // e i due rifiuti lo chiamano. La proprieta difesa e la stessa —
    // rifiutando non si lascia niente a gonfiare i contatori — e il
    // controllo e piu stretto: si verifica che TUTTI E DUE i rifiuti
    // rendano, non solo che esistano due sottrazioni.
    const rollback = blocco.match(/INCRBYFLOAT', [^,]+, -riservato\w+Cents/g) || [];
    expect(rollback.length, 'si rende il contatore utente e quello di piattaforma').toBeGreaterThanOrEqual(2);
    const rifiuti = blocco.match(/await rendiTutto\(\);[\s\S]{0,160}?throw NextResponse/g) || [];
    expect(rifiuti.length, 'sia il tetto personale sia quello di piattaforma rendono prima di rifiutare').toBe(2);
  });

  it('trackDailySpend netta la riserva: incrementa (costo - riservato), non il costo pieno', () => {
    const fn = codice.slice(codice.indexOf('export async function trackDailySpend'));
    expect(fn).toMatch(/const delta = amountCents - riservato/);
    expect(fn).toMatch(/INCRBYFLOAT', chiave, delta/);
  });

  it('COMPORTAMENTO: due chiamate concorrenti sotto lo stesso tetto non lo sforano in silenzio', async () => {
    for (const k of Object.keys(store)) delete store[k];
    const { resolveAuth, trackDailySpend } = await import('../app/lib/apiAuth.js');
    // Nessun utente/stanza: percorso "accesso libero" → conta solo il
    // tetto di piattaforma. Simula il contatore gia vicino al tetto.
    // PLATFORM_TOTAL = 10000 (config). Lo si porta a 9999 a mano.
    const oggi = new Date().toISOString().split('T')[0];
    store[`daily:platform:${oggi}`] = '9999';
    // Prima chiamata: riserva 5 → totale 10004, (10004-5)=9999 < 10000 → passa.
    const a1 = await resolveAuth({ provider: 'openai', minCredits: 0 });
    expect(a1.riservatoPiattaformaCents).toBe(5);
    // Seconda chiamata concorrente: il contatore e gia 10004 per la
    // riserva della prima → (10009-5)=10004 >= 10000 → RIFIUTA.
    let rifiutata = false;
    try { await resolveAuth({ provider: 'openai', minCredits: 0 }); }
    catch (e) { rifiutata = !!(e && e.status === 503); }
    expect(rifiutata, 'la seconda concorrente deve essere respinta, non passare insieme alla prima').toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// 2. resolveAuth fail-closed: lending e host (non solo Path 1)
// ───────────────────────────────────────────────────────────────
describe('resolveAuth: un pagante dichiarato ma inesistente NON usa la chiave di piattaforma', () => {
  const codice = senzaCommentiDiRiga(leggi('app/lib/apiAuth.js'));

  it('Path 1 (utente): user assente → throw (gia da b.168, resta verde)', () => {
    expect(codice).toMatch(/if \(!user\) \{\s*throw NextResponse\.json\(\{ error: ERRORS\.UNAUTHORIZED \}/);
  });

  it('Path 2 (lending): lenderUser assente → throw, non prosegue con la chiave di piattaforma', () => {
    const path2 = codice.slice(codice.indexOf('lendingCode) {'), codice.indexOf('roomId) {'));
    expect(path2).toMatch(/if \(!lenderUser\) \{\s*throw NextResponse\.json/);
  });

  it('Path 3 (host di stanza): hostUser assente → throw (HOST_NO_CREDITS), non prosegue', () => {
    const path3 = codice.slice(codice.indexOf('room.hostEmail) {'));
    expect(path3).toMatch(/if \(!hostUser\) \{\s*throw NextResponse\.json\(\{ error: ERRORS\.HOST_NO_CREDITS \}/);
  });
});

// ───────────────────────────────────────────────────────────────
// 3. Kick revoca davvero: gettone valido ma non piu membro → negato
// ───────────────────────────────────────────────────────────────
describe('Espulsione: un gettone di stanza valido non autorizza piu chi non e piu membro', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    for (const k of Object.keys(sets)) delete sets[k];
    vi.clearAllMocks();
  });

  it('eAncoraMembroStanza: vero per un membro presente e non bloccato', async () => {
    const { eAncoraMembroStanza } = await import('../app/lib/store.js');
    store['room:ABC'] = JSON.stringify({ id: 'ABC', members: [{ name: 'Luca', role: 'host' }] });
    expect(await eAncoraMembroStanza('ABC', 'Luca')).toBe(true);
  });

  it('eAncoraMembroStanza: falso per chi e stato tolto da room.members', async () => {
    const { eAncoraMembroStanza } = await import('../app/lib/store.js');
    store['room:ABC'] = JSON.stringify({ id: 'ABC', members: [{ name: 'Luca', role: 'host' }] });
    expect(await eAncoraMembroStanza('ABC', 'Mario')).toBe(false);
  });

  it('eAncoraMembroStanza: falso per un membro presente ma in blacklist (bloccato)', async () => {
    const { eAncoraMembroStanza } = await import('../app/lib/store.js');
    store['room:ABC'] = JSON.stringify({ id: 'ABC', members: [{ name: 'Mario', role: 'guest' }] });
    // eBloccato (moderazione.js) legge da un set; lo si popola col nome normalizzato.
    const { normalizza } = await import('../app/lib/moderazione.js');
    (sets[`stanza:ABC:bloccati`] ||= new Set()).add(normalizza('Mario'));
    expect(await eAncoraMembroStanza('ABC', 'Mario')).toBe(false);
  });

  // b.171-bis — CORRETTO: la stanza assente NON prova un'espulsione
  // (espellere non cancella la stanza; la stanza scade in 1h, il gettone
  // in 24h). Fallire chiuso qui buttava fuori utenti legittimi e la loro
  // video call a ogni stanza scaduta o intoppo Redis. Ora: nessuna prova
  // contraria → si resta dentro.
  it('eAncoraMembroStanza: VERO se la stanza non esiste (nessuna prova di espulsione)', async () => {
    const { eAncoraMembroStanza } = await import('../app/lib/store.js');
    expect(await eAncoraMembroStanza('NOPE', 'Luca')).toBe(true);
  });

  it('eAncoraMembroStanza: VERO (fail-open) se Redis e irraggiungibile — un guasto non e un\'espulsione', async () => {
    const { eAncoraMembroStanza } = await import('../app/lib/store.js');
    // Il prossimo comando Redis lancia (simula circuit OPEN su Upstash).
    mockRedis.mockImplementationOnce(async () => { throw new Error('Circuit OPEN for redis:upstash'); });
    expect(await eAncoraMembroStanza('ABC', 'Luca')).toBe(true);
  });

  it('kick REALE resta efficace: stanza ESISTE ma il nome non e tra i membri → negato', async () => {
    const { eAncoraMembroStanza } = await import('../app/lib/store.js');
    store['room:ABC'] = JSON.stringify({ id: 'ABC', members: [{ name: 'Luca', role: 'host' }] });
    expect(await eAncoraMembroStanza('ABC', 'EspulsoMario')).toBe(false);
  });

  it('resolveRoomIdentity richiama il controllo di appartenenza (codice)', () => {
    // b.591 — la forma esatta e' cambiata (non piu un return null secco:
    // ora, se non e' piu membro, si prova la riammissione per silenzio
    // prima di negare — vedi riammissione-generale-b591.test.js per il
    // comportamento). Qui si controlla solo che il controllo di
    // appartenenza resti al suo posto, non la forma letterale del ramo.
    expect(senzaCommentiDiRiga(leggi('app/lib/store.js'))).toMatch(/await eAncoraMembroStanza\(roomId, session\.name\)/);
  });

  it('stanza-video e reazioni passano dallo stesso controllo (codice)', () => {
    for (const f of ['app/api/stanza-video/route.js', 'app/api/reazioni/route.js']) {
      const src = leggi(f);
      expect(src).toContain('eAncoraMembroStanza');
      expect(src).toMatch(/if \(!\(await eAncoraMembroStanza\(roomId, s\.name\)\)\) return null;/);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// 4. Chat Action e Summary: a b.170 erano dichiarati NON convertiti.
//    b.171 li ha convertiti (vedi caccia-al-tesoro-b171.test.js): qui si
//    aggiorna la nota storica: NON sono piu check-then-charge.
// ───────────────────────────────────────────────────────────────
describe('Chat Action e Summary: convertiti a reservation in b.171 (erano rinviati a b.170)', () => {
  it('chat-action ora usa riserva/commit/release, non piu addebitaAzioneChat', () => {
    const src = leggi('app/api/chat-action/route.js');
    expect(src).toMatch(/\briserva\(/);
    expect(src).toMatch(/\bcommit\(/);
    expect(src).toMatch(/\brelease\(/);
    expect(src).not.toContain('addebitaAzioneChat');
  });

  it('summary ora usa riserva/commit/release, non piu addebitaRiassunto', () => {
    const src = leggi('app/api/summary/route.js');
    expect(src).toMatch(/\briserva\(/);
    expect(src).toMatch(/\bcommit\(/);
    expect(src).toMatch(/\brelease\(/);
    expect(src).not.toContain('addebitaRiassunto');
  });
});
