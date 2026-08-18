// ═══════════════════════════════════════════════════════════════
// b.247 — USCIRE DALLA STANZA NON LO SAPEVA NESSUNO.
//
// Il difetto, confermato aprendo lo switch di /api/room: le azioni
// accettate erano create, join, heartbeat, speaking, changeMode,
// changeLang, raiseHand, grantSpeak e check. `leave` NON esisteva.
// L'uscita era una faccenda tutta del client: leaveRoom() in
// useRoomPolling.js azzerava il gettone di stanza, roomId e roomInfo,
// e il server non veniva mai avvisato.
//
// I membri non hanno alcuna scadenza propria (nessun lastSeen, nessuna
// potatura): l'unica e la TTL di un'ora della stanza intera, per giunta
// rinnovata a ogni battito di chi resta dentro. Quindi chi usciva
// restava dentro fino a un'ora, con quattro conseguenze visibili:
//   · membri fantasma nell'elenco dei partecipanti;
//   · capienza falsata (join risponde "La stanza e al completo"
//     contando anche chi se n'e andato);
//   · presenza falsa: partnerConnected nasce da members.length >= 2,
//     cosi l'ultimo rimasto vede "ospite connesso" in una stanza vuota;
//   · chi preme Video chiama un fantasma e aspetta una risposta che
//     nessuno puo dare.
//
// Questi controlli girano sulla rotta VERA (solo Redis e sostituito da
// una copia in memoria), quindi provano il controllo di sicurezza vero:
// non basta un gettone qualsiasi, ci vuole quello di QUESTA stanza.
// La parte client si legge dal sorgente, come in b.245.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { REMOVE_MEMBER } from '../app/lib/redisLua.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
// I commenti si tolgono sempre: un difetto CITATO in un commento non e
// quel difetto, e un test che legge la propria spiegazione non prova nulla.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── Redis finto: la sola dipendenza sostituita ───────────────────
// Tutto il resto (route.js, roomActions.js, store.js, moderazione.js)
// e il codice di produzione. L'unico comando che deve davvero fare
// qualcosa e EVAL con lo script REMOVE_MEMBER: lo si riconosce per
// identita: se un domani store.js smettesse di usare quello script
// (cioe smettesse di essere atomico) questi test diventerebbero rossi.
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
      if (script !== REMOVE_MEMBER) return null;
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

const richiesta = (body) => ({ json: async () => body, headers: new Headers() });

const STANZA = 'AAAA1111';
const ALTRA = 'BBBB2222';

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

const membriDi = (id) => (JSON.parse(magazzino.get(`room:${id}`)).members || []).map((m) => m.name);

beforeEach(() => {
  magazzino.clear();
  evalEseguiti.length = 0;
  redisFinto.mockClear();
  preparaStanza(STANZA, [
    { name: 'Luca', lang: 'it', role: 'host' },
    { name: 'Anna', lang: 'en', role: 'guest' },
  ]);
  preparaStanza(ALTRA, [{ name: 'Luca', lang: 'it', role: 'host' }]);
  preparaGettone('gettone-luca', STANZA, 'Luca', 'host');
  preparaGettone('gettone-anna', STANZA, 'Anna', 'guest');
  preparaGettone('gettone-altra-stanza', ALTRA, 'Luca', 'host');
});

