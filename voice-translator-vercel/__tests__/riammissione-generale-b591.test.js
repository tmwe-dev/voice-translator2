// ═══════════════════════════════════════════════════════════════
// b.591 — la riammissione del potato per silenzio, generalizzata
//
// Continuazione di b.250 (solo heartbeat) e del tentativo b.589
// (ritirato: indistinguibile da un'espulsione vera). Il segnale in
// piu, deciso da Luca: la SOLA funzione che rimuove per inattivita
// (potaMembriAssenti) lascia una traccia a scadenza breve; un kick
// vero (blocca()) o un'uscita volontaria (handleLeave) non passano
// mai di li e non lasciano traccia. resolveRoomIdentity riammette
// SOLO se trova la traccia — altrimenti nega come prima di questo
// push, protetto dallo stesso test in sessionTokens.test.js.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JOIN_ROOM, REMOVE_MEMBER } from '../app/lib/redisLua.js';

const store = {};
const sets = {};

function handleEval(script, numKeys, ...rest) {
  const keys = rest.slice(0, numKeys);
  const argv = rest.slice(numKeys);
  if (script === JOIN_ROOM) {
    const data = store[keys[0]]; if (!data) return null;
    const room = JSON.parse(data);
    const [name, lang, avatarRaw, nowStr] = argv;
    const avatar = avatarRaw !== '' ? avatarRaw : null;
    const now = parseInt(nowStr, 10);
    const idx = room.members.findIndex((m) => m.name === name);
    if (idx >= 0) { room.members[idx].lang = lang; room.members[idx].joined = now; room.members[idx].avatar = avatar; }
    else if (room.members.length < 10) { room.members.push({ name, lang, joined: now, role: 'guest', avatar, lastSeen: now }); }
    else return 'PIENA';
    const encoded = JSON.stringify(room); store[keys[0]] = encoded; return encoded;
  }
  if (script === REMOVE_MEMBER) {
    const data = store[keys[0]]; if (!data) return null;
    const room = JSON.parse(data);
    const target = String(argv[0]).toLowerCase();
    const prima = room.members.length;
    room.members = room.members.filter((m) => String(m.name).toLowerCase() !== target);
    if (room.members.length === prima) return null;
    const encoded = JSON.stringify(room); store[keys[0]] = encoded; return encoded;
  }
  const data = store[keys[0]]; if (!data) return null;
  return data;
}

const mockRedis = vi.fn(async (cmd, ...a) => {
  if (cmd === 'EVAL') {
    const [script, numKeys, ...rest] = a;
    return handleEval(script, numKeys, ...rest);
  }
  switch (cmd) {
    case 'GET': return store[a[0]] ?? null;
    case 'SET': { store[a[0]] = a[1]; return 'OK'; }
    case 'DEL': { delete store[a[0]]; return 1; }
    case 'EXPIRE': return 1;
    case 'SADD': { (sets[a[0]] ||= new Set()).add(a[1]); return 1; }
    case 'SISMEMBER': return sets[a[0]]?.has(a[1]) ? 1 : 0;
    default: return null;
  }
});
vi.mock('../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));

const {
  createRoomSession, resolveRoomIdentity, potaMembriAssenti,
  leggiPotatoPerSilenzio, SOGLIA_PRESENZA_MS,
} = await import('../app/lib/store.js');
const { normalizza } = await import('../app/lib/moderazione.js');

const stanzaCon = (id, membri) => {
  store[`room:${id.toUpperCase()}`] = JSON.stringify({ id: id.toUpperCase(), members: membri, host: membri[0]?.name });
};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  for (const k of Object.keys(sets)) delete sets[k];
  vi.clearAllMocks();
});

describe('b.591 — potaMembriAssenti lascia una traccia, SOLO per chi ha davvero potato', () => {
  it('rimuovendo un fantasma per inattivita, scrive una traccia leggibile da leggiPotatoPerSilenzio', async () => {
    const vecchio = Date.now() - SOGLIA_PRESENZA_MS - 1000;
    stanzaCon('ABC', [
      { name: 'Luca', role: 'host', lastSeen: Date.now() },
      { name: 'Mario', role: 'guest', lang: 'es', avatar: '/avatars/2.webp', lastSeen: vecchio },
    ]);
    const room = JSON.parse(store['room:ABC']);
    await potaMembriAssenti('ABC', room);
    const traccia = await leggiPotatoPerSilenzio('ABC', 'Mario');
    expect(traccia).toBeTruthy();
    expect(traccia.lang).toBe('es');
    expect(traccia.avatar).toBe('/avatars/2.webp');
  });

  it('un membro ancora nella soglia NON viene toccato, nessuna traccia', async () => {
    stanzaCon('ABC', [
      { name: 'Luca', role: 'host', lastSeen: Date.now() },
      { name: 'Mario', role: 'guest', lang: 'es', lastSeen: Date.now() - 5000 },
    ]);
    const room = JSON.parse(store['room:ABC']);
    await potaMembriAssenti('ABC', room);
    expect(await leggiPotatoPerSilenzio('ABC', 'Mario')).toBeNull();
  });
});

describe('b.591 — resolveRoomIdentity riammette SOLO chi ha la traccia di potatura per silenzio', () => {
  it('senza traccia: token valido ma non piu membro → negato (comportamento invariato, protetto anche in sessionTokens.test.js)', async () => {
    const { token } = await createRoomSession('ROOM1', 'Mario', 'guest');
    stanzaCon('ROOM1', [{ name: 'Luca', role: 'host' }]); // Mario assente, nessuna traccia scritta
    const identity = await resolveRoomIdentity(token, null, 'ROOM1');
    expect(identity).toBeNull();
  });

  it('con traccia valida: token valido, non piu membro, ma potato per silenzio → riammesso', async () => {
    const { token } = await createRoomSession('ROOM1', 'Mario', 'guest');
    stanzaCon('ROOM1', [{ name: 'Luca', role: 'host' }]); // Mario assente
    store[`stanza:ROOM1:potato:mario`] = JSON.stringify({ lang: 'fr', avatar: null });
    const identity = await resolveRoomIdentity(token, null, 'ROOM1');
    expect(identity).toBeTruthy();
    expect(identity.name).toBe('Mario');
    expect(identity.verified).toBe(true);
    // e' rientrato per davvero: la stanza ora lo contiene di nuovo.
    const room = JSON.parse(store['room:ROOM1']);
    expect(room.members.some((m) => m.name === 'Mario')).toBe(true);
  });

  it('con traccia valida MA nel frattempo bloccato: la traccia non basta, resta negato (il P1 del 15/8 non si indebolisce)', async () => {
    const { token } = await createRoomSession('ROOM1', 'Mario', 'guest');
    stanzaCon('ROOM1', [{ name: 'Luca', role: 'host' }]);
    store[`stanza:ROOM1:potato:mario`] = JSON.stringify({ lang: 'fr', avatar: null });
    (sets['stanza:ROOM1:bloccati'] ||= new Set()).add(normalizza('Mario'));
    const identity = await resolveRoomIdentity(token, null, 'ROOM1');
    expect(identity).toBeNull();
  });

  it('con traccia ma la stanza e ormai scaduta (nessuna prova): eAncoraMembroStanza fail-open la lascerebbe dentro comunque, quindi non arriva nemmeno a controllare la traccia', async () => {
    const { token } = await createRoomSession('ROOM1', 'Mario', 'guest');
    // Nessuna stanza in store: nessuna prova di espulsione.
    const identity = await resolveRoomIdentity(token, null, 'ROOM1');
    expect(identity).toBeTruthy();
    expect(identity.name).toBe('Mario');
  });
});
