// ═══════════════════════════════════════════════════════════════
// UNA SOLA FONTE DECISIONALE (b.139)
//
// ── PERCHE ESISTE QUESTO FILE ──
//
// Sette domande tornano dappertutto in questo programma:
//
//   1. questa stanza e in modalita Diretta?
//   2. questa stanza e una stanza Community, o privata?
//   3. i messaggi di questa stanza si conservano?
//   4. si entra diretti oppure serve che l'host apra?
//   5. questa persona puo moderare?
//   6. quanti ci stanno, e chi e gia dentro?
//   7. quale strada puo prendere un messaggio?
//
// Ognuna aveva piu di una risposta scritta in piu di un posto. Finche
// le copie concordano non se ne accorge nessuno; il giorno in cui una
// viene ritoccata e l'altra no, il programma comincia a contraddirsi —
// e lo fa in silenzio, perche nessuna delle due e "sbagliata": sono
// solo diverse.
//
// E gia successo due volte in questa base di codice:
//
//   · b.123 — la modalita Diretta si applicava in tre punti (creazione,
//     ingresso, rientro) e al terzo mancava. Rientrando in una stanza
//     riservata si ricominciava a mandare tutto ai nostri server.
//   · b.139 — vedi sotto, `siConservanoIMessaggi`: la regola sulla
//     conservazione viveva sul client (l'elenco delle rotte vietate) e
//     sul server (`eCommunity`), e le due DAVANO RISPOSTE DIVERSE.
//
// Qui le risposte sono una sola, e sono funzioni PURE: nessuna lettura,
// nessuna rete. Cosi lo stesso file lo puo importare il browser e lo
// puo importare una rotta, senza trascinarsi dietro Redis.
//
// Chi ha bisogno di leggere davvero la stanza usa `modalitaAutorevole`,
// in fondo: e l'unica funzione asincrona, e importa lo store solo
// quando serve, cioe mai nel pacchetto del browser.
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// 1 · MODALITA DIRETTA
// ───────────────────────────────────────────────────────────────

/**
 * La modalita Diretta di una STANZA, cioe il dato conservato dal server.
 * E la fonte autorevole: la scelta la fa chi crea la stanza, ma poi
 * viaggia con la stanza, perche chi entra dopo non ha modo di saperla.
 */
export function eDiretta(stanza) {
  return !!(stanza && stanza.diretta);
}

/** La stessa risposta come stringa, nella forma che gira nelle intestazioni. */
export function modalitaDiStanza(stanza) {
  return eDiretta(stanza) ? 'direct' : 'translate';
}

/**
 * La modalita espressa come stringa ('direct' | 'translate').
 * Unico posto in cui si scrive il confronto: prima era ripetuto a mano
 * in mezza dozzina di punti, ognuno libero di sbagliarlo a modo suo.
 */
export function eModalitaDiretta(modo) {
  return modo === 'direct';
}

/** Riporta qualunque valore ai due soli ammessi. */
export function normalizzaModalita(modo) {
  return eModalitaDiretta(modo) ? 'direct' : 'translate';
}

// ───────────────────────────────────────────────────────────────
// 2 · STANZA COMMUNITY
// ───────────────────────────────────────────────────────────────

/**
 * Una stanza e "Community" se e stata pubblicata in vetrina: e li che si
 * accetta di rinunciare alla riservatezza in cambio dello storico.
 * Il segno concreto e che esistono delle regole con un host: le scrive
 * solo /api/mondo. Una chat privata non ne ha.
 */
export function eCommunity(regole) {
  return !!(regole && regole.hostNome);
}

/**
 * ── b.139-bis · I QUATTRO TIPI DI STANZA, SCRITTI UNA VOLTA SOLA ──
 *
 * L'elenco stava in due posti che non si conoscevano:
 *
 *   · CreateRoomSheet.js — la tabella che disegna i quattro riquadri;
 *   · /api/mondo — `const ROOM_TYPES = ['public','protected','private',
 *     'temporary']`, usato per rifiutare i valori inventati.
 *
 * Due elenchi separati della stessa cosa reggono finche nessuno ne
 * tocca uno: il giorno in cui si aggiunge un tipo al modulo di
 * creazione e non alla rotta, il server lo ricade in silenzio su
 * 'public' — cioe pubblica in vetrina una stanza che l'utente aveva
 * chiesto di tenere fuori. Nessun errore, nessun avviso.
 */
