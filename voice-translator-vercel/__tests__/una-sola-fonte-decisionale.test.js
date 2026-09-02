// ═══════════════════════════════════════════════════════════════
// UNA SOLA FONTE DECISIONALE (b.139)
//
// Luca, testualmente: "Room, policy, stato Community, moderazione,
// Direct/Cloud e trasporto devono avere una sola fonte decisionale.
// Finche la stessa regola vive in piu punti, il rischio di regressioni
// rimane."
//
// ── LA MAPPA DELLE COPIE TROVATE ──
//
//  1. "e in modalita Diretta?"  — il confronto `=== 'direct'` era scritto
//     a mano in sessionGuard.js, in modalitaSessione.js (due volte), in
//     page.js e in useTranslationAPI (tre volte).
//  2. "e una stanza Community?" — /api/reazioni.
//  3. "i messaggi si conservano?" — DUE COPIE CHE DAVANO RISPOSTE
//     DIVERSE: vedi sotto, e il difetto vero di questo giro.
//  4. "chi puo moderare?" — CINQUE copie: roomActions.js (tre),
//     /api/conversation, /api/moderazione. E non erano uguali fra loro.
//  5. "quale trasporto?" — la regola sparsa in `!isDirect` in cinque punti.
//
// ── IL DIFETTO VERO ──
//
// La domanda "i messaggi di questa stanza si conservano?" aveva due
// risposte OPPOSTE sullo stesso caso:
//
//   · il client: /api/reazioni sta nell'elenco delle rotte vietate in
//     modalita Diretta, quindi la richiesta non parte. Risposta: NO.
//   · il server: `eCommunity(roomId)` guardava solo se la stanza fosse
//     in vetrina e NON guardava `diretta`. Risposta: SI.
//
// Il caso e raggiungibile senza forzare niente: nel modulo di creazione
// si accende "Stanza Diretta" e si lascia il tipo su "Pubblico", che e
// il valore predefinito; page.js pubblica in vetrina tutto cio che non
// e privato. Da quel momento la stanza dice a schermo "non li
// conserviamo, non ne teniamo copia" e il server, se glielo si chiede,
// li conserva. A tenere insieme le due risposte c'era solo
// l'intestazione `x-session-mode` — che manda il CLIENT.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  eDiretta,
  modalitaDiStanza,
  eModalitaDiretta,
  normalizzaModalita,
  eCommunity,
  siConservanoIMessaggi,
  normalizzaNome,
  puoModerare,
  trasportiAmmessi,
  trasportoAmmesso,
  TRASPORTO,
  ROTTE_VIETATE_IN_DIRETTA,
  rottaVietataInDiretta,
  TIPI_STANZA,
  normalizzaTipoStanza,
  vaInVetrina,
  richiedeApprovazione,
  CAPIENZA,
  normalizzaCapienza,
  eMembro,
  membroDi,
  ruoloDi,
  stanzaPiena,
} from '../app/lib/decisioni.js';
import { JOIN_ROOM } from '../app/lib/redisLua.js';

const RADICE = path.resolve(__dirname, '..');
const leggi = (r) => fs.readFileSync(path.join(RADICE, r), 'utf8');
const senzaCommenti = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((r) => !/^\s*(\/\/|\*)/.test(r))
  .join('\n');

// ═══════════════════════════════════════════════════════════════
describe('1 · modalita Diretta: una domanda, una risposta', () => {

  it('la Diretta si legge dalla stanza', () => {
    expect(eDiretta({ diretta: true })).toBe(true);
    expect(eDiretta({ diretta: false })).toBe(false);
    expect(eDiretta({})).toBe(false);
    expect(eDiretta(null)).toBe(false);
    expect(eDiretta(undefined)).toBe(false);
  });

  it('e diventa la stringa che gira nelle intestazioni', () => {
    expect(modalitaDiStanza({ diretta: true })).toBe('direct');
    expect(modalitaDiStanza({ diretta: false })).toBe('translate');
    expect(modalitaDiStanza(null)).toBe('translate');
  });

  it('nessun altro valore diventa "direct" per sbaglio', () => {
    for (const v of ['Direct', 'DIRECT', 'diretta', 'true', '1', '', null, undefined, 0]) {
      expect(eModalitaDiretta(v), `"${v}" non deve valere direct`).toBe(false);
    }
    expect(eModalitaDiretta('direct')).toBe(true);
  });

  it('normalizzaModalita riporta ai due soli valori ammessi', () => {
    expect(normalizzaModalita('direct')).toBe('direct');
    expect(normalizzaModalita('qualunque cosa')).toBe('translate');
    expect(normalizzaModalita(undefined)).toBe('translate');
  });
});

