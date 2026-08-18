// ═══════════════════════════════════════════════════════════════
// b.248 — TRE DIFETTI DELLA STANZA VIDEO DI GRUPPO (audit esterno),
// piu la verita sul quarto.
//
// 1) TRANSCEIVER DOPPI. apriPeer metteva gia le mie tracce con
//    addTrack (una m-line per traccia); proponi aggiungeva COMUNQUE
//    due transceiver espliciti. SDP con m-line doppie: doppio audio,
//    doppio video, meta linee vuote. O l'uno o l'altro, mai entrambi.
//
// 2) CAMERA ACCESA SENZA ESSERE IN STANZA. Solo "stanza piena"
//    fermava le tracce; il ramo `if (!d?.ok)` tornava indietro
//    lasciando microfono e telecamera aperti. Ora il rilascio e UNA
//    funzione sola (spegniMioFlusso), chiamata da OGNI percorso di
//    errore e dall'uscita: se il punto e uno, non si puo dimenticare.
//
// 3) RACE NELLA CASSETTA. La rotta faceva LRANGE e poi DEL come due
//    comandi separati: un ICE arrivato NEL MEZZO veniva cancellato
//    senza essere mai letto. Ora lettura e svuotamento sono uno
//    script Lua (RITIRA_CASSETTA): un solo comando, niente finestra.
//
// 4) IL QUARTO PUNTO ("lo score non si aggiorna col battito") e vero
//    solo a meta: il momento di INGRESSO resta fermo DI PROPOSITO,
//    perche regge la regola chi-chiama-chi (e un test lo impone gia).
//    Il difetto REALE era l'assenza di una presenza VIVA per membro:
//    chi spariva senza salutare restava nei presenti finche qualcun
//    altro teneva viva la chiave — riquadri fantasma e "stanza piena"
//    contando gente che non c'era piu. La cura: un secondo insieme
//    ordinato (battiti) con l'ultimo segno di vita, e la potatura di
//    chi non batte da troppo. L'ordine di arrivo non si tocca.
//
// La rotta sotto esame e quella VERA: solo Redis e sostituito da una
// copia in memoria (stile b.247). La parte client si legge dal
// sorgente, come in b.245/b.247.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RITIRA_CASSETTA } from '../app/lib/redisLua.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
// I commenti si tolgono sempre: un difetto CITATO in un commento non e
// quel difetto, e un test che legge la propria spiegazione non prova nulla.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── Redis finto: liste, insiemi ordinati, e l'EVAL che conta ─────
const magazzino = new Map();   // chiave -> stringa (GET/SET)
const liste = new Map();       // chiave -> [stringhe]
const zsets = new Map();       // chiave -> Map(nome -> punteggio)
const evalEseguiti = [];

// LA TRAPPOLA: simula un segnale che arriva DURANTE il ritiro.
// Con LRANGE+DEL separati, il segnale si infila fra i due comandi e il
// DEL lo cancella non letto. Con lo script atomico, Redis serializza:
// il segnale puo solo accodarsi DOPO lo script, e resta li per il giro
// successivo. La trappola riproduce esattamente questa semantica.
let trappola = null; // { chiave, segnale } — scatta una volta sola

const ordinati = (z) => [...(z || new Map()).entries()]
  .sort((a, b) => a[1] - b[1]).map(([nome]) => nome);

