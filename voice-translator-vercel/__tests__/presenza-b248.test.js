// ═══════════════════════════════════════════════════════════════
// b.248 — LA PRESENZA NON ERA INDIVIDUALE.
//
// Il difetto, confermato aprendo store.js: updateHeartbeat faceva solo
// GET + EXPIRE 3600 sulla chiave della STANZA intera — nessun campo per
// membro veniva mai aggiornato. E il client (useRoomPolling.js) deriva
// `partnerConnected` da `room.members.length >= 2`.
//
// L'uscita PULITA e coperta dal leave di b.247, ma se l'ospite perde la
// rete o il browser muore, nessun leave parte: restava in room.members
// finche la stanza viveva — anche ore, visto che il battito dell'altro
// rinnovava la TTL. L'ultimo rimasto vedeva "ospite connesso" con la
// stanza vuota, premeva Video e chiamava un fantasma.
//
// La correzione: ogni battito scrive un `lastSeen` PER MEMBRO (script
// Lua atomico, come tutte le altre scritture di stanza), e alla lettura
// i membri muti oltre soglia vengono tolti con la STESSA rimozione
// atomica del leave b.247 (REMOVE_MEMBER) — non con un secondo
// meccanismo.
//
// Questi controlli girano sulla rotta VERA (solo Redis e sostituito da
// una copia in memoria), sullo stesso impianto di b.247.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
// Import a spazio dei nomi, non nominato: prima della correzione
// UPDATE_HEARTBEAT e SOGLIA_PRESENZA_MS non esistono, e un import
// nominato farebbe esplodere il file intero invece di far fallire i
// controlli giusti.
import * as lua from '../app/lib/redisLua.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
// I commenti si tolgono sempre: un difetto CITATO in un commento non e
// quel difetto, e un test che legge la propria spiegazione non prova nulla.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
// Per i sorgenti Lua i commenti sono le righe `--`.
const senzaCommentiLua = (s) => s.replace(/^\s*--.*$/gm, '');

// ── Redis finto: la sola dipendenza sostituita ───────────────────
// Come in b.247: gli script Lua si riconoscono per IDENTITA, cosi se un
// domani store.js smettesse di usare quegli script (cioe smettesse di
// essere atomico) questi test diventerebbero rossi. Il finto ne esegue
// la semantica in JavaScript; la potatura vera invece e codice di
// produzione (store.js) e qui gira davvero.
const magazzino = new Map();
const evalEseguiti = [];

const redisFinto = vi.fn(async (cmd, ...args) => {
  switch (cmd) {
    case 'SET': {
      const [key, value] = args;
      magazzino.set(key, value);
      return 'OK';
    }
    case 'GET':
      return magazzino.has(args[0]) ? magazzino.get(args[0]) : null;
    case 'EVAL': {
      const [script, , key, ...argv] = args;
      evalEseguiti.push(script);
      // ── REMOVE_MEMBER: identico al finto di b.247 ──
      if (script === lua.REMOVE_MEMBER) {
        const grezzo = magazzino.get(key);
        if (!grezzo) return null;
        const stanza = JSON.parse(grezzo);
        const bersaglio = String(argv[0]).toLowerCase();
        const rimasti = (stanza.members || []).filter(
          (m) => String(m.name).toLowerCase() !== bersaglio
        );
        if (rimasti.length === (stanza.members || []).length) return null;
        stanza.members = rimasti;
        const codificato = JSON.stringify(stanza);
        magazzino.set(key, codificato);
        return codificato;
      }
      // ── UPDATE_HEARTBEAT (b.248): stampa lastSeen del battente e la
      // grazia iniziale per chi non ha ancora il campo ──
      if (lua.UPDATE_HEARTBEAT && script === lua.UPDATE_HEARTBEAT) {
        const grezzo = magazzino.get(key);
        if (!grezzo) return null;
        const stanza = JSON.parse(grezzo);
        const nome = argv[0];
        const adesso = Number(argv[1]);
        for (const m of stanza.members || []) {
          if (m.name === nome) m.lastSeen = adesso;
          else if (typeof m.lastSeen !== 'number') m.lastSeen = adesso;
        }
        const codificato = JSON.stringify(stanza);
        magazzino.set(key, codificato);
        return codificato;
      }
      return null;
    }
    case 'SISMEMBER':
      return 0;      // nessuno e bloccato in questi scenari
    case 'INCR':
      return 1;      // il limitatore di withApiGuard non deve interferire
    default:
      return null;   // EXPIRE, TTL, SREM...
  }
});