describe('l\'azione leave esiste (prima /api/room rispondeva "Invalid action")', () => {
  it('risponde 200 e toglie DAVVERO il membro dalla stanza', async () => {
    const res = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-anna',
    }));
    const dati = await res.json();
    expect(res.status).toBe(200);
    expect(dati.ok).toBe(true);
    // La prova che conta non e la risposta: e cosa resta nella stanza.
    expect(membriDi(STANZA)).toEqual(['Luca']);
  });

  it('e un\'azione riconosciuta: un\'azione inventata resta "Invalid action"', async () => {
    const res = await POST(richiesta({
      action: 'leaveee', roomId: STANZA, roomSessionToken: 'gettone-anna',
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid action');
  });

  it('la rimozione passa dallo script Lua REMOVE_MEMBER, cioe e atomica', async () => {
    await POST(richiesta({ action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-anna' }));
    // Un leggi-modifica-riscrivi in JavaScript perderebbe l'ingresso di
    // chi entra nello stesso istante: e il difetto gia visto con
    // l'heartbeat, che per questo e diventato di sola lettura.
    expect(evalEseguiti).toContain(REMOVE_MEMBER);
  });
});

describe('SICUREZZA: ci vuole il gettone di QUESTA stanza, non uno qualsiasi', () => {
  it('senza gettone: 401, e nessuno esce', async () => {
    const res = await POST(richiesta({ action: 'leave', roomId: STANZA }));
    expect(res.status).toBe(401);
    expect(membriDi(STANZA)).toEqual(['Luca', 'Anna']);
  });

  it('con un gettone inventato: 401, e nessuno esce', async () => {
    const res = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-di-fantasia',
    }));
    expect(res.status).toBe(401);
    expect(membriDi(STANZA)).toEqual(['Luca', 'Anna']);
  });

  it('con un gettone VALIDO ma di un\'ALTRA stanza: 401, e la stanza non si tocca', async () => {
    // Il caso che distingue un controllo vero da uno di facciata:
    // il gettone esiste, e vivo e appartiene davvero a quel nome —
    // ma per la stanza sbagliata. resolveRoomIdentity confronta
    // session.roomId con la stanza chiesta, e qui non combaciano.
    const res = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-altra-stanza',
    }));
    expect(res.status).toBe(401);
    expect(membriDi(STANZA)).toEqual(['Luca', 'Anna']);
    expect(membriDi(ALTRA)).toEqual(['Luca']);
  });

  it('esce chi porta il gettone, non il nome scritto nel corpo', async () => {
    // Se contasse il nome dichiarato, chiunque potrebbe far uscire
    // chiunque altro: qui il gettone e di Anna e il nome dichiarato e
    // "Luca" — deve uscire Anna.
    const res = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-anna', name: 'Luca',
    }));
    expect(res.status).toBe(200);
    expect(membriDi(STANZA)).toEqual(['Luca']);
  });

  it('e lo stesso identico controllo delle altre azioni protette', () => {
    // Non un controllo nuovo scritto apposta (piu debole per distrazione):
    // `leave` sta nell'elenco needsIdentity insieme a heartbeat e compagni.
    const sorgente = senzaCommenti(leggi('app/api/room/route.js'));
    const riga = sorgente.match(/const needsIdentity = \[[^\]]*\]/);
    expect(riga, 'l\'elenco needsIdentity deve esistere').not.toBeNull();
    expect(riga[0]).toContain("'leave'");
    expect(riga[0]).toContain("'heartbeat'");
  });
});

describe('uscire da una stanza che non c\'e piu non e un errore', () => {
  it('stanza scaduta: non c\'e nessuno da togliere, ma l\'uscita riesce lo stesso', async () => {
    // La stanza dura un'ora; il gettone di sessione ventiquattro. Chi
    // esce dopo che la stanza e scaduta non deve vedere un errore per
    // un'uscita gia vera di fatto: removeMember torna null e la rotta
    // risponde comunque ok.
    magazzino.delete(`room:${STANZA}`);
    const res = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-anna',
    }));
    expect(res.status).toBe(200);
    const dati = await res.json();
    expect(dati.ok).toBe(true);
    expect(dati.room).toBeNull();
  });

  it('uscire due volte da 401, ed e giusto cosi: e la regola di b.170', async () => {
    // Comportamento PREESISTENTE, non introdotto qui: dopo la prima
    // uscita il nome non e piu fra i membri, quindi il suo gettone non
    // vale piu per questa stanza (eAncoraMembroStanza). Lo si mette per
    // iscritto perche non venga scambiato per un difetto: il client
    // ignora comunque l'esito, quindi l'utente esce lo stesso.
    const primo = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-anna',
    }));
    expect(primo.status).toBe(200);
    const secondo = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-anna',
    }));
    expect(secondo.status).toBe(401);
    expect(membriDi(STANZA)).toEqual(['Luca']);
  });
});

