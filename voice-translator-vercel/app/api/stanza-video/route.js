import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { redis } from '../../lib/redis.js';
import { sanitizeRoomId, sanitizeName } from '../../lib/validate.js';
import { verifyRoomSession, getRoom } from '../../lib/store.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('stanza-video');

// ═══════════════════════════════════════════════════════════════
// SMISTAMENTO PER LA STANZA VIDEO DI GRUPPO
//
// Modulo SEPARATO. Non tocca /api/room, che continua a funzionare come
// prima per la chiamata a due: quella e curata, ha il ducking, l'anti-eco
// e la gestione iOS, e non si mette le mani in una cosa che funziona.
//
// LA DIFFERENZA CHE PERMETTE PIU DI DUE PERSONE.
//
// Nella chiamata a due i segnali finiscono in una lista sola della
// stanza, e chi legge prende tutto quello che non ha scritto lui. Con
// due persone e giusto: l'unico "altro" e il tuo interlocutore.
//
// Con tre, quella stessa regola fa danno: la proposta di collegamento
// che Uno manda a Due arriva anche a Tre, che risponde a sua volta, e
// le due risposte si accavallano.
//
// Qui ogni segnale ha un DESTINATARIO. Una cassetta della posta per
// ciascuno — `svideo:{stanza}:{nome}` — e ognuno legge solo la propria.
//
// CHI CHIAMA CHI. Se due persone si offrono a vicenda nello stesso
// istante, la connessione non si stabilisce (in gergo: glare). Serve
// una regola che decida da sola, senza accordi: propone SEMPRE chi ha
// il nome che viene prima in ordine alfabetico. E' arbitraria, ma e
// uguale per tutti e non richiede un giro di rete per concordarla.
// ═══════════════════════════════════════════════════════════════

const TTL = 300;              // i segnali invecchiano in fretta
const MAX_IN_CASSETTA = 60;
const MAX_PARTECIPANTI = 8;   // oltre, ognuno spedisce il video troppe volte

const cassetta = (stanza, nome) => `svideo:${stanza}:${nome.toLowerCase()}`;
const presenze = (stanza) => `svideo:${stanza}:presenti`;

async function chiSei(token, roomId) {
  if (!token) return null;
  const s = await verifyRoomSession(token);
  if (!s) return null;
  if (s.roomId && roomId && s.roomId.toUpperCase() !== roomId.toUpperCase()) return null;
  return s;
}

async function handlePost(req) {
  try {
    const corpo = await req.json();
    const azione = typeof corpo.azione === 'string' ? corpo.azione : '';
    const roomId = sanitizeRoomId(corpo.roomId || '');
    const token = typeof corpo.roomSessionToken === 'string' ? corpo.roomSessionToken : '';

    if (!roomId) return NextResponse.json({ error: 'roomId richiesto' }, { status: 400 });

    const io = await chiSei(token, roomId);
    if (!io) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });

    switch (azione) {

      // ── Entro nella stanza video e dico chi c'e gia ──
      case 'entra': {
        const stanza = await getRoom(roomId);
        if (!stanza) return NextResponse.json({ error: 'Stanza non trovata' }, { status: 404 });

        await redis('SADD', presenze(roomId), io.name);
        await redis('EXPIRE', presenze(roomId), TTL);
        const dentro = (await redis('SMEMBERS', presenze(roomId))) || [];

        if (dentro.length > MAX_PARTECIPANTI) {
          await redis('SREM', presenze(roomId), io.name);
          return NextResponse.json({
            error: 'stanza piena',
            motivo: `In video si sta in ${MAX_PARTECIPANTI}. Oltre, il telefono di ognuno dovrebbe spedire il proprio video troppe volte.`,
          }, { status: 409 });
        }

        // A chi tocca proporre il collegamento: lo decide l'ordine
        // alfabetico, uguale su tutti i telefoni senza doversi parlare.
        const altri = dentro.filter(n => n.toLowerCase() !== io.name.toLowerCase());
        const devoChiamare = altri.filter(n => io.name.toLowerCase() < n.toLowerCase());

        return NextResponse.json({ ok: true, presenti: dentro, altri, devoChiamare });
      }

      // ── Resto vivo: senza, la presenza scade e spariscono i riquadri ──
      case 'battito': {
        await redis('SADD', presenze(roomId), io.name);
        await redis('EXPIRE', presenze(roomId), TTL);
        const dentro = (await redis('SMEMBERS', presenze(roomId))) || [];
        return NextResponse.json({ ok: true, presenti: dentro });
      }

      case 'esci': {
        await redis('SREM', presenze(roomId), io.name);
        await redis('DEL', cassetta(roomId, io.name));
        return NextResponse.json({ ok: true });
      }

      // ── Un segnale, con un destinatario preciso ──
      case 'manda': {
        const a = sanitizeName(corpo.a || '');
        if (!a) return NextResponse.json({ error: 'destinatario richiesto' }, { status: 400 });
        if (!corpo.segnale) return NextResponse.json({ error: 'segnale richiesto' }, { status: 400 });

        const pacchetto = JSON.stringify({
          da: io.name,
          a,
          tipo: String(corpo.segnale.tipo || '').slice(0, 20),
          dati: typeof corpo.segnale.dati === 'string' ? corpo.segnale.dati.slice(0, 60000) : '',
          quando: Date.now(),
        });
        await redis('RPUSH', cassetta(roomId, a), pacchetto);
        await redis('LTRIM', cassetta(roomId, a), -MAX_IN_CASSETTA, -1);
        await redis('EXPIRE', cassetta(roomId, a), TTL);
        return NextResponse.json({ ok: true });
      }

      // ── Svuoto la mia cassetta: quello che ho letto non lo rileggo ──
      case 'ritira': {
        const chiave = cassetta(roomId, io.name);
        const grezzi = (await redis('LRANGE', chiave, 0, -1)) || [];
        if (grezzi.length) await redis('DEL', chiave);
        const segnali = grezzi
          .map(s => { try { return JSON.parse(s); } catch { return null; } })
          .filter(Boolean);

        await redis('SADD', presenze(roomId), io.name);
        await redis('EXPIRE', presenze(roomId), TTL);
        const dentro = (await redis('SMEMBERS', presenze(roomId))) || [];

        return NextResponse.json({ ok: true, segnali, presenti: dentro, io: io.name });
      }

      default:
        return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
    }
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 240, prefix: 'stanza-video' });