vi.mock('../app/lib/redis.js', () => ({ redis: (...args) => redisFinto(...args) }));

vi.mock('../app/lib/validate.js', () => ({
  sanitizeRoomId: (id) => (typeof id === 'string' ? id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) : ''),
  sanitizeName: (name) => (typeof name === 'string' ? name.slice(0, 50) : ''),
  sanitize: (str, max = 500) => (typeof str === 'string' ? str.slice(0, max) : ''),
  rateLimit: () => ({ allowed: true }),
  getClientIP: () => '127.0.0.1',
}));

const { POST } = await import('../app/api/room/route.js');
const store = await import('../app/lib/store.js');

const richiesta = (body) => ({ json: async () => body, headers: new Headers() });

const STANZA = 'AAAA1111';
// La soglia vera del codice di produzione; il ripiego serve solo alla
// fase rossa, quando l'export ancora non esiste.
const SOGLIA = store.SOGLIA_PRESENZA_MS ?? 60000;

function preparaStanza(id, membri) {
  magazzino.set(`room:${id}`, JSON.stringify({
    id, host: membri[0].name, created: Date.now(), mode: 'conversation',
    members: membri, maxPartecipanti: 10, ended: false,
  }));
}

function preparaGettone(token, idStanza, nome, ruolo = 'guest') {
  magazzino.set(`rsess:${token}`, JSON.stringify({
    roomId: idStanza.toUpperCase(), name: nome, role: ruolo, created: Date.now(),
  }));
}

const stanzaSalvata = (id) => JSON.parse(magazzino.get(`room:${id}`));
const membriDi = (id) => (stanzaSalvata(id).members || []).map((m) => m.name);
const membro = (id, nome) => (stanzaSalvata(id).members || []).find((m) => m.name === nome);

const battito = (token) => POST(richiesta({
  action: 'heartbeat', roomId: STANZA, roomSessionToken: token,
}));

beforeEach(() => {
  magazzino.clear();
  evalEseguiti.length = 0;
  redisFinto.mockClear();
  preparaGettone('gettone-luca', STANZA, 'Luca', 'host');
  preparaGettone('gettone-anna', STANZA, 'Anna', 'guest');
});

describe('il battito aggiorna il lastSeen del membro giusto', () => {
  it('chi batte riceve lastSeen ≈ adesso, in memoria e nella risposta', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Anna', lang: 'en', role: 'guest' },
    ]);
    const prima = Date.now();
    const res = await battito('gettone-anna');
    const dopo = Date.now();
    expect(res.status).toBe(200);
    const { room } = await res.json();
    const annaRisposta = room.members.find((m) => m.name === 'Anna');
    expect(typeof annaRisposta.lastSeen).toBe('number');
    expect(annaRisposta.lastSeen).toBeGreaterThanOrEqual(prima);
    expect(annaRisposta.lastSeen).toBeLessThanOrEqual(dopo);
    // La prova che conta e cosa resta scritto, non solo la risposta.
    expect(membro(STANZA, 'Anna').lastSeen).toBe(annaRisposta.lastSeen);
  });

  it('il battito di uno NON avanza il lastSeen gia scritto di un altro', async () => {
    const vecchio = Date.now() - 10000; // vivo (sotto soglia), ma non "adesso"
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host', lastSeen: vecchio },
      { name: 'Anna', lang: 'en', role: 'guest', lastSeen: vecchio },
    ]);
    await battito('gettone-anna');
    expect(membro(STANZA, 'Luca').lastSeen).toBe(vecchio);
    expect(membro(STANZA, 'Anna').lastSeen).toBeGreaterThan(vecchio);
  });

  it('fa fede l\'orologio del SERVER: un timestamp dichiarato dal client viene ignorato', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Anna', lang: 'en', role: 'guest' },
    ]);
    const prima = Date.now();
    // Campi inventati nel corpo: se qualcuno li leggesse, il lastSeen
    // finirebbe nel futuro e il membro diventerebbe impotabile.
    await POST(richiesta({
      action: 'heartbeat', roomId: STANZA, roomSessionToken: 'gettone-anna',
      now: prima + 999999999, lastSeen: prima + 999999999, timestamp: prima + 999999999,
    }));
    expect(membro(STANZA, 'Anna').lastSeen).toBeLessThanOrEqual(Date.now());
  });
});

