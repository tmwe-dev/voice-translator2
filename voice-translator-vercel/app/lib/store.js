// Upstash Redis store for rooms, messages, and conversation history
// Uses shared Redis client from redis.js
// All read-modify-write operations use Lua scripts for atomicity (no race conditions)

import { createLogger } from './logger.js';
import { redis } from './redis.js';
import { normalizzaCapienza, normalizzaTipoStanza } from './decisioni.js';
import { randomUUID, randomBytes } from 'crypto';
import { safeCompare } from './apiGuard.js';

const log = createLogger('store');
import {
  JOIN_ROOM, SET_SPEAKING, ADD_COST, UPDATE_ROOM_MODE, AGGIORNA_POLITICA_PUBBLICA,
  CHANGE_MEMBER_LANG, SET_HAND_RAISED, GRANT_SPEAKING, REMOVE_MEMBER,
  UPDATE_HEARTBEAT, UPDATE_MESSAGE, ADD_MESSAGE, UPDATE_CONV_SUMMARY
} from './redisLua.js';

// =============================================
// ROOM SESSION TOKENS — server-verified identity
// Replaces trust-the-client name-based identity
// =============================================

/**
 * Create a room session token for a member.
 * Called on room create and join. Token proves identity for all room operations.
 * @returns {{ token: string }} The session token
 */
export async function createRoomSession(roomId, memberName, role) {
  const token = randomUUID();
  const session = { roomId: roomId.toUpperCase(), name: memberName, role, created: Date.now() };
  // 24 hour TTL for room sessions
  await redis('SET', `rsess:${token}`, JSON.stringify(session), 'EX', 86400);
  return { token };
}

/**
 * Verify a room session token. Returns the session data or null.
 * @returns {{ roomId: string, name: string, role: string, created: number } | null}
 */
export async function verifyRoomSession(token) {
  if (!token || typeof token !== 'string') return null;
  const data = await redis('GET', `rsess:${token}`);
  if (!data) return null;
  let parsed; try { parsed = JSON.parse(data); } catch (e) { log.warn('Failed to parse room session:', e.message); return null; } return parsed;
}

/**
 * Resolve identity from request: REQUIRES valid room session token.
 * Name-only fallback has been REMOVED (security: prevents impersonation).
 * @param {string} token - Room session token (from header or body)
 * @param {string} name - Ignored (kept for API compat, not used)
 * @param {string} roomId - Expected room ID
 * @returns {{ name: string, role: string, verified: boolean } | null}
 */
export async function resolveRoomIdentity(token, name, roomId) {
  if (!token) return null;
  const session = await verifyRoomSession(token);
  if (session && session.roomId === roomId.toUpperCase()) {
    // b.170 — CONFERMATO (audit esterno 15/8): il gettone di stanza
    // (rsess:*) e una chiave Redis a se, con vita propria (24h). Quando
    // l'host BLOCCA qualcuno (moderazione.js/blocca → removeMember,
    // b.167), la persona sparisce da room.members ma il suo gettone
    // resta valido fino a scadenza: qualunque capability che verificava
    // solo "gettone valido per questa stanza" continuava ad accettarlo —
    // l'espulsione toglieva dalla lista ma non dalla porta. Ora
    // l'identita di stanza vale solo se chi la porta e' ANCORA membro
    // (non bloccato). Un'unica funzione, cosi la stessa regola vale per
    // ogni consumatore invece di essere ricopiata (e dimenticata) rotta
    // per rotta.
    //
    // b.589 — TENTATO E RITIRATO: ho provato a generalizzare qui la
    // riammissione di b.250 (sotto) a QUALUNQUE azione protetta, per
    // abbattere il 68% di 401 live su /api/room causato da chi viene
    // "potato" per silenzio (schermo spento) e poi chiama qualcosa di
    // diverso dall'heartbeat. La suite completa ha bocciato il
    // tentativo: __tests__/lib/sessionTokens.test.js protegge
    // esplicitamente un P1 dell'audit esterno del 15/8 ("un gettone
    // valido di chi e' stato ESPULSO non deve piu autorizzare nulla")
    // con uno scenario indistinguibile, a livello di dati, da un
    // "potato per silenzio": token valido, non in blacklist, ma tolto
    // da room.members. Il sistema oggi non ha modo di separare le due
    // situazioni — servirebbe un segnale in piu (es. una soglia sul
    // lastSeen, o un flag esplicito scritto da chi espelle) prima di
    // poter estendere la riammissione in sicurezza oltre l'heartbeat.
    // Non e' una scelta che si fa da soli: il 68% di 401 resta
    // diagnosticato ma NON corretto in questo giro — vedi CLAUDE.md.
    if (!(await eAncoraMembroStanza(roomId, session.name))) return null;
    return { name: session.name, role: session.role, verified: true };
  }
  return null;
}