describe('l\'ultimo che esce non cambia le regole della stanza', () => {
  it('la stanza resta con l\'elenco vuoto e la sua scadenza, come gia fa "blocca"', async () => {
    preparaStanza(STANZA, [{ name: 'Luca', lang: 'it', role: 'host' }]);
    const res = await POST(richiesta({
      action: 'leave', roomId: STANZA, roomSessionToken: 'gettone-luca',
    }));
    expect(res.status).toBe(200);
    // Non si cancella e non si marca "ended": sarebbe un comportamento
    // NUOVO, e butterebbe fuori chi sta rientrando in quel momento.
    // La stanza scade da sola con la sua TTL di un'ora, esattamente
    // come quando removeMember viene chiamata da blocca().
    expect(magazzino.has(`room:${STANZA}`)).toBe(true);
    const stanza = JSON.parse(magazzino.get(`room:${STANZA}`));
    expect(stanza.members).toEqual([]);
    expect(stanza.ended).toBe(false);
  });

  it('la rotta non cancella stanze ne chiude conversazioni', () => {
    const sorgente = senzaCommenti(leggi('app/api/room/route.js'));
    expect(sorgente).not.toContain("'DEL'");
    expect(sorgente).not.toContain('saveConversation');
  });
});

// ── La parte client: si legge il sorgente, come in b.245 ─────────

describe('il client avvisa il server PRIMA di dimenticare il gettone', () => {
  const hook = () => senzaCommenti(leggi('app/hooks/useRoomPolling.js'));

  it('l\'uscita manda action: leave con il gettone di stanza', () => {
    const s = hook();
    expect(s).toContain("action: 'leave'");
    expect(s).toMatch(/action: 'leave'[^}]*roomSessionToken/);
  });

  it('e lo fa PRIMA di azzerare il gettone (dopo sarebbe un 401 sicuro)', () => {
    const s = hook();
    const iLeave = s.indexOf('avvisaServerDellUscita();');
    const iAzzera = s.indexOf('roomSessionTokenRef.current = null;', s.indexOf('function leaveRoom()'));
    expect(iLeave, 'leaveRoom deve avvisare il server').toBeGreaterThan(-1);
    expect(iAzzera, 'leaveRoom deve continuare ad azzerare lo stato locale').toBeGreaterThan(-1);
    expect(iLeave).toBeLessThan(iAzzera);
  });

  it('e comunque azzera tutto lo stato locale, come faceva prima', () => {
    // L'aggiunta non deve togliere niente a cio che gia funzionava.
    const corpo = hook().slice(hook().indexOf('function leaveRoom()'));
    expect(corpo).toContain('roomSessionTokenRef.current = null;');
    expect(corpo).toContain('setRoomId(null);');
    expect(corpo).toContain('setRoomInfo(null);');
  });
});

describe('un\'uscita non si blocca mai per colpa del server', () => {
  const hook = () => senzaCommenti(leggi('app/hooks/useRoomPolling.js'));

  it('la chiamata non viene attesa: nessun await davanti al fetch di uscita', () => {
    const s = hook();
    const i = s.indexOf('function avvisaServerDellUscita()');
    expect(i, 'la funzione di avviso deve esistere').toBeGreaterThan(-1);
    const corpo = s.slice(i, s.indexOf('function leaveRoom()'));
    expect(corpo).not.toContain('await fetch');
  });

  it('e ogni errore viene ingoiato: catch sulla promessa e try attorno', () => {
    const s = hook();
    const i = s.indexOf('function avvisaServerDellUscita()');
    const corpo = s.slice(i, s.indexOf('function leaveRoom()'));
    expect(corpo).toMatch(/\.catch\(\(\) =>/);
    expect(corpo).toContain('try {');
    expect(corpo).toContain('} catch');
    // keepalive: l'uscita coincide spesso con un cambio di vista o con
    // la chiusura della pagina, e senza il browser puo annullare a meta.
    expect(corpo).toContain('keepalive: true');
  });

  it('senza gettone non si chiama nemmeno (uscita da una stanza gia lasciata)', () => {
    const s = hook();
    const i = s.indexOf('function avvisaServerDellUscita()');
    const corpo = s.slice(i, s.indexOf('function leaveRoom()'));
    expect(corpo).toMatch(/if \(!gettone \|\| !stanza\) return;/);
  });
});