describe('POTATURA: un membro muto oltre soglia sparisce alla lettura', () => {
  it('il fantasma viene tolto dal battito di chi resta, e la risposta lo riflette', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Anna', lang: 'en', role: 'guest', lastSeen: Date.now() - SOGLIA - 1000 },
    ]);
    const res = await battito('gettone-luca');
    expect(res.status).toBe(200);
    const { room } = await res.json();
    // E la riga che decide `partnerConnected` lato client: con il
    // fantasma dentro, members.length >= 2 diceva "ospite connesso".
    expect(room.members.map((m) => m.name)).toEqual(['Luca']);
    expect(membriDi(STANZA)).toEqual(['Luca']);
  });

  it('la rimozione passa da REMOVE_MEMBER, la STESSA del leave b.247: e atomica', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Anna', lang: 'en', role: 'guest', lastSeen: Date.now() - SOGLIA - 1000 },
    ]);
    await battito('gettone-luca');
    expect(evalEseguiti).toContain(lua.REMOVE_MEMBER);
  });

  it('un membro muto da MENO della soglia resta dentro', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Anna', lang: 'en', role: 'guest', lastSeen: Date.now() - Math.floor(SOGLIA / 2) },
    ]);
    await battito('gettone-luca');
    expect(membriDi(STANZA)).toEqual(['Luca', 'Anna']);
  });

  it('anche `check` (la lettura senza identita) pota i fantasmi', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Anna', lang: 'en', role: 'guest', lastSeen: Date.now() - SOGLIA - 1000 },
    ]);
    const res = await POST(richiesta({ action: 'check', roomId: STANZA }));
    expect(res.status).toBe(200);
    // Il contratto di check non cambia: exists/ended e basta.
    expect(await res.json()).toEqual({ exists: true, ended: false });
    expect(membriDi(STANZA)).toEqual(['Luca']);
  });
});

describe('GRAZIA: chi non ha (ancora) lastSeen non si pota mai subito', () => {
  it('un membro appena entrato, senza lastSeen, sopravvive alla lettura', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Bob', lang: 'fr', role: 'guest', joined: Date.now() }, // appena dentro
    ]);
    await battito('gettone-luca');
    expect(membriDi(STANZA)).toEqual(['Luca', 'Bob']);
  });

  it('un membro VECCHIO senza il campo (stanza di prima di b.248) sopravvive, e riceve la grazia', async () => {
    const prima = Date.now();
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      // joined di ore fa e NESSUN lastSeen: se la potatura usasse
      // `joined` come ripiego, verrebbe buttato fuori al primo giro.
      { name: 'Vecchio', lang: 'de', role: 'guest', joined: Date.now() - 3 * 3600 * 1000 },
    ]);
    await battito('gettone-luca');
    expect(membriDi(STANZA)).toEqual(['Luca', 'Vecchio']);
    // La grazia: il primo giro gli scrive lastSeen = adesso, cosi ha
    // davanti una soglia INTERA prima di poter essere potato.
    const v = membro(STANZA, 'Vecchio');
    expect(typeof v.lastSeen).toBe('number');
    expect(v.lastSeen).toBeGreaterThanOrEqual(prima);
  });

  it('la lettura non si rompe: la risposta resta 200 con la stessa forma di sempre', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Vecchio', lang: 'de', role: 'guest' }, // ne joined ne lastSeen
    ]);
    const res = await battito('gettone-luca');
    expect(res.status).toBe(200);
    const dati = await res.json();
    // Il contratto verso useRoomPolling non cambia: room, verifiedName,
    // isHost, e i membri con i campi di sempre (+ al piu lastSeen).
    expect(dati.verifiedName).toBe('Luca');
    expect(dati.isHost).toBe(true);
    for (const m of dati.room.members) {
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('lang');
      expect(m).toHaveProperty('role');
    }
  });
});