// ═══ INIZIO b.250 — la riammissione del potato vivo ═══
// TROVATO DAL COLLAUDO DAL VIVO (telefono di Luca, log Vercel): con lo
// schermo spento il browser rallenta i timer fino a ~1 battito al minuto.
// La potatura b.248 (60s) espelleva quindi un membro VIVO; da quel
// momento resolveRoomIdentity rispondeva null (non e piu membro) e OGNI
// battito e OGNI lettura messaggi era 401 — per sempre, in silenzio:
// il telefono continuava a interrogare ogni 18s e non riceveva piu ne
// messaggi ne traduzioni. E il "non arriva il testo tradotto" visto dal vivo.
//
// La cura: chi si presenta con un GETTONE ANCORA VALIDO per questa
// stanza e NON e bloccato non e un intruso, e un potato per errore.
// Lo si riammette con lo stesso join atomico di sempre. Un bloccato
// resta fuori: la potatura non e un blocco, ma il blocco resta blocco.
export async function riammettiConGettone(roomId, token, lang, avatar) {
  if (!token || typeof token !== 'string') return null;
  const session = await verifyRoomSession(token);
  if (!session || session.roomId !== roomId.toUpperCase()) return null;
  try {
    const { eBloccato } = await import('./moderazione.js');
    if (await eBloccato(roomId, session.name)) return null;
  } catch (e) {
    // fallimento del controllo blocchi: si nega la riammissione (chiusa),
    // il giro dopo si riprova. Meglio un battito perso che un bloccato dentro.
    log.warn('controllo blocco non riuscito in riammissione:', e.message);
    return null;
  }
  // b.526 — identita provata dal gettone: mai il suffisso omonimi.
  const esito = await joinRoom(roomId, session.name, lang || 'en', avatar || null, { fidato: true });
  if (!esito || esito.piena) return null;
  return { name: session.name, role: session.role, verified: true, riammesso: true };
}
// ═══ FINE b.250 ═══

// b.170 — "e' ancora dentro questa stanza?" — la domanda che separa
// avere un gettone valido dall'essere ancora un membro. Import dinamico
// di moderazione.js (eBloccato) per lo stesso motivo documentato in
// blocca(): store.js viene caricato presto e non deve dipendere da
// moderazione al caricamento del modulo.
//
// b.171-bis — CORRETTO (regressione introdotta da b.170, trovata dal
// vivo): la versione precedente FALLIVA CHIUSA su qualunque intoppo —
// errore Redis o stanza non trovata → accesso negato. Ma:
//   · la stanza ha TTL 1h, il gettone di sessione 24h;
//   · espellere qualcuno toglie da room.members ma NON cancella la stanza.
// Quindi "stanza assente" NON prova un'espulsione: prova solo che la
// stanza e scaduta/sfrattata o che Redis ha avuto un intoppo. Fallire
// chiuso li trasformava ogni blip di Redis (visto nei log: circuit OPEN
// su Upstash) e ogni stanza inattiva in "sei fuori", facendo cadere
// heartbeat, identita di stanza e VIDEO CALL per utenti perfettamente
// legittimi — la classe di bug "le stanze sparivano".
//
// Regola corretta: si NEGA solo con una PROVA POSITIVA di non
// appartenenza — la stanza ESISTE e il nome non e tra i suoi membri, o
// il nome risulta bloccato. Quando non si puo provare il contrario
// (stanza assente, Redis giu), si resta dentro col gettone valido, come
// prima di b.170. L'obiettivo di sicurezza resta intatto: chi viene
// espulso trova una stanza che ESISTE senza il suo nome → negato; la
// finestra riaperta (un espulso mentre Redis e giu) e minima e in quel
// momento non c'e comunque nulla da abusare.
export async function eAncoraMembroStanza(roomId, nome) {
  if (!nome) return false;
  try {
    const { eBloccato } = await import('./moderazione.js');
    if (await eBloccato(roomId, nome)) return false;
    const room = await getRoom(roomId);
    // Nessuna prova contraria (stanza scaduta/sfrattata): si resta dentro.
    if (!room || !Array.isArray(room.members)) return true;
    const n = String(nome).toLowerCase();
    return room.members.some((m) => String(m.name || '').toLowerCase() === n);
  } catch {
    // Redis irraggiungibile: non e una prova di espulsione. Fail-OPEN,
    // come prima di b.170: un guasto infrastrutturale non deve buttare
    // fuori chi ha un gettone valido (e con esso la sua video call).
    return true;
  }
}

