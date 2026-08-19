import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { redis } from '../../lib/redis.js';
import { sanitizeRoomId, sanitizeName } from '../../lib/validate.js';
import { verifyRoomSession, getRoom, eAncoraMembroStanza } from '../../lib/store.js';
import { RITIRA_CASSETTA } from '../../lib/redisLua.js';
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
// una regola che decida da sola.
//
// La prima che avevo scritto era l'ordine alfabetico, e IL COLLAUDO CON
// TRE PERSONE L'HA BOCCIATA: chiamava solo chi aveva il nome "minore",
// quindi entrando in ordine Anna-Bruno-Carla nessuno chiamava nessuno.
// L'errore di fondo: la regola era simmetrica, ma l'informazione no.
// Chi entra sa subito chi c'e gia; chi c'era non sa di chi e arrivato
// finche non ricontrolla.
//
// LA REGOLA GIUSTA E L'ORDINE DI ARRIVO: chiama sempre CHI ARRIVA
// DOPO, verso tutti quelli che ha trovato. Non serve concordare niente,
// non dipende dai nomi, e chi arriva ha gia in mano l'elenco che gli
// serve. Per questo le presenze stanno in un insieme ORDINATO con il
// momento di ingresso, non in un insieme semplice: senza il momento,
// "dopo" non si puo sapere.
// ═══════════════════════════════════════════════════════════════

const TTL = 300;              // i segnali invecchiano in fretta
const MAX_IN_CASSETTA = 60;
const MAX_PARTECIPANTI = 8;   // oltre, ognuno spedisce il video troppe volte

const cassetta = (stanza, nome) => `svideo:${stanza}:${nome.toLowerCase()}`;
const presenze = (stanza) => `svideo:${stanza}:presenti`;
// ═══ b.292 — IL PALCO: chi ha la parola nella stanza di gruppo ═══
// Regole di Luca: DUE posti di parola (come una chiamata a due), gli
// altri in coda. Quando un posto si libera, il PROSSIMO in coda viene
// AVVERTITO e ha un'offerta a scadenza: o la consuma ("Parlo") entro i
// secondi previsti, o il turno passa da solo al successivo — e se non
// c'e nessuno in coda, il posto resta libero per chiunque. Chi parla
// puo CHIUDERE il proprio intervento e passare la palla.
const chiavePalco = (stanza) => `svideo:${stanza}:palco`;
const MAX_POSTI = 2;
const OFFERTA_MS = 10000;   // dieci secondi per prendere la parola offerta

async function leggiPalco(roomId) {
  try { const v = JSON.parse(await redis('GET', chiavePalco(roomId)) || 'null'); if (v) return v; } catch { /* palco illeggibile: se ne apre uno nuovo vuoto */ }
  return { posti: [], coda: [], offerta: null };
}
async function salvaPalco(roomId, palco) {
  await redis('SET', chiavePalco(roomId), JSON.stringify(palco));
  await redis('EXPIRE', chiavePalco(roomId), TTL);
}
/** Fa rispettare le regole del tempo: via chi non c'e piu, offerte scadute al prossimo. */
function normalizzaPalco(palco, presenti) {
  const vivi = new Set(presenti.map(n => n.toLowerCase()));
  palco.posti = palco.posti.filter(n => vivi.has(n.toLowerCase()));
  palco.coda = palco.coda.filter(n => vivi.has(n.toLowerCase()));
  if (palco.offerta && !vivi.has(palco.offerta.nome.toLowerCase())) palco.offerta = null;
  // offerta scaduta o mancante con posti liberi: si passa al prossimo
  while (!palco.offerta || palco.offerta.scade <= Date.now()) {
    if (palco.offerta) palco.offerta = null;             // scaduta: il turno passa
    if (palco.posti.length >= MAX_POSTI) break;          // pieno: niente offerte
    const prossimo = palco.coda.shift();
    if (!prossimo) break;                                 // coda vuota: posto libero per chi lo chiede
    palco.offerta = { nome: prossimo, scade: Date.now() + OFFERTA_MS };
  }
  return palco;
}
const battiti = (stanza) => `svideo:${stanza}:battiti`;

