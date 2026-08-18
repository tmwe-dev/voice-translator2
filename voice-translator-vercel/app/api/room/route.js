import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { verifyRoomSession, getRoom, removeMember } from '../../lib/store.js';
import { sanitizeRoomId, sanitizeName, getClientIP } from '../../lib/validate.js';
import {
  resolveIdentity,
  handleCreate, handleJoin, handleHeartbeat, handleSpeaking,
  handleChangeMode, handleChangeLang, handleCheck,
  handleRaiseHand, handleGrantSpeak
} from '../../lib/roomActions.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('room');

// b.107 — l'unico modo lecito di sapere chi paga: la sessione.
// Restituisce null per gli ospiti non autenticati, che e giusto: una
// stanza senza host registrato non ha un portafoglio a cui attingere.
async function emailDallaSessione(userToken) {
  if (!userToken || typeof userToken !== 'string') return null;
  try {
    const { getSession } = await import('../../lib/users.js');
    const sessione = await getSession(userToken);
    return sessione?.email || null;
  } catch {
    return null;
  }
}

// b.167 — CONFERMATO (audit esterno 15/8): come sopra per hostEmail, ma
// era rimasto aperto sul campo gemello. `hostTier` arrivava da
// `body.hostTier`, cioe da quello che il CLIENT dichiara — non da un
// account verificato. Un client alterato poteva chiedere una stanza
// "TOP PRO" senza mai autenticarsi: senza userToken, emailDallaSessione
// sopra restituisce null, quindi hostEmail resta null (nessun wallet da
// addebitare), ma resolveAuth in apiAuth.js lascia comunque passare gli
// ospiti perche hostTier non e FREE — la chiamata viene pagata dalla
// chiave di piattaforma, senza che nessun account reale ne risponda.
// Ora il livello si ricava dalla sessione, con lo stesso criterio gia
// usato lato client in useAuth.js (chi e loggato non e mai trial → PRO
// come base, TOP PRO solo per gli account business/top_pro): senza una
// sessione valida la stanza e SEMPRE FREE.
async function tierDallaSessione(userToken) {
  if (!userToken || typeof userToken !== 'string') return 'FREE';
  try {
    const { getSession, getUser } = await import('../../lib/users.js');
    const sessione = await getSession(userToken);
    if (!sessione?.email) return 'FREE';
    const utente = await getUser(sessione.email);
    if (!utente) return 'FREE';
    const livelloAccount = utente.tier || utente.subscription_plan || 'free';
    return (livelloAccount === 'business' || livelloAccount === 'top_pro') ? 'TOP PRO' : 'PRO';
  } catch {
    return 'FREE';
  }
}