// b.169 — CONFERMATO (audit esterno 15/8, P0-3): chi (ri)entra in una
// stanza con `join` dichiara solo il proprio NOME. Lo script Lua di
// join aggiorna lingua/avatar del membro esistente ma non tocca mai il
// suo `role` in room.members — e prima handleJoin, sotto, chiedeva a
// `ruoloDi(room, name)` che ruolo dare al NUOVO gettone di sessione e
// si fidava alla lettera: chiunque scrivesse lo stesso nome dell'host
// (vedendolo scritto in stanza, per esempio) si ritrovava con un
// gettone da host, senza aver mai dimostrato di essere la stessa
// persona che aveva creato la stanza.
//
// Serve un rientro per l'host vero: se ricarica la pagina perde
// roomSessionTokenRef (vive solo in memoria, non su disco) e l'unico
// modo per tornare dentro e proprio `join` con il proprio nome — e lo
// stesso vale per "rientra" dall'elenco delle stanze lasciate a meta
// (rejoinRoom in page.js). Non si puo quindi vietare del tutto il
// rientro come host via `join`: si puo pero smettere di fidarsi del
// solo nome.
//
// Un secondo segreto, generato SOLO alla creazione della stanza e
// restituito SOLO nella risposta di quella chiamata (mai dentro
// l'oggetto `room`, che /api/room GET restituisce per intero a
// chiunque sia dentro la stanza — mai leggibile dagli altri membri).
// Chi lo presenta a `join` insieme al nome dell'host prova di essere
// lo stesso browser che ha creato la stanza; chi non lo presenta (o lo
// sbaglia) resta guest, anche scrivendo il nome giusto. Stessa idea
// gia usata per la revoca in TaxiTalk (route.js, b.168): un secondo
// segreto che non gira mai per i canali che tutti possono leggere.
//
// Effetto collaterale dichiarato: un host che perde il segreto (nuovo
// dispositivo, cache svuotata) NON puo piu rientrare come host da
// solo — diventa guest, come chiunque altro. E la stessa scelta che si
// farebbe per qualsiasi credenziale persa: non e un difetto, e il
// prezzo di chiudere davvero il buco.
export async function creaSegretoHost(roomId) {
  const secret = randomUUID();
  // Stessa TTL della stanza (createRoom, sotto): non ha senso che il
  // segreto sopravviva alla stanza a cui appartiene, ne che scada prima
  // mentre la stanza e ancora viva (vedi il refresh in updateHeartbeat).
  await redis('SET', `roomhost:${roomId.toUpperCase()}`, secret, 'EX', 3600);
  return secret;
}

export async function verificaSegretoHost(roomId, secret) {
  if (!secret || typeof secret !== 'string') return false;
  const salvato = await redis('GET', `roomhost:${roomId.toUpperCase()}`);
  if (!salvato) return false;
  return safeCompare(secret, salvato);
}

// =============================================
// ROOMS
// =============================================