export const TIPI_STANZA = ['public', 'protected', 'private', 'temporary'];

/** Riporta qualunque valore ai quattro ammessi. Fuori elenco → 'public'. */
export function normalizzaTipoStanza(tipo) {
  return TIPI_STANZA.includes(tipo) ? tipo : 'public';
}

/**
 * Una stanza privata si raggiunge solo con l'invito: in vetrina non ci va.
 *
 * Lo stesso predicato era scritto due volte, con due segni opposti e in
 * due linguaggi diversi:
 *
 *   · page.js  — `if (codice && roomConfig.roomType !== 'private')`
 *   · /api/mondo — `if (tipo === 'private') return { pubblicata: false }`
 *
 * Concordavano, ma per coincidenza. Il server resta l'autorita — e lui
 * a rifiutare la pubblicazione — e il client evita solo una richiesta
 * inutile: e questo il rapporto giusto fra i due, e ora e scritto una
 * volta sola.
 */
export function vaInVetrina(tipo) {
  return normalizzaTipoStanza(tipo) !== 'private';
}

/**
 * 'protected' vuol dire: si bussa e l'host apre.
 *
 * La derivazione viveva in una riga sola dentro /api/mondo
 * (`suApprovazione: tipo === 'protected'`), quindi il client non aveva
 * modo di rispondere alla stessa domanda: la scopriva solo dopo, dalla
 * voce di vetrina. Sta qui perche e il significato del tipo, e il tipo
 * ora sta qui.
 */
export function richiedeApprovazione(tipo) {
  return normalizzaTipoStanza(tipo) === 'protected';
}

// ───────────────────────────────────────────────────────────────
// 3 · CONSERVAZIONE DEI MESSAGGI
// ───────────────────────────────────────────────────────────────

/**
 * ── IL DIFETTO VERO TROVATO IN b.139 ──
 *
 * Questa domanda aveva DUE risposte diverse, e non in due sfumature:
 * proprio opposte, sullo stesso caso.
 *
 *   · Sul client: /api/reazioni sta in `ROTTE_VIETATE_IN_DIRETTA`, quindi
 *     in una stanza Diretta il messaggio non parte nemmeno. Risposta: NO.
 *   · Sul server: `eCommunity(roomId)` guardava SOLO se la stanza fosse
 *     pubblicata in vetrina, e non guardava `diretta` per niente.
 *     Risposta per una stanza Diretta pubblicata: SI, conservo.
 *
 * E un caso raggiungibile, non teorico: nel modulo di creazione si puo
 * accendere "Stanza Diretta" e lasciare il tipo su "Pubblico" (il valore
 * predefinito). page.js pubblica in vetrina ogni stanza che non sia
 * privata, senza guardare `diretta`. Da quel momento la stanza dice a
 * schermo "non li conserviamo, non ne teniamo copia" e il server, se
 * qualcuno gliela chiede, li conserva.
 *
 * L'unica cosa che teneva d'accordo le due risposte era l'intestazione
 * `x-session-mode`, che manda il CLIENT. Cioe: la promessa di
 * riservatezza dipendeva dal fatto che il client si comportasse bene.
 * Un client vecchio, una richiesta rifatta a mano, un difetto nel
 * cancello davanti a fetch — e la promessa cadeva senza un rumore.
 *
 * Ora la regola e una: si conserva SOLO se la stanza e Community E NON
 * e Diretta. Si valuta sul server, sui dati del server.
 */
export function siConservanoIMessaggi({ regole, stanza } = {}) {
  if (eDiretta(stanza)) return false;
  return eCommunity(regole);
}

// ───────────────────────────────────────────────────────────────
// 4 · CHI PUO MODERARE
// ───────────────────────────────────────────────────────────────

/**
 * Due nomi sono la stessa persona se lo sono a meno di spazi e maiuscole:
 * un blocco aggirabile con lo shift non e un blocco.
 */
export function normalizzaNome(nome) {
  return (nome || '').trim().toLowerCase().slice(0, 40);
}