// ═══════════════════════════════════════════════════════════════
// USCIRE DALLA STANZA (b.247)
//
// CONFERMATO leggendo lo switch qui sotto: /api/room accettava
// create, join, heartbeat, speaking, changeMode, changeLang,
// raiseHand, grantSpeak e check — ma NON esisteva `leave`. Uscire
// era una faccenda tutta del client: `leaveRoom()` in
// useRoomPolling.js azzerava roomSessionTokenRef, roomId e roomInfo
// e basta. Il server non veniva mai avvisato, e `room.members` non
// ha alcuna scadenza per membro (verificato: nessun `lastSeen`,
// nessuna potatura dei membri fermi; l'unica scadenza e la TTL di
// un'ora della stanza intera, per giunta rinnovata a ogni battito
// di chi e rimasto dentro).
//
// Quindi chi usciva restava dentro fino a un'ora:
//   · membri fantasma nell'elenco dei partecipanti;
//   · capienza falsata — lo script Lua di join rifiuta col
//     "La stanza e al completo" contando anche chi se n'e andato;
//   · presenza falsa — `partnerConnected` nasce da
//     `room.members.length >= 2`: l'ultimo rimasto continua a
//     vedere "ospite connesso" con la stanza vuota;
//   · e chi preme Video chiama un fantasma e aspetta una risposta
//     che nessuno puo dare.
//
// `leave` non sostituisce niente: affianca la TTL rendendo
// l'uscita IMMEDIATA invece che ritardata di un'ora.
//
// b.248 — "nessun lastSeen, nessuna potatura" qui sopra descrive il
// mondo di PRIMA: ora ogni battito scrive un lastSeen per membro
// (UPDATE_HEARTBEAT in redisLua.js) e chi resta muto oltre soglia
// viene tolto alla lettura (potaMembriAssenti in store.js), con la
// stessa rimozione atomica di questo leave. `leave` resta la via
// PULITA e immediata; la potatura copre la via SPORCA — rete persa,
// browser morto — che nessun leave puo coprire.
//
// SICUREZZA: stesso identico controllo delle altre azioni protette
// (heartbeat, speaking, changeLang...): l'azione e nell'elenco
// `needsIdentity`, quindi passa da resolveIdentity → resolveRoomIdentity,
// che pretende un roomSessionToken valido PER QUESTA STANZA (il
// confronto session.roomId === roomId) e che chi lo porta sia ancora
// membro (b.170). Un gettone di un'altra stanza, o nessun gettone,
// non basta: senza identita si esce con 401. Il nome dichiarato nel
// corpo non viene mai usato — se bastasse quello, chiunque potrebbe
// far uscire chiunque altro.
//
// LA STANZA CHE SI SVUOTA: non si inventa nulla di nuovo. Ci si
// comporta come gia fa l'unico altro punto che toglie un membro —
// `blocca()` in moderazione.js, che chiama lo stesso removeMember:
// la stanza resta con l'elenco piu corto e la sua TTL di un'ora, e
// se non rientra nessuno scade da sola. Chiudere la stanza qui
// sarebbe un comportamento NUOVO, e butterebbe fuori chi sta
// rientrando in quel momento.
// ═══════════════════════════════════════════════════════════════
async function handleLeave({ roomId, identity }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  // Rimozione ATOMICA: removeMember passa dallo script Lua REMOVE_MEMBER
  // (leggi-modifica-riscrivi in un colpo solo su Redis). Farlo qui con
  // getRoom + filtro + SET perderebbe l'ingresso di chi entra nello
  // stesso istante — il difetto gia visto con l'heartbeat.
  const room = await removeMember(roomId, identity.name);
  // removeMember torna null in due casi innocui: la stanza non c'e piu
  // (scaduta) oppure il nome non era piu fra i membri (uscita doppia,
  // o gia espulso). In tutti e due l'esito voluto e lo stesso — quella
  // persona non e piu dentro — e chi esce non deve mai vedere un errore
  // per un'uscita andata a buon fine.
  return NextResponse.json({
    ok: true,
    uscito: true,
    room: room || null,
    membersCount: Array.isArray(room?.members) ? room.members.length : 0,
  });
}