export async function createRoom(creatorName, creatorLang, mode = 'conversation', avatar = null, context = null, contextPrompt = null, description = null, hostTier = 'FREE', hostEmail = null, diretta = false, maxPartecipanti = null, ognunoPagaIlSuo = false) {
  const id = randomBytes(4).toString('hex').toUpperCase();
  const room = {
    id,
    created: Date.now(),
    mode,
    host: creatorName,
    hostTier: hostTier, // FREE, PRO, or TOP PRO - guests inherit this
    hostEmail: hostEmail || null, // for billing guest usage to host
    members: [{ name: creatorName, lang: creatorLang, joined: Date.now(), role: 'host', avatar }],
    context: context || 'general',
    contextPrompt: contextPrompt || '',
    description: description || '',
    totalCost: 0,
    msgCount: 0,
    // b.113 — Stanza Diretta: la scelta la fa l'host, ma DEVE viaggiare
    // con la stanza. Chi entra dopo, da un invito o dalla vetrina, non
    // ha modo di saperlo altrimenti: si ritroverebbe in una stanza
    // senza traduzione senza capire perche, oppure — molto peggio —
    // continuerebbe a mandare la propria voce alla nuvola credendo di
    // essere in una conversazione riservata.
    diretta: !!diretta,
    // b.289 — la scelta dell'host abbonato: false (default) = offre lui
    // la traduzione agli invitati, com'e sempre stato; true = ognuno
    // paga il suo, e gli ospiti senza conto vanno a tariffa gratuita.
    ognunoPagaIlSuo: !!ognunoPagaIlSuo,
    // ── b.139-bis · IL TETTO SI SCRIVE ALLA NASCITA ──
    //
    // Non veniva scritto affatto. L'unico punto che lo metteva sulla
    // stanza era `aggiornaPoliticaPubblica`, chiamata solo da /api/mondo:
    // cioe SOLO per le stanze pubblicate in vetrina. In una stanza
    // privata il campo restava assente e il tetto vero diventava il
    // ripiego dello script Lua — che valeva DIECI, mentre il modulo di
    // creazione ne aveva promessi venti e disegnato i bottoni fino a 50.
    //
    // L'undicesimo si sentiva dire "La stanza e al completo" in una
    // stanza creata per venti, senza che nessuno dei due potesse capire
    // perche. Ora il numero c'e da subito, e viene dalla stessa
    // funzione che usa la vetrina.
    maxPartecipanti: normalizzaCapienza(maxPartecipanti, { diretta: !!diretta }),
    ended: false
  };
  await redis('SET', `room:${id}`, JSON.stringify(room), 'EX', 3600); // 1 hour TTL (privacy-first)
  return room;
}

export async function getRoom(id) {
  if (!id) return null;
  const data = await redis('GET', `room:${id.toUpperCase()}`);
  if (!data) return null;
  let parsed; try { parsed = JSON.parse(data); } catch (e) { log.warn('Failed to parse room:', e.message); return null; } return parsed;
}

export async function joinRoom(id, name, lang, avatar = null, opzioni = {}) {
  const key = `room:${id.toUpperCase()}`;
  // b.526 — vedi JOIN_ROOM in redisLua.js: la soglia di presenza decide
  // se un omonimo e una riconnessione (stantio: riprende il suo posto) o
  // un'ALTRA persona (vivo: suffisso). `fidato` = identita gia provata
  // da un gettone (riammissione b.250): niente suffisso, e' lui.
  const result = await redis('EVAL', JOIN_ROOM, 1, key, name, lang, avatar || '', Date.now().toString(),
    String(opzioni.sogliaMs || SOGLIA_PRESENZA_MS), opzioni.fidato ? '1' : '0');
  if (!result) return null;
  // b.126 — la stanza piena ora si dichiara, invece di far fuori qualcuno
  // per fare posto. Chi chiama deve poterlo distinguere da "non esiste".
  if (result === 'PIENA') return { piena: true };
  try {
    const esito = JSON.parse(result);
    // b.526 — nuovo contratto {stanza, nome}; il vecchio (la stanza nuda)
    // resta accettato per non rompere niente durante un deploy misto.
    if (esito && esito.stanza) {
      const room = esito.stanza;
      room.nomeAssegnato = esito.nome || name;
      return room;
    }
    return esito;
  } catch (e) { log.warn('Failed to parse joinRoom result:', e.message); return null; }
}

export async function setSpeaking(roomId, memberName, speaking, liveText = null, typing = false) {
  const key = `room:${roomId.toUpperCase()}`;
  const now = Date.now().toString();
  const result = await redis('EVAL', SET_SPEAKING, 1, key,
    memberName, speaking ? '1' : '0', liveText || '', typing ? '1' : '0', now, liveText !== null ? '1' : '0');
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse setSpeaking result:', e.message); return null; }
}

// ═══════════════════════════════════════════════════════════════
// b.248 — LA PRESENZA E DI OGNUNO, NON DELLA STANZA (P1, confermato
// da due audit).
//
// Prima il battito rinnovava la TTL della stanza INTERA e basta:
// nessun timestamp del singolo membro veniva mai scritto. E il client
// (useRoomPolling.js) deriva `partnerConnected` da
// `room.members.length >= 2`. L'uscita PULITA e coperta dal leave di
// b.247, ma se l'ospite perde la rete o il browser muore nessun leave
// parte: restava in members finche la stanza viveva — anche ore, visto
// che il battito dell'altro rinnovava la TTL — e l'ultimo rimasto
// vedeva "ospite connesso" con la stanza vuota. Premeva Video e il
// segnale non lo riceveva nessuno.
//
// LA SOGLIA: il battito del client (useRoomPolling.js) e ogni 1,5s
// senza Realtime, 3s con Realtime, e a schermo spento rallenta di 6
// volte (FRENO_A_SCHERMO_SPENTO) → il battito legittimo piu lento e
// 18s. Sessanta secondi sono ~3,3 battiti mancati al ritmo piu lento:
// abbastanza da non potare un telefono vivo ma in tasca (o un blip di
// rete), abbastanza poco da far sparire un fantasma entro il minuto.
// ═══════════════════════════════════════════════════════════════
export const SOGLIA_PRESENZA_MS = 60 * 1000;