describe('l\'host non si pota MAI', () => {
  it('un host muto oltre soglia resta dentro (il rientro host dipende dalla sua voce in members)', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host', lastSeen: Date.now() - SOGLIA * 10 },
      { name: 'Anna', lang: 'en', role: 'guest', lastSeen: Date.now() },
    ]);
    await battito('gettone-anna');
    // Se l'host sparisse da members, ruoloDi() al suo rientro direbbe
    // "guest" e nemmeno il segreto host (b.169) potrebbe ridarglielo.
    expect(membriDi(STANZA)).toContain('Luca');
  });
});

describe('il leave di b.247 continua a funzionare come prima', () => {
  it('l\'uscita pulita toglie il membro, subito', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host', lastSeen: Date.now() },
      { name: 'Anna', lang: 'en', role: 'guest', lastSeen: Date.now() },
    ]);
    const res = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-anna',
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(membriDi(STANZA)).toEqual(['Luca']);
  });

  it('e resta protetta: senza gettone il leave e 401 e nessuno esce', async () => {
    preparaStanza(STANZA, [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Anna', lang: 'en', role: 'guest' },
    ]);
    const res = await POST(richiesta({ action: 'leave', roomId: STANZA }));
    expect(res.status).toBe(401);
    expect(membriDi(STANZA)).toEqual(['Luca', 'Anna']);
  });
});

describe('il dato nasce giusto: gli script Lua scrivono lastSeen', () => {
  it('JOIN_ROOM stampa lastSeen sia a chi entra sia a chi rientra', () => {
    const s = senzaCommentiLua(lua.JOIN_ROOM);
    // Ramo del rientro (membro gia in elenco) e ramo dell'ingresso nuovo.
    expect(s).toContain('room.members[i].lastSeen = now');
    expect(s).toMatch(/table\.insert\(room\.members, \{[^}]*lastSeen=now/);
  });

  it('UPDATE_HEARTBEAT esiste ed e un vero script atomico (GET → modifica → SET)', () => {
    expect(typeof lua.UPDATE_HEARTBEAT, 'lo script deve esistere in redisLua.js').toBe('string');
    const s = senzaCommentiLua(lua.UPDATE_HEARTBEAT);
    expect(s).toContain("redis.call('GET', KEYS[1])");
    expect(s).toContain('lastSeen');
    expect(s).toContain("redis.call('SET', KEYS[1], encoded, 'EX', 3600)");
  });

  it('la soglia di potatura regge almeno 3 battiti al ritmo piu lento del client (18s)', () => {
    // Il battito piu lento legittimo: REALTIME_FALLBACK_POLL (3s) per
    // FRENO_A_SCHERMO_SPENTO (6) = 18s. Sotto i 54s si poterebbe un
    // telefono vivo ma in tasca; sopra i 5 minuti i fantasmi tornano
    // a durare troppo per chiamarla "presenza".
    expect(store.SOGLIA_PRESENZA_MS).toBeGreaterThanOrEqual(3 * 18000);
    expect(store.SOGLIA_PRESENZA_MS).toBeLessThanOrEqual(5 * 60000);
  });
});