/**
 * ── b.195 · IL NOME NON CONCEDE PIU NIENTE (audit esterno, CONFERMATO) ──
 *
 * Fino a b.194 questa funzione concedeva la moderazione anche solo perche
 * il NOME del chiamante combaciava con `regole.hostNome` o `stanza.host`,
 * pur con un gettone che portava `role:'guest'`. Era una escalation di
 * privilegi reale e sfruttabile:
 *
 *   1. l'host crea "ABC" come "Luca" → room.host = "Luca"
 *      (e regole.hostNome = "Luca" se la stanza e pubblicata in Community);
 *   2. un estraneo entra in "ABC" scrivendo lo stesso nome "Luca". Il join
 *      (handleJoin, b.169) NON gli firma il ruolo host, perche non ha il
 *      segreto host: il suo gettone porta `role:'guest'`;
 *   3. MA `puoModerare` guardava ancora il nome (rami 2 e 3) e rispondeva
 *      "si". L'estraneo moderava: ammetteva, rifiutava, bloccava.
 *
 * I due meccanismi si contraddicevano: il join si rifiuta di firmare host
 * senza segreto, e poi qui l'host si concedeva lo stesso, per nome.
 *
 * La regola corretta e una sola: il PRIVILEGIO viene SOLO dal ruolo
 * firmato nel gettone di sessione (che il server scrive all'ingresso e
 * non e falsificabile da fuori). Il displayName non concede mai niente.
 *
 * Chi ospita davvero riceve `role:'host'` alla creazione (handleCreate) e
 * lo riottiene rientrando col segreto host (handleJoin). Chi non ha il
 * segreto non e host: e la decisione gia presa in b.169, non una novita.
 * Quindi i rami per nome non servivano a nessun host legittimo — servivano
 * solo all'attacco. Tolti.
 */
export function puoModerare({ identita } = {}) {
  // L'unica prova che vale: il ruolo firmato dal server nel gettone di
  // stanza. Niente confronto sul nome, in nessun ramo.
  return !!(identita && identita.role === 'host' && normalizzaNome(identita.name));
}

// ───────────────────────────────────────────────────────────────
// 5 · QUANTI CI STANNO, E CHI E DENTRO
// ───────────────────────────────────────────────────────────────

/**
 * ── b.139-bis · TRE TETTI DIVERSI PER LA STESSA STANZA ──
 *
 * "Quante persone ci stanno" aveva TRE risposte scritte in tre punti,
 * e non concordavano:
 *
 *   · CreateRoomSheet.js — parte da 20, e in Diretta impone 2;
 *   · /api/mondo — `Math.min(50, Math.max(2, Number(n) || 20))`;
 *   · redisLua.js JOIN_ROOM — `tonumber(room.maxPartecipanti) or 10`.
 *
 * Il terzo non e una ridondanza innocua: `createRoom()` non scriveva
 * MAI `maxPartecipanti` sulla stanza, e l'unico punto che lo scriveva
 * era `aggiornaPoliticaPubblica`, chiamata solo da /api/mondo. Quindi
 * in una stanza PRIVATA — o Diretta, o comunque mai pubblicata — il
 * campo restava assente e il tetto vero era il ripiego di Lua: DIECI,
 * mentre il modulo di creazione ne aveva promessi venti.
 *
 * L'undicesimo si vedeva rispondere "La stanza e al completo" in una
 * stanza che l'utente aveva creato per venti. Nessun log, nessun modo
 * di indovinarlo: i due numeri stavano in due linguaggi diversi.
 *
 * Da qui in poi il ripiego non serve piu, perche `createRoom` scrive il
 * tetto alla nascita; ma resta allineato a questo numero, e il Lua se
 * lo fa dare da qui invece di averlo scritto dentro.
 */
export const CAPIENZA = {
  MIN: 2,
  MAX: 50,
  PREDEFINITA: 20,
  /** La Diretta e uno-a-uno: useWebRTC ha una connessione sola (b.126). */
  DIRETTA: 2,
};

/**
 * Il tetto valido di una stanza. Unico punto in cui si decide, sia sul
 * telefono quando si sceglie, sia sul server quando si scrive.
 */
export function normalizzaCapienza(valore, { diretta = false } = {}) {
  if (diretta) return CAPIENZA.DIRETTA;
  const n = Number(valore);
  if (!Number.isFinite(n) || n <= 0) return CAPIENZA.PREDEFINITA;
  return Math.min(CAPIENZA.MAX, Math.max(CAPIENZA.MIN, Math.floor(n)));
}