/**
 * Toglie dalla stanza i membri muti oltre soglia. Chiamata alla lettura
 * (heartbeat, e check in roomActions.js): non c'e un demone, e chi legge
 * che fa pulizia — come per la TTL della stanza stessa.
 *
 * Regole, nell'ordine in cui contano:
 *   · si giudica SOLO su `lastSeen` scritto dal server (UPDATE_HEARTBEAT
 *     / JOIN_ROOM): mai l'orologio del client, mai `joined` come
 *     ripiego — un membro di una stanza nata prima di b.248 avrebbe un
 *     joined di ore fa e verrebbe potato al primo giro;
 *   · chi NON ha il campo non si pota MAI qui: e la grazia iniziale —
 *     UPDATE_HEARTBEAT gli stampa lastSeen=adesso al primo giro, e da
 *     li ha davanti una soglia intera;
 *   · l'HOST non si pota mai: la sua voce in members e cio su cui
 *     ruoloDi() decide al suo rientro (b.169) — potato per un
 *     inciampo di rete, nemmeno il segreto host gli ridarebbe il ruolo;
 *   · la rimozione e la STESSA del leave b.247 e di blocca() (b.167):
 *     removeMember → script Lua REMOVE_MEMBER, atomico. Non un secondo
 *     meccanismo che un giorno divergerebbe dal primo.
 *
 * Un errore qui non deve MAI rompere la lettura: al peggio il fantasma
 * resta un giro in piu.
 */
export async function potaMembriAssenti(roomId, room, adesso = Date.now()) {
  if (!room || !Array.isArray(room.members)) return room;
  try {
    const assenti = room.members.filter((m) =>
      m &&
      m.role !== 'host' && m.name !== room.host &&
      typeof m.lastSeen === 'number' &&
      adesso - m.lastSeen > SOGLIA_PRESENZA_MS
    );
    if (assenti.length === 0) return room;
    let aggiornata = room;
    for (const fantasma of assenti) {
      const dopo = await removeMember(roomId, fantasma.name);
      // null = gia sparito da solo (o stanza scaduta): l'esito voluto
      // c'e comunque, si tiene l'ultima fotografia buona.
      if (dopo) aggiornata = dopo;
    }
    return aggiornata;
  } catch (e) {
    log.warn('potatura presenza non riuscita:', e.message);
    return room;
  }
}

export async function updateHeartbeat(roomId, memberName) {
  const key = `room:${roomId.toUpperCase()}`;
  // b.248 — prima qui c'era un battito "di sola lettura" (GET + EXPIRE):
  // la nota diceva, giustamente, che un GET+SET in JavaScript avrebbe
  // schiacciato il join di chi entrava nello stesso istante. La ragione
  // resta valida per il leggi-modifica-riscrivi FUORI da Redis; lo
  // script Lua invece gira atomico come tutti gli altri di redisLua.js,
  // quindi puo scrivere `lastSeen` del battente senza perdere nessuno.
  const result = await redis('EVAL', UPDATE_HEARTBEAT, 1, key, memberName, Date.now().toString());
  if (!result) return null;
  let room; try { room = JSON.parse(result); } catch (e) { log.warn('Failed to parse room in updateHeartbeat:', e.message); return null; }
  // b.169 — il segreto host (creaSegretoHost, sopra) ha la stessa TTL
  // iniziale della stanza: senza questo refresh scadrebbe un'ora dopo
  // la creazione anche se la stanza (e l'host dentro) e ancora viva.
  // EXPIRE su una chiave assente non fa nulla (nessun errore): innocuo
  // per le stanze create prima di questa versione, che non ce l'hanno.
  await redis('EXPIRE', `roomhost:${roomId.toUpperCase()}`, 3600);
  // b.248 — la potatura avviene DOPO la stampa del lastSeen: chi batte
  // adesso non puo mai risultare muto, e la fotografia restituita al
  // client e gia senza fantasmi (e da questa che nasce partnerConnected).
  return potaMembriAssenti(roomId, room);
}

