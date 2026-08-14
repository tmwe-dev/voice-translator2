// ═══════════════════════════════════════════════════════════════
// LE CONFERME CHE NESSUNO MANDAVA (b.128)
//
// Trovato provando in due, in dieci minuti, dopo giorni di analisi che
// non l'avevano sfiorato.
//
// Ho scritto a Luca. Lui ha ricevuto e mi ha risposto. Il mio messaggio
// aveva ancora UNA spunta sola.
//
// ── PERCHE ──
//
// In b.120 avevo costruito cinque stati per un messaggio:
//
//   in coda · inviato ✓ · consegnato ✓✓ · letto ✓✓ verde · fallito !
//
// e in produzione ne funzionavano TRE. `msg-ack` e `msg-read`
// partivano SOLO da `sendDirectMessageRef` — il canale dati WebRTC —
// che esiste solo durante una chiamata audio o video.
//
// In chat normale non c'era nessun mittente. Non erano rotti: non
// avevano proprio chi li spedisse.
//
// Il ricevente sapeva gestirli (`markDelivered`, `markRead`), la chat
// sapeva mostrarli (cinque rami in MessageList), il canale c'era. Ogni
// pezzo al suo posto, e in mezzo il silenzio.
//
// ── PERCHE NESSUN TEST POTEVA VEDERLO ──
//
// Ogni modulo, da solo, e corretto e passa. Serve un secondo telefono
// che riceva davvero perche il vuoto si manifesti. E la stessa forma
// dei difetti di b.123: non un pezzo sbagliato, ma un collegamento
// mancante fra pezzi giusti.
//
// ── E RIGUARDAVA TUTTI ──
//
// Avevo classificato il canale dati che nasce solo con la chiamata
// (punto 2 dell'audit) come un problema della sola modalita Diretta, e
// l'avevo messo in coda. Sbagliato: spegneva le conferme di consegna
// per chiunque, anche in modalita normale.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('esiste chi manda le conferme', () => {
  const r = () => senzaCommenti(leggi('app/hooks/useRealtimeRoom.js'));

  it('su Realtime, non solo sul canale della chiamata', () => {
    const s = r();
    expect(s).toMatch(/const broadcastAck = useCallback/);
    expect(s).toMatch(/const broadcastRead = useCallback/);
    expect(s).toMatch(/safeBroadcast\('msg-ack'/);
    expect(s).toMatch(/safeBroadcast\('msg-read'/);
  });

  it('e c\'e chi le ascolta dall\'altra parte', () => {
    const s = r();
    expect(s).toMatch(/event: 'msg-ack'/);
    expect(s).toMatch(/event: 'msg-read'/);
  });

  it('la conferma non torna a chi l\'ha mandata', () => {
    // `self: false` sul canale: altrimenti ci si confermerebbe da soli
    // e la spunta direbbe di nuovo una bugia — proprio il difetto che
    // b.120 voleva togliere.
    expect(r()).toMatch(/broadcast: \{ self: false \}/);
  });
});

describe('i due capi sono collegati', () => {
  const rp = () => senzaCommenti(leggi('app/hooks/useRoomPolling.js'));

  it('chi riceve segna consegnato e letto', () => {
    const s = rp();
    expect(s).toMatch(/onAck: markDelivered/);
    expect(s).toMatch(/onRead: markRead/);
  });

  it('e quelle funzioni sono definite PRIMA di chi le usa', () => {
    // Erano in fondo al file: lasciarle li voleva dire usarle nella
    // loro zona morta durante il render, e la pagina esplodeva al primo
    // caricamento. C'era gia andata vicina in b.117.
    const righe = leggi('app/hooks/useRoomPolling.js').split('\n');
    const iDef = righe.findIndex((l) => /const markDelivered = useCallback/.test(l));
    const iUso = righe.findIndex((l) => /= useRealtimeRoom\(\{/.test(l));
    expect(iDef, 'markDelivered deve esistere').toBeGreaterThan(-1);
    expect(iDef, 'definita prima di useRealtimeRoom').toBeLessThan(iUso);
  });
});

describe('la conferma parte da tutti e due i modi di ricevere', () => {
  it('dal canale diretto (era l\'unico che c\'era)', () => {
    const p = senzaCommenti(leggi('app/page.js'));
    expect(p).toMatch(/type: 'msg-ack', msgId: message\.id/);
  });

  it('e da OGNI strada, non solo da Realtime (b.131)', () => {
    // In b.128 l'ack stava in `handleRealtimeMessage`: una sola delle
    // due strade. I messaggi arrivano anche dal polling — primario
    // quando Realtime non e attivo, e l'unico vivo quando la scheda va
    // in secondo piano. Provato in due schede: Bruno vedeva il
    // messaggio e Ada restava a una spunta.
    //
    // `processIncomingMessage` e l'imbuto che chiamano ENTRAMBI.
    const s = senzaCommenti(leggi('app/hooks/useRoomPolling.js'));
    const i = s.indexOf('const processIncomingMessage = useCallback');
    expect(i, 'l\'imbuto deve esistere').toBeGreaterThan(-1);
    expect(s.slice(i, i + 1400)).toMatch(/broadcastAckRef\.current\?\.\(msg\.id\)/);
  });

  it('e NON e rimasto attaccato al solo Realtime', () => {
    const s = senzaCommenti(leggi('app/hooks/useRoomPolling.js'));
    const i = s.indexOf('const handleRealtimeMessage = useCallback');
    expect(s.slice(i, i + 700), 'l\'ack non deve stare qui: e solo una delle strade')
      .not.toMatch(/broadcastAckRef\.current/);
  });

  it('ma non per i propri messaggi', () => {
    // L'imbuto ha gia i controlli: scarta cio che ho mandato io e cio
    // che ho gia visto. Confermarsi da soli farebbe comparire ✓✓ senza
    // che nessuno abbia ricevuto niente.
    const s = senzaCommenti(leggi('app/hooks/useRoomPolling.js'));
    const i = s.indexOf('const processIncomingMessage = useCallback');
    const corpo = s.slice(i, i + 700);
    expect(corpo).toMatch(/sentByMeRef\.current\.has\(msg\.id\)/);
    expect(corpo).toMatch(/msg\.sender === myVerifiedName/);
    expect(corpo.indexOf('return;'), 'gli scarti vengono PRIMA della conferma')
      .toBeLessThan(corpo.indexOf('broadcastAckRef'));
  });
});

describe('in modalita Diretta le conferme non passano dai server', () => {
  const p = () => senzaCommenti(leggi('app/page.js'));

  it('si prova prima il canale diretto', () => {
    const s = p();
    expect(s).toMatch(/if \(sendDirectMessageRef\.current\)[\s\S]{0,220}msg-read/);
  });

  it('e il ripiego su Realtime NON scatta in Diretta', () => {
    // Sarebbe una perdita: una conferma sul nostro canale rivela che
    // quel messaggio esiste, ed e proprio cio che la Diretta promette
    // di non far passare da noi.
    const s = p();
    expect(s).toMatch(/!isDirectMode\(sessionModeRef\.current\) && roomPolling\.broadcastRead/);
    expect(s).toMatch(/!isDirectMode\(sessionModeRef\.current\) && roomPolling\.broadcastAck/);
  });

  it('e il ripiego scatta solo se il diretto NON e riuscito', () => {
    // Mandarle su tutte e due le strade vorrebbe dire due conferme per
    // un messaggio solo, e in Diretta anche una fuga di informazione.
    const s = p();
    expect(s).toMatch(/if \(!partita &&/);
  });
});