// ═══════════════════════════════════════════════════════════════
describe('2 · stanza Community: una domanda, una risposta', () => {

  it('e Community solo se ha delle regole con un host', () => {
    expect(eCommunity({ hostNome: 'luca' })).toBe(true);
    expect(eCommunity({ hostNome: '' })).toBe(false);
    expect(eCommunity({ suApprovazione: true })).toBe(false);
    expect(eCommunity(null)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('3 · conservazione: il caso su cui le due copie si contraddicevano', () => {

  it('una chat privata non conserva niente', () => {
    expect(siConservanoIMessaggi({ regole: { hostNome: '' }, stanza: { diretta: false } })).toBe(false);
  });

  it('una stanza Community normale conserva', () => {
    expect(siConservanoIMessaggi({ regole: { hostNome: 'luca' }, stanza: { diretta: false } })).toBe(true);
  });

  it('UNA STANZA DIRETTA NON CONSERVA, NEMMENO SE E IN VETRINA', () => {
    // Questo e il caso in cui le due copie rispondevano al contrario.
    // Prima: il client "no", il server "si". Ora: no, una volta sola.
    expect(siConservanoIMessaggi({ regole: { hostNome: 'luca' }, stanza: { diretta: true } })).toBe(false);
  });

  it('nel dubbio non conserva: senza stanza e senza regole, no', () => {
    expect(siConservanoIMessaggi({})).toBe(false);
    expect(siConservanoIMessaggi()).toBe(false);
  });

  it('/api/reazioni chiede alla funzione unica, non a una sua copia', () => {
    const r = senzaCommenti(leggi('app/api/reazioni/route.js'));
    expect(r, 'la vecchia copia locale non deve esistere piu')
      .not.toMatch(/async function eCommunity\(/);
    expect(r).toContain('siConservanoIMessaggi(');
    expect(r, 'e le deve passare anche la STANZA, non solo le regole')
      .toContain('getRoom(roomId)');
  });
});

// ═══════════════════════════════════════════════════════════════
describe('4 · chi puo moderare: cinque copie diventate una', () => {

  it('SOLO il ruolo firmato dal server concede la moderazione', () => {
    expect(puoModerare({ identita: { name: 'Luca', role: 'host' } })).toBe(true);
    expect(puoModerare({ identita: { name: 'Luca', role: 'guest' } })).toBe(false);
  });

  it('b.195 — il nome sulla stanza NON concede piu privilegi a un guest', () => {
    // Era l'escalation confermata dall'audit: un estraneo che entra con
    // lo stesso nome dell'host (gettone role:'guest', perche senza segreto
    // host il join non firma 'host') NON deve poter moderare.
    expect(puoModerare({
      identita: { name: 'Luca', role: 'guest' },
      stanza: { host: 'Luca' },
    })).toBe(false);
  });

  it('b.195 — nemmeno l\'host dichiarato nelle regole di vetrina, per nome', () => {
    expect(puoModerare({
      identita: { name: 'Luca', role: 'guest' },
      regole: { hostNome: 'luca' },
    })).toBe(false);
  });

  it('b.195 — l\'host vero passa per RUOLO, non per nome coincidente', () => {
    // Chi ospita davvero porta role:'host' firmato (creazione o rientro
    // col segreto). Il nome puo essere qualunque: conta la firma.
    expect(normalizzaNome('  Luca  ')).toBe('luca');
    expect(puoModerare({ identita: { name: 'Chiunque', role: 'host' } })).toBe(true);
    expect(puoModerare({ identita: { name: ' LUCA ', role: 'host' } })).toBe(true);
  });

  it('un nome vuoto non modera mai, nemmeno col ruolo host', () => {
    expect(puoModerare({ identita: { name: '', role: 'host' } })).toBe(false);
    expect(puoModerare({ identita: null })).toBe(false);
    expect(puoModerare({})).toBe(false);
    // E il nome da solo, senza ruolo firmato, non fa passare mai nessuno.
    expect(puoModerare({ identita: { name: 'Chiunque' }, regole: { hostNome: 'Chiunque' } })).toBe(false);
    expect(puoModerare({ identita: { name: 'Chiunque' }, stanza: { host: 'Chiunque' } })).toBe(false);
  });

  it('nessuno dei cinque punti riscrive piu la regola a mano', () => {
    const files = [
      'app/lib/roomActions.js',
      'app/api/conversation/route.js',
      'app/api/moderazione/route.js',
    ];
    for (const f of files) {
      const s = senzaCommenti(leggi(f));
      expect(s, `${f} riscrive ancora il confronto sul ruolo`)
        .not.toMatch(/identity\.verified\s*\n?\s*\?\s*identity\.role === 'host'/);
      expect(s, `${f} non chiama puoModerare`).toContain('puoModerare(');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
describe('5 · trasporto: quale strada puo prendere un messaggio', () => {

  it('in modalita normale sono aperte tutte e tre', () => {
    const v = trasportiAmmessi('translate');
    expect(v[TRASPORTO.P2P]).toBe(true);
    expect(v[TRASPORTO.REALTIME]).toBe(true);
    expect(v[TRASPORTO.SERVER]).toBe(true);
  });

  it('in modalita Diretta resta SOLO il canale fra i due telefoni', () => {
    const v = trasportiAmmessi('direct');
    expect(v[TRASPORTO.P2P]).toBe(true);
    expect(v[TRASPORTO.REALTIME]).toBe(false);
    expect(v[TRASPORTO.SERVER]).toBe(false);
  });

  it('trasportoAmmesso risponde come trasportiAmmessi', () => {
    expect(trasportoAmmesso('direct', TRASPORTO.REALTIME)).toBe(false);
    expect(trasportoAmmesso('direct', TRASPORTO.P2P)).toBe(true);
    expect(trasportoAmmesso('translate', TRASPORTO.SERVER)).toBe(true);
  });

  it('useTranslationAPI non decide piu da solo', () => {
    const s = senzaCommenti(leggi('app/hooks/useTranslationAPI.js'));
    expect(s).toContain('trasportiAmmessi(');
    expect(s, 'i tre rami non devono piu essere scritti a mano')
      .not.toMatch(/&& !isDirect\b/);
  });

  it('page.js non decide piu da solo', () => {
    const s = senzaCommenti(leggi('app/page.js'));
    expect(s).toContain('trasportoAmmesso(');
    expect(s, 'la conferma di lettura non deve riscrivere la regola')
      .not.toMatch(/!isDirectMode\(sessionModeRef\.current\)/);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('6 · l\'elenco delle rotte vietate vive in un posto solo', () => {

  it('sessionGuard non lo ricopia e non lo rinomina', () => {
    // b.601 — prima lo ri-esportava come BLOCKED_IN_DIRECT: due nomi per
    // la stessa lista. Ora nessun alias: un nome solo, in decisioni.js.
    const s = senzaCommenti(leggi('app/lib/sessionGuard.js'));
    expect(s).not.toContain('BLOCKED_IN_DIRECT');
    expect(s, 'nessuna seconda copia dell\'elenco').not.toMatch(/'\/api\/tts-elevenlabs'/);
  });

  it('il cancello davanti a fetch usa il confronto comune', () => {
    const s = senzaCommenti(leggi('app/lib/modalitaSessione.js'));
    expect(s).toContain('rottaVietataInDiretta(');
    expect(s, 'il confronto non deve essere riscritto qui')
      .not.toMatch(/startsWith\(`\$\{r\}\/`\)/);
  });

  it('il confronto riconosce la rotta e le sue sottorotte', () => {
    expect(rottaVietataInDiretta('/api/transcribe')).toBe(true);
    expect(rottaVietataInDiretta('/api/transcribe/streaming')).toBe(true);
    expect(rottaVietataInDiretta('/api/transcribed')).toBe(false);
    expect(rottaVietataInDiretta('/api/room')).toBe(false);
    expect(rottaVietataInDiretta('')).toBe(false);
    expect(rottaVietataInDiretta(null)).toBe(false);
  });

  it('le quindici rotte che elaborano contenuto ci sono tutte', () => {
    for (const r of [
      '/api/messages', '/api/translate', '/api/transcribe', '/api/tts',
      '/api/stt-token', '/api/reazioni', '/api/conversation', '/api/summary',
    ]) {
      expect(ROTTE_VIETATE_IN_DIRETTA, `manca ${r}`).toContain(r);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
describe('7 · il SERVER e l\'autorita, non l\'intestazione del client', () => {

  it('esiste una guardia che chiede alla stanza', () => {
    const s = senzaCommenti(leggi('app/lib/sessionGuard.js'));
    expect(s).toContain('export async function assertElaborazioneConsentita');
    expect(s).toContain('modalitaAutorevole(');
  });

  it('modalitaAutorevole crede subito a chi si dichiara piu riservato', async () => {
    // Dichiararsi in Diretta non fa danno: si concede senza leggere nulla.
    // b.601 — vive in sessionGuard.js (decisioni.js e' una foglia pura).
    const { modalitaAutorevole } = await import('../app/lib/sessionGuard.js');
    const req = { headers: { get: (n) => (n === 'x-session-mode' ? 'direct' : null) } };
    expect(await modalitaAutorevole(req, {})).toBe('direct');
  });

  it('ma senza un riferimento alla stanza non inventa una Diretta', async () => {
    const { modalitaAutorevole } = await import('../app/lib/sessionGuard.js');
    const req = { headers: { get: () => 'translate' } };
    expect(await modalitaAutorevole(req, {})).toBe('translate');
  });

  it('/api/messages non si fida piu della sola intestazione', () => {
    // La stanza viene gia caricata per un altro motivo: la risposta vera
    // non costa una lettura in piu.
    const s = senzaCommenti(leggi('app/api/messages/route.js'));
    expect(s).toContain('eDiretta(room)');
    // Tre punti: POST, PATCH e GET.
    expect((s.match(/eDiretta\(room\)/g) || []).length).toBe(3);
  });

  it('/api/conversation non archivia una stanza Diretta', () => {
    // `saveConversation` scrive la conversazione INTERA sui nostri sistemi.
    const s = senzaCommenti(leggi('app/api/conversation/route.js'));
    expect(s).toContain('eDiretta(room)');
    const i = s.indexOf('eDiretta(room)');
    const j = s.indexOf('saveConversation(rid)');
    expect(i, 'la barriera deve venire PRIMA del salvataggio').toBeLessThan(j);
  });

  it('/api/reazioni passa il riferimento della stanza alla guardia', () => {
    const s = senzaCommenti(leggi('app/api/reazioni/route.js'));
    expect(s).toContain('assertElaborazioneConsentita(req, {');
    expect(s).toContain('roomSessionToken:');
  });
});

// ═══════════════════════════════════════════════════════════════
describe('8 · nessuno ha ricominciato a scrivere la regola per conto suo', () => {

  const SORVEGLIATI = [
    'app/lib/sessionGuard.js',
    'app/lib/modalitaSessione.js',
    'app/lib/roomActions.js',
    'app/lib/moderazione.js',
    'app/hooks/useTranslationAPI.js',
    'app/hooks/useE2EEncryption.js',
    'app/api/reazioni/route.js',
    'app/api/moderazione/route.js',
    'app/api/conversation/route.js',
    'app/page.js',
  ];

  it('tutti importano da decisioni.js', () => {
    const senza = SORVEGLIATI.filter((f) => !/from '[^']*decisioni\.js'/.test(leggi(f)));
    expect(senza).toEqual([]);
  });

  it('e nessuno riscrive `=== \'direct\'` a mano', () => {
    const colpevoli = [];
    for (const f of SORVEGLIATI) {
      if (/===\s*'direct'/.test(senzaCommenti(leggi(f)))) colpevoli.push(f);
    }
    expect(colpevoli).toEqual([]);
  });

  it('decisioni.js non tira dentro Redis nel pacchetto del browser', () => {
    // Le funzioni sono pure di proposito: lo stesso file lo importano
    // page.js e le rotte. L'unica lettura vera arriva da un import
    // dinamico, quindi non finisce nel bundle del client.
    const s = leggi('app/lib/decisioni.js');
    expect(s).not.toMatch(/^import .*(store|redis)\.js/m);
    // b.601 — ora non importa proprio NIENTE: foglia pura. La lettura
    // dello store e' in sessionGuard.js, pigra per lo stesso motivo.
    expect(s).not.toMatch(/^import /m);
    expect(leggi('app/lib/sessionGuard.js')).toContain("await import('./store.js')");
  });
});

// ═══════════════════════════════════════════════════════════════
// b.139-bis · IL SECONDO GIRO
//
// Il primo giro aveva chiuso Diretta/Cloud, Community, conservazione,
// moderazione e trasporto. Restavano fuori tre domande delle sei che
// Luca aveva elencato, e sono quelle su cui e uscito il difetto piu
// concreto di tutto il lavoro:
//
//   A) la stanza e Community o privata?  — l'elenco dei tipi stava in
//      DUE file (CreateRoomSheet.js e /api/mondo) e il predicato "va in
//      vetrina?" era scritto due volte con due segni opposti;
//   C) si entra diretti o si bussa?      — `suApprovazione` si deduceva
//      dal tipo in una riga sola, sepolta in /api/mondo, quindi il
//      client non poteva rispondere alla stessa domanda;
//   F) quanti ci stanno, e chi e dentro? — QUI il difetto vero.
//
// ── IL DIFETTO VERO DI QUESTO GIRO ──
//
// Il tetto dei partecipanti era scritto in TRE punti, in tre linguaggi,
// con tre numeri diversi:
//
//   · CreateRoomSheet.js  parte da 20 e offre 5/10/20/50
//   · /api/mondo          `Math.min(50, Math.max(2, n || 20))`
//   · redisLua.js (Lua)   `tonumber(room.maxPartecipanti) or 10`
//
// E il terzo era quello che decideva davvero, perche `createRoom()` non
// scriveva MAI `maxPartecipanti` sulla stanza: l'unico punto che lo
// scriveva era `aggiornaPoliticaPubblica`, chiamata solo da /api/mondo,
// cioe solo per le stanze PUBBLICATE IN VETRINA.
//
// Quindi in una stanza privata — o Diretta, o comunque mai pubblicata —
// il campo restava assente e valeva il ripiego Lua: DIECI. L'undicesimo
// si sentiva rispondere "La stanza e al completo" in una stanza creata
// per venti, e non c'era modo di indovinarlo dal codice JavaScript,
// perche il numero che comandava stava dentro una stringa Lua.
//
// Nessuno se n'era accorto perche il collaudo a due dispositivi non ci
// arriva: per vederlo servono undici persone in una stanza privata.
// ═══════════════════════════════════════════════════════════════

describe('9 · i quattro tipi di stanza, scritti una volta sola', () => {

  it('l\'elenco e uno, e sono quei quattro', () => {
    expect([...TIPI_STANZA].sort()).toEqual(['private', 'protected', 'public', 'temporary']);
  });

  it('un tipo inventato ricade su "public", non passa', () => {
    expect(normalizzaTipoStanza('superstanza')).toBe('public');
    expect(normalizzaTipoStanza(undefined)).toBe('public');
    expect(normalizzaTipoStanza('private')).toBe('private');
  });

  it('solo la stanza privata resta fuori dalla vetrina', () => {
    expect(vaInVetrina('private')).toBe(false);
    for (const t of ['public', 'protected', 'temporary']) {
      expect({ t, vetrina: vaInVetrina(t) }).toEqual({ t, vetrina: true });
    }
    // Un valore fuori elenco diventa 'public': in vetrina ci va.
    expect(vaInVetrina('boh')).toBe(true);
  });

  it('e solo "protected" fa bussare', () => {
    expect(richiedeApprovazione('protected')).toBe(true);
    for (const t of ['public', 'private', 'temporary', 'boh']) {
      expect({ t, bussa: richiedeApprovazione(t) }).toEqual({ t, bussa: false });
    }
  });

  it('nessuno dei due file tiene piu un elenco suo', () => {
    // Erano due array separati della stessa cosa. Il giorno in cui se ne
    // aggiungeva uno da una parte sola, il server lo ricadeva in silenzio
    // su 'public': cioe pubblicava in vetrina una stanza che l'utente
    // aveva chiesto di tenere fuori.
    const sheet = senzaCommenti(leggi('app/components/CreateRoomSheet.js'));
    const rotta = senzaCommenti(leggi('app/api/mondo/route.js'));
    expect(sheet).toContain('TIPI_STANZA');
    expect(rotta).not.toContain("const ROOM_TYPES = [");
    expect(rotta).toContain('normalizzaTipoStanza(');
  });

  it('client e server chiedono "va in vetrina?" allo stesso posto', () => {
    for (const f of ['app/page.js', 'app/api/mondo/route.js']) {
      expect({ f, usa: senzaCommenti(leggi(f)).includes('vaInVetrina(') }).toEqual({ f, usa: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
describe('10 · quanti ci stanno: il numero che decideva era il terzo', () => {

  it('i limiti sono quattro numeri, in un posto solo', () => {
    expect(CAPIENZA).toEqual({ MIN: 2, MAX: 50, PREDEFINITA: 20, DIRETTA: 2 });
  });

  it('senza scelta si prende il predefinito, non il ripiego di Redis', () => {
    // E qui che stava il difetto: `null` significava 20 per la UI e
    // per /api/mondo, e 10 per lo script che fa entrare.
    expect(normalizzaCapienza(null)).toBe(20);
    expect(normalizzaCapienza(undefined)).toBe(20);
    expect(normalizzaCapienza(0)).toBe(20);
    expect(normalizzaCapienza('cinquanta')).toBe(20);
  });

  it('e la scelta dell\'host si rispetta, dentro i limiti', () => {
    expect(normalizzaCapienza(5)).toBe(5);
    expect(normalizzaCapienza(50)).toBe(50);
    expect(normalizzaCapienza(1)).toBe(2);      // sotto il minimo
    expect(normalizzaCapienza(9999)).toBe(50);  // sopra il massimo
  });

  it('la Diretta e uno-a-uno, qualunque numero le si passi', () => {
    // useWebRTC ha una connessione sola: il terzo non riceve e non manda
    // niente, in silenzio, dentro una stanza che gli promette riservatezza.
    expect(normalizzaCapienza(50, { diretta: true })).toBe(2);
    expect(normalizzaCapienza(null, { diretta: true })).toBe(2);
  });

  it('lo script Lua non tiene piu un numero suo', () => {
    // Il ripiego valeva 10 mentre la UI ne prometteva 20, e i due numeri
    // stavano in due linguaggi diversi: nessuna ricerca in JavaScript
    // poteva metterli a confronto.
    expect(JOIN_ROOM).toContain(`or ${CAPIENZA.PREDEFINITA}`);
    expect(JOIN_ROOM).toContain(`if tetto < ${CAPIENZA.MIN} then`);
    expect(JOIN_ROOM).toContain(`if tetto > ${CAPIENZA.MAX} then`);
    expect(JOIN_ROOM).not.toContain('or 10');
  });

  it('la stanza nasce col tetto gia scritto: il ripiego non serve piu', () => {
    // La causa vera. `createRoom` non scriveva il campo, e l'unico che lo
    // scriveva era la pubblicazione in vetrina — che una stanza privata
    // non fa mai.
    const store = senzaCommenti(leggi('app/lib/store.js'));
    const creaFino = store.slice(store.indexOf('export async function createRoom'),
                                 store.indexOf('export async function getRoom'));
    expect(creaFino).toContain('maxPartecipanti: normalizzaCapienza(');
  });

  it('e la scelta dell\'host arriva fino alla stanza, non solo alla vetrina', () => {
    expect(senzaCommenti(leggi('app/hooks/useRoomPolling.js'))).toContain('maxPartecipanti,');
    expect(senzaCommenti(leggi('app/api/room/route.js'))).toContain('maxPartecipanti: body.maxPartecipanti');
    expect(senzaCommenti(leggi('app/page.js'))).toContain('roomConfig.maxParticipants');
  });

  it('nessuno dei tre punti riscrive piu il clamp a mano', () => {
    for (const f of ['app/api/mondo/route.js', 'app/lib/store.js', 'app/components/CreateRoomSheet.js']) {
      const s = senzaCommenti(leggi(f));
      expect({ f, clamp: /Math\.min\(50/.test(s) }).toEqual({ f, clamp: false });
      expect({ f, usa: s.includes('normalizzaCapienza') || s.includes('CAPIENZA.') })
        .toEqual({ f, usa: true });
    }
  });

  it('"la stanza e piena?" usa lo stesso tetto dello script', () => {
    const membri = (n) => Array.from({ length: n }, (_, i) => ({ name: `p${i}` }));
    expect(stanzaPiena({ members: membri(19), maxPartecipanti: 20 })).toBe(false);
    expect(stanzaPiena({ members: membri(20), maxPartecipanti: 20 })).toBe(true);
    // Senza campo: 20, non 10. Era esattamente il caso della stanza privata.
    expect(stanzaPiena({ members: membri(10) })).toBe(false);
    expect(stanzaPiena({ members: membri(20) })).toBe(true);
    // In Diretta si sta in due.
    expect(stanzaPiena({ members: membri(2), diretta: true, maxPartecipanti: 50 })).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
describe('11 · chi fa parte della stanza: cinque copie della stessa riga', () => {

  const stanza = {
    members: [
      { name: 'Luca', role: 'host' },
      { name: 'Anna', role: 'guest' },
      { name: 'Bo' },
    ],
  };

  it('la risposta e una, e guarda l\'elenco vero', () => {
    expect(eMembro(stanza, 'Luca')).toBe(true);
    expect(eMembro(stanza, 'Anna')).toBe(true);
    expect(eMembro(stanza, 'Carla')).toBe(false);
  });

  it('senza stanza, senza elenco o senza nome, e sempre no', () => {
    expect(eMembro(null, 'Luca')).toBe(false);
    expect(eMembro({}, 'Luca')).toBe(false);
    expect(eMembro(stanza, '')).toBe(false);
    expect(eMembro(stanza, undefined)).toBe(false);
  });

  it('il confronto di appartenenza e ALLA LETTERA, e non e una svista', () => {
    // `eMembro` chiede "esiste questa VOCE nell'elenco?", e l'elenco lo
    // scrive lo script Lua con `m.name == name`: normalizzare qui vorrebbe
    // dire essere piu permissivi del punto che crea il dato.
    // (La moderazione, invece, da b.195 non guarda piu il nome affatto:
    // solo il ruolo firmato — vedi la sezione 4.)
    expect(eMembro(stanza, 'luca')).toBe(false);
    expect(puoModerare({ identita: { name: 'LUCA', role: 'guest' }, stanza: { host: 'Luca' } })).toBe(false);
    expect(JOIN_ROOM).toContain('if m.name == name then');
  });

  it('il ruolo si legge dallo stesso elenco, e chi non c\'e e ospite', () => {
    expect(ruoloDi(stanza, 'Luca')).toBe('host');
    expect(ruoloDi(stanza, 'Anna')).toBe('guest');
    expect(ruoloDi(stanza, 'Bo')).toBe('guest');      // voce senza ruolo
    expect(ruoloDi(stanza, 'Carla')).toBe('guest');   // non c'e proprio
    expect(membroDi(stanza, 'Carla')).toBe(null);
  });

  it('nessuno dei cinque punti riscrive piu `members.some(...)`', () => {
    // roomActions.js (due volte) e /api/messages (tre): cinque copie
    // della stessa riga sono cinque occasioni di correggerne quattro.
    for (const f of ['app/lib/roomActions.js', 'app/api/messages/route.js']) {
      const s = senzaCommenti(leggi(f));
      expect({ f, copia: /members\.some\(\s*m\s*=>\s*m\.name\s*===/.test(s) })
        .toEqual({ f, copia: false });
      expect({ f, usa: s.includes('eMembro(') }).toEqual({ f, usa: true });
    }
  });

  it('e /api/messages lo chiede tre volte allo stesso posto', () => {
    // POST, PATCH e GET: tre porte, una regola.
    const s = senzaCommenti(leggi('app/api/messages/route.js'));
    expect((s.match(/eMembro\(/g) || []).length).toBe(3);
  });
});