export async function addCost(roomId, amount) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', ADD_COST, 1, key, amount.toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse addCost result:', e.message); return null; }
}

export async function updateRoomMode(roomId, newMode) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', UPDATE_ROOM_MODE, 1, key, newMode);
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse updateRoomMode result:', e.message); return null; }
}

// b.167 — CONFERMATO (audit esterno 15/8): "blocca" scriveva solo in
// blacklist (impedisce l'ingresso FUTURO) ma non toccava chi era GIA'
// dentro — restava con un roomSessionToken valido e piena capability
// finche non scadeva da solo. Chiamata da blocca() in moderazione.js,
// SOLO quando chi blocca puo moderare (stesso controllo gia in vigore
// li). Se il nome non e (piu) fra i membri non e un errore: nessun
// utente da buttare fuori, l'esito e comunque "bloccato".
export async function removeMember(roomId, name) {
  if (!roomId || !name) return null;
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', REMOVE_MEMBER, 1, key, name);
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse removeMember result:', e.message); return null; }
}

// ═══════════════════════════════════════════════════════════════
// LA POLITICA PUBBLICA VIVE SULLA STANZA (b.125)
//
// Prima `hot`, `roomType`, `maxPartecipanti` e `suApprovazione`
// stavano solo nella voce della vetrina (/api/mondo) e, in parte,
// nelle regole di moderazione. La stanza vera non li conosceva.
//
// Ma MessageList decide se velare le parole pesanti cosi:
//
//     <ForseVelato hot={!!roomInfo?.hot} ...>
//
// e `roomInfo` E la stanza. Quindi leggeva sempre `undefined`, il velo
// si applicava sempre, e le stanze "litigio libero" non lo sono mai
// state — pur essendo la casella nella UI, il campo nel database della
// vetrina e la regola di moderazione tutti al loro posto.
//
// Tre sistemi che descrivono la stessa stanza, e quello che l'utente
// guarda non parla con quello che l'utente ha scelto.
//
// Qui la politica torna dove serve leggerla. Non risolve tutta
// l'ambiguita — la vetrina tiene ancora una sua copia per l'elenco —
// ma toglie il disallineamento sul campo che decide cosa si vede.
// ═══════════════════════════════════════════════════════════════
export async function aggiornaPoliticaPubblica(roomId, { hot, roomType, maxPartecipanti, suApprovazione }) {
  if (!roomId) return null;
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', AGGIORNA_POLITICA_PUBBLICA, 1, key,
    hot ? '1' : '0',
    normalizzaTipoStanza(roomType),
    String(normalizzaCapienza(maxPartecipanti)),
    suApprovazione ? '1' : '0');
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('politica pubblica non rileggibile:', e.message); return null; }
}

export async function changeMemberLang(roomId, memberName, newLang) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', CHANGE_MEMBER_LANG, 1, key, memberName, newLang, Date.now().toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse changeMemberLang result:', e.message); return null; }
}

// =============================================
// CLASSROOM MODE — Hand Raise & Grant Speaking
// =============================================

/**
 * Toggle hand raised state for a member (classroom mode).
 * @param {string} roomId
 * @param {string} memberName
 * @param {boolean} raised
 * @returns {object|null} Updated room
 */
export async function setHandRaised(roomId, memberName, raised) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', SET_HAND_RAISED, 1, key, memberName, raised ? '1' : '0', Date.now().toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse setHandRaised result:', e.message); return null; }
}

/**
 * Host grants speaking permission to a member (classroom mode).
 * Automatically lowers all other hands and sets the granted member as speaking.
 * @param {string} roomId
 * @param {string} memberName - Member to grant speaking
 * @returns {object|null} Updated room
 */
export async function grantSpeaking(roomId, memberName) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', GRANT_SPEAKING, 1, key, memberName, Date.now().toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse grantSpeaking result:', e.message); return null; }
}

// =============================================
// MESSAGES
// =============================================