// POST /api/room - Create, join, or manage a room
async function handlePostRoom(req) {
  try {
    // ── b.106 · qui c'era un SECONDO limitatore sulla STESSA chiave ──
    // withApiGuard (in fondo al file) conta gia su "room:IP" con tetto 420.
    // Questa riga contava di nuovo sulla stessa identica chiave con tetto
    // 60: ogni richiesta valeva DUE gettoni e il tetto vero diventava 30
    // al minuto per indirizzo IP.
    //
    // Il battito della stanza fa 40 richieste al minuto: 429 dopo ventitre
    // secondi di conversazione. E la chiave e per IP, quindi due telefoni
    // sullo stesso WiFi — il caso del bar — se ne dividevano 30.
    //
    // Il commento qui sotto dice che il tetto fu alzato a 420 proprio per
    // questo motivo. Questa riga annullava quella correzione.

    const body = await req.json();
    const action = typeof body.action === 'string' ? body.action : '';
    const roomId = sanitizeRoomId(body.roomId || '');
    const name = sanitizeName(body.name || '');
    const lang = typeof body.lang === 'string' ? body.lang.slice(0, 10) : '';
    const roomSessionToken = typeof body.roomSessionToken === 'string' ? body.roomSessionToken : null;

    // For actions that require identity, resolve once
    // b.247 — `leave` sta in questo elenco apposta: e cosi che si eredita
    // il controllo di sicurezza delle altre azioni protette invece di
    // scriverne uno nuovo (e piu debole) solo per l'uscita.
    const needsIdentity = ['heartbeat', 'speaking', 'changeMode', 'changeLang', 'raiseHand', 'grantSpeak', 'leave'];
    let identity = null;
    if (needsIdentity.includes(action)) {
      identity = await resolveIdentity(roomSessionToken, name, roomId);
    }

    switch (action) {
      case 'create':
        return handleCreate({
          name, lang, mode: body.mode, avatar: body.avatar,
          context: body.context, contextPrompt: body.contextPrompt,
          description: body.description,
          // b.167 — vedi la nota su tierDallaSessione sopra: non piu
          // `body.hostTier` (il client si poteva dichiarare TOP PRO senza
          // conto e senza pagare).
          hostTier: await tierDallaSessione(body.userToken),
          // b.113 — Stanza Diretta: viaggia con la stanza, cosi chi entra
          // dopo lo sa senza doverlo indovinare.
          diretta: body.diretta,
          // b.139-bis — la capienza va scritta sulla stanza alla nascita:
          // e il solo posto da cui la legge lo script che fa entrare.
          maxPartecipanti: body.maxPartecipanti,
          // ── b.107 · l'email di chi paga NON arriva piu dal client ──
          // Prima era `hostEmail: body.hostEmail` e il server si fidava.
          // apiAuth:160 usa quel campo come `billingEmail`, cioe come il
          // portafoglio da cui scalare tutti i consumi della stanza:
          // bastava scriverci l'indirizzo di un altro per farlo pagare
          // al posto proprio.
          //
          // Ora si ricava dalla sessione: si puo far pagare solo se stessi.
          hostEmail: await emailDallaSessione(body.userToken),
        });

      case 'join':
        // b.169 — vedi la nota su verificaSegretoHost in roomActions.js:
        // senza questo campo (o se sbagliato) chi dichiara il nome
        // dell'host rientra come guest, non come host.
        return handleJoin({
          roomId, name, lang, avatar: body.avatar,
          hostSecret: typeof body.hostSecret === 'string' ? body.hostSecret.slice(0, 100) : null,
        });

      case 'heartbeat':
        // b.250 — lingua e avatar servono SOLO alla riammissione del
        // potato vivo (vedi handleHeartbeat): senza, si rientra con 'en'.
        return handleHeartbeat({ roomId, identity, riammissione: {
          token: roomSessionToken, lang,
          avatar: typeof body.avatar === 'string' ? body.avatar.slice(0, 200) : null,
        } });

      case 'speaking':
        return handleSpeaking({
          roomId, identity, speaking: body.speaking,
          liveText: body.liveText, typing: body.typing,
        });

      case 'changeMode':
        return handleChangeMode({ roomId, mode: body.mode, identity });

      case 'changeLang':
        return handleChangeLang({ roomId, lang, identity });

      case 'raiseHand':
        return handleRaiseHand({ roomId, identity, raised: body.raised });

      case 'grantSpeak':
        return handleGrantSpeak({ roomId, identity, targetMember: body.targetMember });

      // b.247 — l'azione che mancava: vedi la nota estesa su handleLeave.
      case 'leave':
        return handleLeave({ roomId, identity });

      case 'check':
        return handleCheck({ roomId });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e) {
    log.error('Room error:', e);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'room', source: 'api' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/room?id=XXX - Get room info
async function handleGetRoom(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const room = await getRoom(id);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // ── b.126 · una scheda pubblica, non l'oggetto interno ──
    //
    // Prima usciva `{ room }` intero, senza alcuna autenticazione. Cioe
    // a chiunque conoscesse il codice: `hostEmail` (l'email di chi paga),
    // `contextPrompt` (le istruzioni date all'AI), `totalCost` (quanto
    // ha speso finora), l'elenco completo dei membri con avatar.
    //
    // Questa rotta serve a due cose legittime: sapere se una stanza
    // esiste ancora (HomeView lo chiede a ogni avvio) e mostrare la
    // scheda prima di entrare. Per tutte e due basta molto meno.
    //
    // Chi e gia dentro vede tutto: ha un gettone per QUESTA stanza.
    const rst = req.headers.get('x-room-session') || '';
    let dentro = false;
    if (rst) {
      const sessione = await verifyRoomSession(rst);
      dentro = !!sessione && String(sessione.roomId || '').toUpperCase() === String(room.id || '').toUpperCase();
    }
    if (dentro) return NextResponse.json({ room });

    return NextResponse.json({
      room: {
        id: room.id,
        host: room.host,
        mode: room.mode,
        description: room.description,
        created: room.created,
        ended: !!room.ended,
        diretta: !!room.diretta,
        hot: !!room.hot,
        roomType: room.roomType,
        suApprovazione: !!room.suApprovazione,
        maxPartecipanti: room.maxPartecipanti,
        // Quanti sono, non chi sono: il numero serve a mostrare
        // "3 partecipanti", i nomi no.
        membersCount: Array.isArray(room.members) ? room.members.length : 0,
        // Le lingue servono a chi entra per sapere che si parlera:
        // sono una proprieta della conversazione, non delle persone.
        langs: Array.isArray(room.members) ? [...new Set(room.members.map((m) => m.lang).filter(Boolean))] : [],
      },
    });
  } catch (e) {
    log.error('Room GET error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'room', action: 'get' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 420/min: il presence fa più POST per ciclo di poll (1,5s) e più tab/persone
// possono condividere lo stesso IP (NAT, famiglie). 120 causava 429 già con 2 tab.
export const POST = withApiGuard(handlePostRoom, { maxRequests: 420, prefix: 'room' });
export const GET = withApiGuard(handleGetRoom, { maxRequests: 420, prefix: 'room' });