/**
 * ── CHI FA PARTE DELLA STANZA ──
 *
 * Lo stesso `room.members.some(m => m.name === identity.name)` era
 * ricopiato in cinque punti: `verifyMembership` in roomActions.js e tre
 * volte dentro /api/messages (POST, PATCH, GET), piu la ricerca del
 * ruolo. Cinque copie della stessa riga sono cinque occasioni di
 * correggerne quattro.
 *
 * ── PERCHE QUI IL CONFRONTO E ALLA LETTERA E IN `puoModerare` NO ──
 *
 * Non e una svista, ed e la domanda che verrebbe subito guardando i due
 * insieme. Sono due domande diverse:
 *
 *   · `puoModerare` chiede "sei la stessa PERSONA dell'host?" — e una
 *     risposta che deve resistere a chi prova ad aggirarla cambiando
 *     una maiuscola, quindi normalizza.
 *   · `eMembro` chiede "esiste questa VOCE nell'elenco?" — e l'elenco
 *     lo scrive lo script Lua di JOIN_ROOM, che confronta `m.name ==
 *     name` alla lettera. Normalizzare qui e non li vorrebbe dire dare
 *     per membro qualcuno che il join ha registrato come persona
 *     diversa: piu permissivo del punto che crea il dato.
 *
 * Il nome, del resto, non arriva da chi chiama: arriva dal gettone di
 * sessione firmato dal server (`resolveRoomIdentity`).
 */
export function eMembro(stanza, nome) {
  if (!stanza || !Array.isArray(stanza.members) || !nome) return false;
  return stanza.members.some((m) => m && m.name === nome);
}

/** La voce di quel membro, o `null`. Serve a chi deve leggerne il ruolo. */
export function membroDi(stanza, nome) {
  if (!stanza || !Array.isArray(stanza.members) || !nome) return null;
  return stanza.members.find((m) => m && m.name === nome) || null;
}

/** Il ruolo di chi e dentro. Chi non c'e, o non ce l'ha, e un ospite. */
export function ruoloDi(stanza, nome) {
  const m = membroDi(stanza, nome);
  return (m && m.role) || 'guest';
}

/**
 * La stanza e piena?
 *
 * La risposta vera la da lo script Lua, perche solo li il conto e
 * atomico: due che entrano nello stesso istante vanno contati una volta
 * per uno. Questa e la stessa regola in JavaScript, per chi deve
 * decidere PRIMA di provare (una schermata, un elenco) e per i
 * controlli. Usa lo stesso tetto, quindi non puo divergere.
 */
export function stanzaPiena(stanza) {
  if (!stanza || !Array.isArray(stanza.members)) return false;
  return stanza.members.length >= normalizzaCapienza(stanza.maxPartecipanti, {
    diretta: eDiretta(stanza),
  });
}

// ───────────────────────────────────────────────────────────────
// 6 · TRASPORTO
// ───────────────────────────────────────────────────────────────

export const TRASPORTO = {
  P2P: 'p2p',            // canale dati WebRTC, da telefono a telefono
  REALTIME: 'realtime',  // canale Supabase Realtime, passa dai nostri server
  SERVER: 'server',      // /api/messages, con conservazione
};

/**
 * Quali strade puo prendere un messaggio, data la modalita.
 *
 * La regola era ripetuta in tre punti di useTranslationAPI sotto forma
 * di `if (!isDirect)` sparsi, e ogni punto la riscriveva: bastava
 * dimenticarne uno perche in modalita Diretta un pezzo di conversazione
 * uscisse da Realtime. Qui e detta una volta:
 *
 *   · il canale diretto vale SEMPRE — e la ragione per cui la modalita
 *     Diretta puo funzionare;
 *   · Realtime e il server passano dai nostri sistemi, quindi in
 *     modalita Diretta sono chiusi tutti e due.
 */
export function trasportiAmmessi(modo) {
  const diretta = eModalitaDiretta(modo);
  return {
    [TRASPORTO.P2P]: true,
    [TRASPORTO.REALTIME]: !diretta,
    [TRASPORTO.SERVER]: !diretta,
  };
}

/** Comodita: `true` se quel trasporto e ammesso in questa modalita. */
export function trasportoAmmesso(modo, trasporto) {
  return !!trasportiAmmessi(modo)[trasporto];
}