export async function addMessage(roomId, msg) {
  const id = roomId.toUpperCase();
  const now = Date.now();
  const msgId = now.toString(36) + randomBytes(3).toString('hex');
  const msgJson = JSON.stringify(msg);
  const result = await redis('EVAL', ADD_MESSAGE, 2, `room:${id}`, `msgs:${id}`, msgJson, msgId, now.toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse addMessage result:', e.message); return null; }
}

/**
 * Update an existing message with translation data (Phase 2 of two-phase send).
 * Finds message by sender + original text, updates translated/targetLang/translations.
 */
// b.126 — `messageId` e il modo giusto di dire QUALE messaggio. `sender`
// e `original` restano come ripiego per i client vecchi, che non lo
// mandano ancora: senza, la fase 2 delle loro traduzioni smetterebbe di
// funzionare al primo deploy.
export async function updateMessage(roomId, sender, original, updates, messageId = '') {
  const id = roomId.toUpperCase();
  const key = `msgs:${id}`;
  const result = await redis('EVAL', UPDATE_MESSAGE, 1, key,
    sender, original,
    updates.translated || '', updates.targetLang || '',
    updates.translations ? JSON.stringify(updates.translations) : '',
    messageId || '');
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse updateMessage result:', e.message); return null; }
}

// b.111 — quante righe si leggono quando si chiede "cosa e successo
// da un secondo a questa parte". La lista ne tiene 200 (LTRIM in
// ADD_MESSAGE): prima si leggevano e si interpretavano TUTTE E 200 a
// ogni giro, cioe ogni secondo e mezzo, per tenerne quasi sempre zero
// o una. In una stanza di quattro persone erano 32.000 letture al
// minuto per consegnare qualche frase.
//
// Sessanta e abbondante: in un secondo e mezzo non arrivano sessanta
// messaggi. Se pero la coda pescata comincia gia dopo il momento
// richiesto, vuol dire che qualcosa e rimasto indietro (il telefono
// era in tasca, la rete era caduta) e allora si rilegge tutto. Meglio
// una lettura in piu ogni tanto che un messaggio perso.
const CODA_MESSAGGI = 60;

export async function getMessages(roomId, after = 0) {
  const key = `msgs:${roomId.toUpperCase()}`;
  const interpreta = (righe) => righe
    .map(m => { try { return JSON.parse(m); } catch (e) { log.warn('Failed to parse message in getMessages:', e.message); return null; } })
    .filter(Boolean)
    // FASE 6A: Use >= to avoid missing messages at exact timestamp boundary
    // Client-side dedup by message ID handles duplicates
    .filter(m => m.timestamp >= after);

  // Primo caricamento: serve tutta la conversazione, non c'e scorciatoia.
  if (!after) {
    const tutti = await redis('LRANGE', key, 0, -1);
    return Array.isArray(tutti) ? interpreta(tutti) : [];
  }

  const coda = await redis('LRANGE', key, -CODA_MESSAGGI, -1);
  if (!coda || !Array.isArray(coda)) return [];
  const recenti = interpreta(coda);

  // Se TUTTI i sessanta pescati sono nuovi, il piu vecchio dei nuovi
  // potrebbe non essere il piu vecchio che serviva: si rilegge tutto.
  if (coda.length >= CODA_MESSAGGI && recenti.length === coda.length) {
    const tutti = await redis('LRANGE', key, 0, -1);
    return Array.isArray(tutti) ? interpreta(tutti) : recenti;
  }
  return recenti;
}

export async function getAllMessages(roomId) {
  const key = `msgs:${roomId.toUpperCase()}`;
  const allMsgs = await redis('LRANGE', key, 0, -1);
  if (!allMsgs || !Array.isArray(allMsgs)) return [];
  return allMsgs.map(m => { try { return JSON.parse(m); } catch (e) { log.warn('Failed to parse message in getAllMessages:', e.message); return null; } }).filter(Boolean);
}

// =============================================
// CONVERSATION HISTORY - persists after room ends
// =============================================

export async function saveConversation(roomId) {
  const id = roomId.toUpperCase();
  const room = await getRoom(id);
  if (!room) return null;
  const messages = await getAllMessages(id);

  const conv = {
    id,
    created: room.created,
    ended: Date.now(),
    mode: room.mode,
    host: room.host,
    members: room.members.map(m => ({ name: m.name, lang: m.lang, role: m.role, avatar: m.avatar })),
    totalCost: room.totalCost || 0,
    msgCount: messages.length,
    messages,
    summary: null // filled later by AI
  };

  // b.110 — il commento diceva sette giorni e il codice ne dava UNO
  // (86400). L'elenco invece scade davvero a sette (604800, sotto):
  // dopo un giorno la conversazione compariva ancora nell'archivio ma
  // aprirla dava "non trovata". Dati dell'utente persi senza un avviso.
  await redis('SET', `conv:${id}`, JSON.stringify(conv), 'EX', 604800);

  // Add to each member's conversation list
  for (const member of room.members) {
    const listKey = `convlist:${member.name}`;
    const entry = JSON.stringify({
      id,
      created: room.created,
      ended: conv.ended,
      host: room.host,
      members: conv.members.map(m => m.name),
      // b.433 — LE LINGUE ARRIVAVANO FIN QUI E VENIVANO BUTTATE. La
      // conversazione le ha (ogni membro porta la sua), ma nella riga
      // dell'archivio restavano solo i NOMI: e l'archivio e proprio il
      // posto dove servono, perche fra due conversazioni la cosa che le
      // distingue non e chi c'era, e da che lingua a che lingua.
      // Si AGGIUNGE un campo invece di cambiare `members`: le righe
      // scritte prima di oggi restano leggibili, e chi legge sa che
      // «non lo so» e diverso da «nessuna».
      lingue: [...new Set(conv.members.map(m => m.lang).filter(Boolean))],
      msgCount: conv.msgCount,
      hasSummary: false
    });
    await redis('RPUSH', listKey, entry);
    await redis('LTRIM', listKey, -20, -1); // keep last 20 conversations (device has full history)
    await redis('EXPIRE', listKey, 604800); // 7 days
  }

  // Mark room as ended
  room.ended = true;
  await redis('SET', `room:${id}`, JSON.stringify(room), 'EX', 3600);

  return conv;
}

export async function getConversation(convId) {
  const data = await redis('GET', `conv:${convId.toUpperCase()}`);
  if (!data) return null;
  let parsed; try { parsed = JSON.parse(data); } catch (e) { log.warn('Failed to parse conversation:', e.message); return null; } return parsed;
}

export async function updateConversationSummary(convId, summary) {
  const key = `conv:${convId.toUpperCase()}`;
  const result = await redis('EVAL', UPDATE_CONV_SUMMARY, 1, key, typeof summary === 'string' ? summary : JSON.stringify(summary));
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse updateConversationSummary result:', e.message); return null; }
}

// ═══════════════════════════════════════════════════════════════
// ELIMINARE UNA CONVERSAZIONE (b.126)
//
// L'azione non esisteva. Il pulsante c'era, il client la mandava, e
// /api/conversation rispondeva "Invalid action" — ma il client non
// guardava `res.ok` e tornava all'elenco come se fosse andata bene.
//
// Il dato dell'utente restava sul server per sette giorni, e lui era
// convinto di averlo cancellato. Non e un difetto di comodita.
//
// Si toglie da due posti: la conversazione (`conv:ID`) e la riga
// nell'elenco di OGNI partecipante (`convlist:NOME`) — altrimenti
// resterebbe visibile e aprirebbe su "non trovata".
// ═══════════════════════════════════════════════════════════════
export async function deleteConversation(convId, richiedente) {
  const id = String(convId || '').toUpperCase();
  if (!id || !richiedente) return { esito: 'dati-mancanti' };

  const conv = await getConversation(id);
  if (!conv) return { esito: 'non-trovata' };

  // Solo chi c'era puo cancellarla. Senza questo controllo sarebbe lo
  // stesso buco che b.123 ha appena chiuso su lettura e riassunto.
  const eraPresente = conv.members?.some((m) => m.name === richiedente);
  if (!eraPresente) return { esito: 'non-partecipante' };

  await redis('DEL', `conv:${id}`);

  // La riga va tolta dall'elenco di tutti, non solo di chi cancella:
  // lasciarla agli altri vorrebbe dire mostrare loro una conversazione
  // che non si apre piu.
  for (const membro of conv.members || []) {
    const listKey = `convlist:${membro.name}`;
    try {
      const righe = await redis('LRANGE', listKey, 0, -1);
      if (!Array.isArray(righe)) continue;
      for (const riga of righe) {
        let voce; try { voce = JSON.parse(riga); } catch { continue; }
        if (voce?.id === id) await redis('LREM', listKey, 0, riga);
      }
    } catch (e) {
      // Se un elenco non si ripulisce, la conversazione e comunque
      // sparita: resta una riga che aprira su "non trovata". Meglio
      // saperlo che fallire tutta la cancellazione.
      log.warn(`elenco di ${membro.name} non ripulito:`, e.message);
    }
  }
  return { esito: 'eliminata' };
}

export async function getUserConversations(userName) {
  const listKey = `convlist:${userName}`;
  const entries = await redis('LRANGE', listKey, 0, -1);
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(e => { try { return JSON.parse(e); } catch (err) { log.warn('Failed to parse conversation entry:', err.message); return null; } }).filter(Boolean).reverse(); // newest first
}