// b.248 — sei battiti persi (il client batte ogni 5 secondi): non c'e piu.
const SOGLIA_ASSENZA = 30_000;

// b.248 — l'audit segnalava "lo score non si aggiorna col battito".
// Vero a meta: il momento di INGRESSO resta fermo DI PROPOSITO, perche
// regge la regola chi-chiama-chi (vedi il commento in 'battito'). Il
// difetto REALE era che nessuno misurava chi fosse ancora VIVO: chi
// chiudeva la scheda senza salutare restava fra i presenti finche
// qualcun altro teneva viva la chiave — riquadri fantasma, e "stanza
// piena" contando gente che non c'era piu. La cura: un secondo insieme
// ordinato con l'ULTIMO SEGNO DI VITA (aggiornato a ogni battito), e
// questa potatura di chi non batte da troppo. L'ordine di arrivo non
// si tocca.
async function potaAssenti(roomId) {
  const limite = Date.now() - SOGLIA_ASSENZA;
  const spariti = (await redis('ZRANGEBYSCORE', battiti(roomId), 0, limite)) || [];
  for (const nome of spariti) {
    await redis('ZREM', presenze(roomId), nome);
    await redis('ZREM', battiti(roomId), nome);
    await redis('DEL', cassetta(roomId, nome));
  }
}