// ───────────────────────────────────────────────────────────────
// 7 · LE ROTTE CHE NON DEVONO PARTIRE IN MODALITA DIRETTA
// ───────────────────────────────────────────────────────────────

/**
 * L'elenco vive qui perche lo leggono in due: il cancello davanti a
 * fetch (client) e la guardia delle rotte (server). Prima stava in
 * sessionGuard.js, che ora lo ri-esporta per non rompere chi lo importa
 * gia — ma la copia buona e questa.
 */
export const ROTTE_VIETATE_IN_DIRETTA = [
  '/api/messages',
  '/api/translate',
  '/api/translate-free',
  '/api/translate-consensus',
  '/api/transcribe',
  '/api/tts',
  '/api/tts-edge',
  '/api/tts-elevenlabs',
  '/api/summary',
  '/api/conversation',
  '/api/chat-action',
  // ── b.111 · quattro che mancavano, e non erano le meno gravi ──
  // stt-token consegna al telefono un gettone per aprire un flusso
  // audio DIRETTO verso Deepgram: in modalita Diretta e la voce, dal
  // vivo, verso un terzo. Era la falla piu grande e non era nell'elenco.
  '/api/stt-token',
  '/api/translate-stream',
  // La clonazione carica una registrazione della propria voce.
  '/api/voice-clone',
  // Le reazioni conservano il TESTO del messaggio per la vetrina
  // Community. Giusto li, sbagliato in una conversazione riservata.
  '/api/reazioni',
];

/**
 * Il confronto fra un percorso e l'elenco. Era scritto dentro il
 * cancello, quindi il server non poteva usarlo nemmeno volendo.
 */
export function rottaVietataInDiretta(percorso) {
  const p = String(percorso || '');
  return ROTTE_VIETATE_IN_DIRETTA.some((r) => p === r || p.startsWith(`${r}/`));
}

// ───────────────────────────────────────────────────────────────
// 8 · LA MODALITA SECONDO IL SERVER, NON SECONDO IL CLIENT
// ───────────────────────────────────────────────────────────────

/**
 * ── IL SERVER NON DEVE FIDARSI DELL'INTESTAZIONE ──
 *
 * `assertCloudProcessingAllowed()` legge `x-session-mode`, che arriva
 * dal client. Va benissimo come PRIMO filtro — costa niente e ferma il
 * caso normale — ma non e una difesa: chi manda la richiesta sceglie
 * cosa scriverci dentro. Una promessa sulla riservatezza non puo
 * poggiare su un dato che decide la parte da cui ci si difende.
 *
 * Questa funzione risponde alla stessa domanda leggendo la STANZA,
 * quando la richiesta porta con se un modo di identificarla (il codice
 * della stanza o il gettone di sessione). Se la stanza risulta Diretta,
 * e Diretta — qualunque cosa dica l'intestazione.
 *
 * Non cambia nulla per un client onesto: in una stanza Diretta queste
 * richieste non partono proprio. Cambia tutto per uno che mente.
 *
 * Torna 'direct' | 'translate'.
 */
export async function modalitaAutorevole(req, riferimento = {}) {
  // 1. Quel che dice il client. Se dice "direct", ci si crede subito:
  //    dichiararsi piu riservati di quello che si e non fa danno.
  const dichiarata = req && req.headers && typeof req.headers.get === 'function'
    ? req.headers.get('x-session-mode')
    : null;
  if (eModalitaDiretta(dichiarata)) return 'direct';

  // 2. Quel che dice la stanza. Questa e la parola che conta.
  const { roomId, roomSessionToken } = riferimento;
  if (!roomId && !roomSessionToken) return 'translate';

  try {
    const { getRoom, verifyRoomSession } = await import('./store.js');
    let codice = roomId;
    if (!codice && roomSessionToken) {
      const sessione = await verifyRoomSession(roomSessionToken);
      codice = sessione && sessione.roomId;
    }
    if (!codice) return 'translate';
    const stanza = await getRoom(codice);
    return modalitaDiStanza(stanza);
  } catch {
    // Archivio irraggiungibile: non si INVENTA una modalita Diretta che
    // bloccherebbe una stanza normale, e non si nega quella dichiarata —
    // il passo 1 l'ha gia onorata. Resta il comportamento di sempre.
    return 'translate';
  }
}