const redisFinto = vi.fn(async (cmd, ...args) => {
  switch (cmd) {
    case 'SET': magazzino.set(args[0], args[1]); return 'OK';
    case 'GET': return magazzino.has(args[0]) ? magazzino.get(args[0]) : null;
    case 'RPUSH': {
      const l = liste.get(args[0]) || [];
      l.push(...args.slice(1));
      liste.set(args[0], l);
      return l.length;
    }
    case 'LRANGE': {
      const letto = [...(liste.get(args[0]) || [])];
      if (trappola && trappola.chiave === args[0]) {
        // Il segnale arriva DOPO la lettura ma PRIMA di un eventuale
        // DEL separato: e la finestra del difetto.
        const l = liste.get(args[0]) || [];
        l.push(trappola.segnale);
        liste.set(args[0], l);
        trappola = null;
      }
      return letto;
    }
    case 'LTRIM': {
      const l = liste.get(args[0]) || [];
      const [da, a] = [Number(args[1]), Number(args[2])];
      liste.set(args[0], l.slice(da < 0 ? Math.max(0, l.length + da) : da,
        a === -1 ? l.length : a + 1));
      return 'OK';
    }
    case 'DEL': liste.delete(args[0]); magazzino.delete(args[0]); zsets.delete(args[0]); return 1;
    case 'ZADD': {
      const z = zsets.get(args[0]) || new Map();
      z.set(args[2], Number(args[1]));
      zsets.set(args[0], z);
      return 1;
    }
    case 'ZSCORE': {
      const z = zsets.get(args[0]);
      return z && z.has(args[1]) ? String(z.get(args[1])) : null;
    }
    case 'ZRANGE': return ordinati(zsets.get(args[0]));
    case 'ZRANGEBYSCORE': {
      const z = zsets.get(args[0]) || new Map();
      const [min, max] = [Number(args[1]), Number(args[2])];
      return [...z.entries()].filter(([, p]) => p >= min && p <= max)
        .sort((a, b) => a[1] - b[1]).map(([nome]) => nome);
    }
    case 'ZREM': {
      const z = zsets.get(args[0]);
      if (z) z.delete(args[1]);
      return 1;
    }
    case 'EVAL': {
      const [script, , chiave] = args;
      evalEseguiti.push(script);
      if (script !== RITIRA_CASSETTA) return null;
      // Un solo comando: si legge e si svuota SENZA che nulla possa
      // infilarsi nel mezzo. Il segnale "concorrente" della trappola
      // puo solo accodarsi dopo, come farebbe Redis vero.
      const letto = [...(liste.get(chiave) || [])];
      if (letto.length) liste.delete(chiave);
      if (trappola && trappola.chiave === chiave) {
        const l = liste.get(chiave) || [];
        l.push(trappola.segnale);
        liste.set(chiave, l);
        trappola = null;
      }
      return letto;
    }
    case 'SISMEMBER': return 0;  // nessuno e bloccato in questi scenari
    case 'INCR': return 1;       // il limitatore di withApiGuard non interferisce
    default: return null;        // EXPIRE, TTL...
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

const { POST } = await import('../app/api/stanza-video/route.js');

const richiesta = (body) => ({ json: async () => body, headers: new Headers() });

const STANZA = 'AAAA1111';
const CASSETTA_LUCA = `svideo:${STANZA}:luca`;
const PRESENZE = `svideo:${STANZA}:presenti`;
const BATTITI = `svideo:${STANZA}:battiti`;

beforeEach(() => {
  magazzino.clear(); liste.clear(); zsets.clear();
  evalEseguiti.length = 0; trappola = null;
  redisFinto.mockClear();
  magazzino.set(`room:${STANZA}`, JSON.stringify({
    id: STANZA, host: 'Luca', created: Date.now(), mode: 'conversation',
    members: [
      { name: 'Luca', lang: 'it', role: 'host' },
      { name: 'Anna', lang: 'en', role: 'guest' },
    ],
    maxPartecipanti: 10, ended: false,
  }));
  magazzino.set('rsess:gettone-luca', JSON.stringify({
    roomId: STANZA, name: 'Luca', role: 'host', created: Date.now(),
  }));
  magazzino.set('rsess:gettone-anna', JSON.stringify({
    roomId: STANZA, name: 'Anna', role: 'guest', created: Date.now(),
  }));
});

const ritira = async (gettone = 'gettone-luca') => {
  const res = await POST(richiesta({
    azione: 'ritira', roomId: STANZA, roomSessionToken: gettone,
  }));
  return res.json();
};

// ─────────────────────────────────────────────────────────────────
// 3) LA CASSETTA SI RITIRA IN UN COLPO SOLO
// ─────────────────────────────────────────────────────────────────

describe('la cassetta dei segnali si legge e si svuota ATOMICAMENTE', () => {
  it('un ICE arrivato fra lettura e svuotamento NON va perso', async () => {
    // Anna manda un'offerta a Luca per la via normale.
    await POST(richiesta({
      azione: 'manda', roomId: STANZA, roomSessionToken: 'gettone-anna',
      a: 'Luca', segnale: { tipo: 'offerta', dati: 'sdp-offerta' },
    }));

    // E un candidato ICE arriva ESATTAMENTE durante il ritiro di Luca.
    trappola = {
      chiave: CASSETTA_LUCA,
      segnale: JSON.stringify({
        da: 'Anna', a: 'Luca', tipo: 'ice',
        dati: 'candidato-nel-mezzo', quando: Date.now(),
      }),
    };

    const primo = await ritira();
    expect(primo.ok).toBe(true);
    expect(primo.segnali.map(s => s.tipo)).toContain('offerta');

    // Il candidato non era nel primo giro: deve esserci nel secondo.
    // Con LRANGE+DEL separati veniva cancellato non letto: sparito.
    const secondo = await ritira();
    expect(secondo.ok).toBe(true);
    expect(
      secondo.segnali.map(s => s.dati),
      'il candidato arrivato durante il ritiro deve arrivare al giro dopo, non sparire'
    ).toContain('candidato-nel-mezzo');
  });

  it('il ritiro passa dallo script Lua RITIRA_CASSETTA (identita, non nome)', async () => {
    await ritira();
    // Se un domani la rotta smettesse di usare QUELLO script (cioe
    // smettesse di essere atomica), questo test diventerebbe rosso.
    expect(evalEseguiti).toContain(RITIRA_CASSETTA);
  });

  it('quello che ho letto non lo rileggo: il secondo giro e vuoto', async () => {
    await POST(richiesta({
      azione: 'manda', roomId: STANZA, roomSessionToken: 'gettone-anna',
      a: 'Luca', segnale: { tipo: 'offerta', dati: 'sdp' },
    }));
    const primo = await ritira();
    expect(primo.segnali.length).toBe(1);
    const secondo = await ritira();
    expect(secondo.segnali).toEqual([]);
  });

  it('lo script fa LRANGE e DEL nello STESSO comando, nello stile degli altri', () => {
    expect(RITIRA_CASSETTA).toContain("redis.call('LRANGE', KEYS[1]");
    expect(RITIRA_CASSETTA).toContain("redis.call('DEL', KEYS[1])");
  });

  it('la rotta non fa piu LRANGE e DEL separati sulla cassetta', () => {
    const sorgente = senzaCommenti(leggi('app/api/stanza-video/route.js'));
    const blocco = sorgente.slice(sorgente.indexOf("case 'ritira'"), sorgente.indexOf('default:'));
    expect(blocco, 'niente LRANGE sciolto nel ritiro').not.toContain("redis('LRANGE'");
    expect(blocco, 'niente DEL sciolto sulla cassetta nel ritiro').not.toContain("redis('DEL', chiave)");
    expect(blocco).toContain('RITIRA_CASSETTA');
  });
});

// ─────────────────────────────────────────────────────────────────
// 4) PRESENZE VIVE: il battito lascia fermo l'INGRESSO ma aggiorna
//    l'ultimo segno di vita, e chi non batte da troppo viene potato
// ─────────────────────────────────────────────────────────────────

describe('il battito aggiorna la presenza VIVA senza toccare l\'ordine di arrivo', () => {
  it('dopo un battito, l\'ultimo segno di vita e recente e l\'ingresso non si muove', async () => {
    const ingresso = Date.now() - 120000; // entrato due minuti fa
    zsets.set(PRESENZE, new Map([['Luca', ingresso]]));
    zsets.set(BATTITI, new Map([['Luca', ingresso]]));

    const res = await POST(richiesta({
      azione: 'battito', roomId: STANZA, roomSessionToken: 'gettone-luca',
    }));
    expect((await res.json()).ok).toBe(true);

    // L'ingresso regge chi-chiama-chi: DEVE restare fermo.
    expect(zsets.get(PRESENZE).get('Luca')).toBe(ingresso);
    // Il segno di vita invece si muove: e lui che distingue vivi e fantasmi.
    expect(zsets.get(BATTITI).get('Luca')).toBeGreaterThan(Date.now() - 5000);
  });

  it('chi non batte da troppo sparisce dai presenti (niente riquadri fantasma)', async () => {
    const tanto = Date.now() - 600000;
    zsets.set(PRESENZE, new Map([['Fantasma', tanto], ['Luca', Date.now() - 1000]]));
    zsets.set(BATTITI, new Map([['Fantasma', tanto], ['Luca', Date.now() - 1000]]));

    const res = await POST(richiesta({
      azione: 'battito', roomId: STANZA, roomSessionToken: 'gettone-luca',
    }));
    const dati = await res.json();
    expect(dati.ok).toBe(true);
    expect(dati.presenti).not.toContain('Fantasma');
    expect(zsets.get(PRESENZE).has('Fantasma')).toBe(false);
  });

  it('i fantasmi non contano per "stanza piena": si puo ancora entrare', async () => {
    // Otto assenti da dieci minuti occupano tutti i posti sulla carta.
    const tanto = Date.now() - 600000;
    const morti = new Map();
    for (let i = 0; i < 8; i++) morti.set(`Fantasma${i}`, tanto);
    zsets.set(PRESENZE, new Map(morti));
    zsets.set(BATTITI, new Map(morti));

    const res = await POST(richiesta({
      azione: 'entra', roomId: STANZA, roomSessionToken: 'gettone-anna',
    }));
    const dati = await res.json();
    expect(res.status, 'gli assenti non devono occupare posti').toBe(200);
    expect(dati.ok).toBe(true);
    expect(dati.devoChiamare, 'e non c\'e nessun fantasma da chiamare').toEqual([]);
  });

  it('chi e vivo e arrivato prima NON viene potato, e resta "prima"', async () => {
    const ieri = Date.now() - 90000;
    zsets.set(PRESENZE, new Map([['Anna', ieri]]));
    zsets.set(BATTITI, new Map([['Anna', Date.now() - 2000]])); // batte, e viva

    await POST(richiesta({
      azione: 'entra', roomId: STANZA, roomSessionToken: 'gettone-luca',
    }));
    const res = await POST(richiesta({
      azione: 'battito', roomId: STANZA, roomSessionToken: 'gettone-luca',
    }));
    const dati = await res.json();
    expect(dati.presenti).toContain('Anna');
    // Anna e entrata prima: e lei che Luca deve richiamare se serve.
    expect(dati.arrivatiPrimaDiMe).toContain('Anna');
  });

  it('uscire toglie anche il segno di vita, non solo la presenza', async () => {
    await POST(richiesta({
      azione: 'entra', roomId: STANZA, roomSessionToken: 'gettone-luca',
    }));
    expect(zsets.get(BATTITI)?.has('Luca')).toBe(true);
    await POST(richiesta({
      azione: 'esci', roomId: STANZA, roomSessionToken: 'gettone-luca',
    }));
    expect(zsets.get(PRESENZE)?.has('Luca') || false).toBe(false);
    expect(zsets.get(BATTITI)?.has('Luca') || false).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// La parte client si legge dal sorgente, come in b.245/b.247
// ─────────────────────────────────────────────────────────────────

const hook = () => senzaCommenti(leggi('app/hooks/useStanzaVideo.js'));

// 1) UNA m-line per media: o le tracce o i transceiver, mai entrambi

describe('l\'SDP esce con UNA m-line per media, non due', () => {
  it('i transceiver espliciti si aggiungono SOLO per i media che non sto gia inviando', () => {
    const s = hook();
    const proponi = s.slice(s.indexOf('const proponi'), s.indexOf('const rispondi'));
    expect(proponi, 'serve il controllo di cosa e gia in invio').toContain('getSenders()');
    expect(proponi).toMatch(/if \(!giaInviati\.has\('audio'\)\) voce\.pc\.addTransceiver\('audio'/);
    expect(proponi).toMatch(/if \(conVideo && !giaInviati\.has\('video'\)\) voce\.pc\.addTransceiver\('video'/);
  });

  it('nessuna chiamata incondizionata ad addTransceiver e rimasta', () => {
    // La riga com'era: `voce.pc.addTransceiver('audio', ...)` a inizio
    // riga, senza guardia. Con addMediaTracks gia fatto in apriPeer,
    // raddoppiava le m-line.
    expect(hook()).not.toMatch(/^\s*voce\.pc\.addTransceiver\(/m);
  });

  it('il caso ricezione-sola resta in piedi: senza flusso mio i transceiver ci sono', () => {
    // Se non ho tracce (niente addMediaTracks), giaInviati e vuoto e i
    // transceiver si aggiungono in ricezione: l'offerta chiede comunque
    // audio e video degli altri.
    const s = hook();
    expect(s).toMatch(/addTransceiver\('audio', \{ direction: 'recvonly' \}\)/);
    expect(s).toMatch(/addTransceiver\('video', \{ direction: 'recvonly' \}\)/);
    expect(s, 'le mie tracce continuano ad andare via addMediaTracks')
      .toMatch(/addMediaTracks\(pc, mioStreamRef\.current\)/);
  });
});

// 2) IL MICROFONO SI SPEGNE SEMPRE: un solo punto di rilascio

describe('camera e microfono si spengono in OGNI percorso di errore', () => {
  it('il rilascio e UNA funzione sola, ed e l\'unico posto che ferma le tracce', () => {
    const s = hook();
    expect(s).toContain('const spegniMioFlusso');
    // Se le fermate sparse tornassero, i percorsi dimenticati tornerebbero
    // con loro: la fermata deve stare in UN posto.
    const fermate = s.match(/getTracks\(\)\.forEach/g) || [];
    expect(fermate.length, 'le tracce si fermano in un punto solo').toBe(1);
  });

  it('il ramo "join fallito" (!d?.ok) spegne PRIMA di tornare', () => {
    // Era il difetto: ritornava lasciando la camera accesa senza
    // essere in stanza.
    expect(hook()).toMatch(/if \(!d\?\.ok\) \{[^}]*spegniMioFlusso\(\);/);
  });

  it('anche "stanza piena" passa dallo stesso rilascio, non da una fermata sua', () => {
    const s = hook();
    // C'e un `if (!d?.ok)` anche in ritira, prima di entra: la fine
    // della fetta si cerca DOPO l'inizio, non dalla cima del file.
    const inizio = s.indexOf("d?.error === 'stanza piena'");
    const piena = s.slice(inizio, s.indexOf('if (!d?.ok)', inizio));
    expect(piena).toContain('spegniMioFlusso();');
  });

  it('il catch di entra spegne: anche un errore a meta non lascia la spia accesa', () => {
    const s = hook();
    const entra = s.slice(s.indexOf('const entra'), s.indexOf('const esci'));
    const dalCatch = entra.slice(entra.indexOf('} catch'));
    expect(dalCatch).toContain('spegniMioFlusso();');
  });

  it('e l\'uscita usa lo stesso identico punto', () => {
    const s = hook();
    const esci = s.slice(s.indexOf('const esci'), s.indexOf('const mandaTesto'));
    expect(esci).toContain('spegniMioFlusso();');
  });
});