async function chiSei(token, roomId) {
  if (!token) return null;
  const s = await verifyRoomSession(token);
  if (!s) return null;
  if (s.roomId && roomId && s.roomId.toUpperCase() !== roomId.toUpperCase()) return null;
  // b.170 — CONFERMATO (audit esterno 15/8): questa era una delle
  // capability che accettava un gettone valido per la stanza senza
  // ricontrollare l'appartenenza CORRENTE. Chi veniva bloccato (tolto
  // da room.members) restava in grado di entrare in video, farsi vedere
  // e vedere gli altri col vecchio gettone fino a scadenza. Ora si
  // verifica che sia ancora membro, con la stessa funzione usata dalle
  // rotte a pagamento (resolveRoomIdentity → eAncoraMembroStanza).
  if (!(await eAncoraMembroStanza(roomId, s.name))) return null;
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

        // b.248 — prima di contare chi c'e si potano gli assenti: senza,
        // un fantasma occupava un posto vero e la stanza risultava piena.
        await potaAssenti(roomId);

        // Chi c'era PRIMA di me: si legge prima di aggiungersi, altrimenti
        // ci si troverebbe dentro il proprio nome.
        const prima = (await redis('ZRANGE', presenze(roomId), 0, -1)) || [];
        const giaDentro = prima.filter(n => n.toLowerCase() !== io.name.toLowerCase());

        if (giaDentro.length >= MAX_PARTECIPANTI) {
          return NextResponse.json({
            error: 'stanza piena',
            motivo: `In video si sta in ${MAX_PARTECIPANTI}. Oltre, il telefono di ognuno dovrebbe spedire il proprio video troppe volte.`,
          }, { status: 409 });
        }

        await redis('ZADD', presenze(roomId), Date.now(), io.name);
        // b.248 — e da subito anche il segno di vita: chi entra e vivo.
        await redis('ZADD', battiti(roomId), Date.now(), io.name);
        await redis('EXPIRE', presenze(roomId), TTL);
        await redis('EXPIRE', battiti(roomId), TTL);

        // Chiamo TUTTI quelli che ho trovato. Sono arrivato dopo: tocca a me.
        return NextResponse.json({
          ok: true,
          presenti: [...giaDentro, io.name],
          altri: giaDentro,
          devoChiamare: giaDentro,
        });
      }

      // ── Resto vivo: senza, la presenza scade e spariscono i riquadri ──
      case 'battito': {
        // Il momento di ingresso NON si aggiorna: chi e arrivato prima
        // deve restare "prima" anche dopo mille battiti, altrimenti
        // l'ordine si mescola e due persone si richiamano a vicenda.
        const mio = await redis('ZSCORE', presenze(roomId), io.name);
        if (!mio) await redis('ZADD', presenze(roomId), Date.now(), io.name);
        // b.248 — l'ingresso resta fermo, ma l'ultimo SEGNO DI VITA si
        // aggiorna a ogni battito, in un insieme separato. E chi non
        // batte da troppo viene potato: e questo che fa sparire i
        // riquadri fantasma di chi ha chiuso la scheda senza salutare.
        await redis('ZADD', battiti(roomId), Date.now(), io.name);
        await potaAssenti(roomId);
        await redis('EXPIRE', presenze(roomId), TTL);
        await redis('EXPIRE', battiti(roomId), TTL);

        const dentro = (await redis('ZRANGE', presenze(roomId), 0, -1)) || [];
        const arrivatiPrimaDiMe = [];
        const i = dentro.findIndex(n => n.toLowerCase() === io.name.toLowerCase());
        if (i > 0) arrivatiPrimaDiMe.push(...dentro.slice(0, i));

        const palco = normalizzaPalco(await leggiPalco(roomId), dentro);
        await salvaPalco(roomId, palco);
        return NextResponse.json({ ok: true, presenti: dentro, arrivatiPrimaDiMe, palco });
      }

      // ── Il palco: chiedo, prendo, chiudo, rinuncio ──
      case 'palco': {
        const presenti = (await redis('ZRANGE', presenze(roomId), 0, -1)) || [];
        const palco = normalizzaPalco(await leggiPalco(roomId), presenti);
        const mossa = String(corpo.mossa || 'stato');
        const me = io.name;
        const sono = (n) => n.toLowerCase() === me.toLowerCase();

        if (mossa === 'chiedi' && !palco.posti.some(sono)) {
          if (palco.posti.length < MAX_POSTI && !palco.coda.length && !palco.offerta) {
            palco.posti.push(me);                          // posto libero: parola presa subito
          } else if (!palco.coda.some(sono) && !(palco.offerta && sono(palco.offerta.nome))) {
            palco.coda.push(me);
          }
        }
        if (mossa === 'prendo' && palco.offerta && sono(palco.offerta.nome) && palco.offerta.scade > Date.now()) {
          palco.offerta = null;
          if (palco.posti.length < MAX_POSTI && !palco.posti.some(sono)) palco.posti.push(me);
        }
        if (mossa === 'chiudo') {
          palco.posti = palco.posti.filter(n => !sono(n));  // ho finito: passo la palla
        }
        if (mossa === 'rinuncia') {
          palco.coda = palco.coda.filter(n => !sono(n));
          if (palco.offerta && sono(palco.offerta.nome)) palco.offerta = null;
        }
        normalizzaPalco(palco, presenti);
        await salvaPalco(roomId, palco);
        return NextResponse.json({ ok: true, palco });
      }

      case 'esci': {
        // b.292 — uscendo si lascia anche il palco: il posto va al prossimo.
        {
          const presenti = ((await redis('ZRANGE', presenze(roomId), 0, -1)) || []).filter(n => n.toLowerCase() !== io.name.toLowerCase());
          const palco = normalizzaPalco(await leggiPalco(roomId), presenti);
          await salvaPalco(roomId, palco);
        }
        await redis('ZREM', presenze(roomId), io.name);
        // b.248 — via anche il segno di vita: senza, il nome rientrerebbe
        // nella finestra dei "vivi" fino alla soglia di assenza.
        await redis('ZREM', battiti(roomId), io.name);
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
        // b.248 — CONFERMATO (audit esterno): qui c'erano DUE comandi
        // separati, LRANGE e poi DEL. Un candidato ICE arrivato NEL
        // MEZZO veniva cancellato senza essere mai stato letto: video
        // che ogni tanto non partiva, impossibile da riprodurre perche
        // la finestra e di pochi millisecondi. Ora lettura e svuotamento
        // sono UNO script Lua, cioe un comando solo: un segnale o arriva
        // prima (e si legge) o arriva dopo (e aspetta il giro seguente).
        const grezzi = (await redis('EVAL', RITIRA_CASSETTA, 1, chiave)) || [];
        const segnali = grezzi
          .map(s => { try { return JSON.parse(s); } catch { return null; } })
          .filter(Boolean);

        await redis('EXPIRE', presenze(roomId), TTL);
        const dentro = (await redis('ZRANGE', presenze(roomId), 0, -1)) || [];

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
