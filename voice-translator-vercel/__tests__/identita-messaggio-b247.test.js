// ═══════════════════════════════════════════════════════════════
// b.247 — L'IDENTITA DI UN MESSAGGIO NON E IL SUO TESTO
//
// Due difetti verificati riga per riga in app/hooks/useTranslationAPI.js,
// tutti e due nati dalla stessa idea sbagliata: riconoscere un messaggio
// dal contenuto invece che da un identificativo.
//
//  1. `idSpedizioneRef.current.set(original, tempId)` — la mappa era
//     TESTO → id. Chi scriveva "ok" due volte perdeva l'identita del
//     primo messaggio: la seconda voce sovrascriveva la chiave. Quando
//     le traduzioni tornavano fuori ordine, la PATCH del PRIMO messaggio
//     partiva con l'identificativo del SECONDO — e la traduzione si
//     posava sul messaggio sbagliato.
//
//  2. `original === lastSentTextRef.current.testo && ora - quando < 2500`
//     — il freno anti doppio invio. Serviva per il doppio scatto (il VAD
//     manda da solo dopo il silenzio, il dito preme il tasto), ma non
//     sapeva distinguerlo da una persona che dice davvero "si" due volte
//     di fila: il secondo "si" spariva senza un errore. E' lo stesso
//     difetto corretto sul server in b.126 (/api/messages), rimasto in
//     piedi sul client.
//
// La correzione: l'identificativo dell'EVENTO di cattura nasce dove il
// testo viene raccolto (useTranslation.js) e viaggia intero — creazione,
// traduzione, aggiornamento, invio — senza mai essere ricostruito dal
// contenuto.
//
// I test 1, 3, 4 e 5 sarebbero stati ROSSI prima di b.247. I test 2 e 6
// erano gia verdi e stanno qui per dimostrare che la protezione contro
// il doppio scatto NON e stata indebolita.
//
// C'era anche un TERZO punto con lo stesso vizio, a valle: in
// useRoomPolling.js sia `updateLocalMessage` sia `handleMessageUpdate`
// cercavano il messaggio in elenco con `findIndex(sender + original)`,
// che si ferma al PRIMO che combacia. Anche con gli identificativi
// giusti in viaggio, A SCHERMO la traduzione del secondo di due
// messaggi identici si posava comunque sul primo. Corretto qui sotto
// (sezione 7): l'identificativo viene prima, il testo resta come
// ripiego per i messaggi che non ce l'hanno.
//
// NOTA ONESTA: questi test montano gli hook veri e guardano cosa parte
// verso la rete e cosa finisce nell'elenco dei messaggi. Non aprono due
// telefoni: la conferma finale resta il collaudo dal vivo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

vi.mock('../app/lib/constants.js', () => ({
  getLang: (code) => ({ code: code || 'en', name: code || 'en', speech: 'en-US' }),
  FREE_DAILY_LIMIT: 5000,
  CONTEXTS: [],
  LIVE_TEXT_THROTTLE: 200,
  TYPING_TIMEOUT: 3000,
  SPEAKING_TIMEOUT: 20000,
}));

// Realtime non serve a questi test (guardano l'elenco locale): si stacca
// il canale per non trascinarsi dietro il client Supabase.
vi.mock('../app/hooks/useRealtimeRoom.js', () => ({
  default: () => ({
    connected: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    broadcastMessage: vi.fn(),
    broadcastMessageUpdate: vi.fn(),
    broadcastAck: vi.fn(),
    broadcastRead: vi.fn(),
    broadcastSpeaking: vi.fn(),
    broadcastMemberUpdate: vi.fn(),
    broadcastHeartbeat: vi.fn(),
  }),
}));

import useTranslationAPI from '../app/hooks/useTranslationAPI.js';
import useRoomPolling from '../app/hooks/useRoomPolling.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const mockFetch = vi.fn();
global.fetch = mockFetch;

function props(extra = {}) {
  return {
    myLangRef: { current: 'en' },
    roomInfoRef: { current: { members: [{ name: 'Alice', lang: 'en' }, { name: 'Bob', lang: 'it' }] } },
    prefsRef: { current: { name: 'Alice' } },
    roomId: 'stanza-1',
    roomContextRef: { current: {} },
    isTrialRef: { current: false },
    freeCharsRef: { current: 0 },
    useOwnKeys: false,
    getEffectiveToken: () => 'gettone',
    refreshBalance: vi.fn(),
    trackFreeChars: vi.fn(),
    userEmail: 'alice@example.com',
    sentByMeRef: { current: new Set() },
    roomSessionTokenRef: { current: 'rst-1' },
    updateLocalMessage: vi.fn(),
    addLocalMessage: vi.fn(),
    ...extra,
  };
}

// Gli identificativi hanno il formato che /api/messages accetta
// (`^tmp_[\w-]{1,60}$`): uno diverso verrebbe rifiutato dal server, e il
// client ricadrebbe in silenzio sulla ricerca per contenuto.
const idCattura = (n) => `tmp_1700000000000_cattura${n}`;

const corpiVerso = (rotta, metodo) =>
  mockFetch.mock.calls
    .filter(([url, opz]) => url === rotta && opz?.method === metodo)
    .map(([, opz]) => JSON.parse(opz.body));

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ message: { id: 'srv-1' } }) });
});

// ───────────────────────────────────────────────────────────────
describe('1 · due frasi uguali sono due messaggi, non un doppione', () => {

  it('"si" detto due volte di fila parte due volte', async () => {
    // ROSSO prima di b.247: il secondo invio cadeva nel freno sul testo
    // ("stesso testo entro 2,5 s") e spariva. Qui i due invii distano
    // pochi millisecondi, cioe il caso peggiore.
    const { result } = renderHook(() => useTranslationAPI(props()));

    let primo, secondo;
    await act(async () => {
      primo = await result.current.sendMessage('si', null, 'en', 'it', null, { idCattura: idCattura(1) });
      secondo = await result.current.sendMessage('si', null, 'en', 'it', null, { idCattura: idCattura(2) });
    });

    expect(primo, 'il primo "si" parte').toBeTruthy();
    expect(secondo, 'e anche il secondo: e una cattura diversa').toBeTruthy();
    expect(primo.message.id).not.toBe(secondo.message.id);
    expect(corpiVerso('/api/messages', 'POST')).toHaveLength(2);
  });

  it('e i due messaggi arrivano al server con identificativi diversi', async () => {
    // ROSSO prima: `sendMessage` si fabbricava un `tempId` per conto suo
    // e ignorava l'origine, quindi l'identificativo della cattura non
    // arrivava da nessuna parte.
    const { result } = renderHook(() => useTranslationAPI(props()));

    await act(async () => {
      await result.current.sendMessage('ok', null, 'en', 'it', null, { idCattura: idCattura(1) });
      await result.current.sendMessage('ok', null, 'en', 'it', null, { idCattura: idCattura(2) });
    });

    const inviati = corpiVerso('/api/messages', 'POST').map((c) => c.clientId);
    expect(inviati).toEqual([idCattura(1), idCattura(2)]);
  });
});

// ───────────────────────────────────────────────────────────────
describe('2 · ma il doppio scatto resta bloccato', () => {

  it('la stessa cattura mandata due volte passa una volta sola', async () => {
    // Il caso vero per cui il freno era nato: l'auto-invio del VAD e il
    // tocco sul tasto partono quasi insieme sulla STESSA cattura.
    const { result } = renderHook(() => useTranslationAPI(props()));

    let primo, secondo;
    await act(async () => {
      primo = await result.current.sendMessage('si', null, 'en', 'it', null, { idCattura: idCattura(9) });
      secondo = await result.current.sendMessage('si', null, 'en', 'it', null, { idCattura: idCattura(9) });
    });

    expect(primo).toBeTruthy();
    expect(secondo, 'stesso evento: e un doppione').toBeNull();
    expect(corpiVerso('/api/messages', 'POST')).toHaveLength(1);
  });

  it('e chi non dichiara l\'origine tiene la vecchia protezione', async () => {
    // Nessun identificativo = non c'e modo di distinguere. Meglio la
    // vecchia regola sul testo che nessuna protezione: toglierla del
    // tutto avrebbe fatto ricomparire i messaggi raddoppiati.
    const { result } = renderHook(() => useTranslationAPI(props()));

    let primo, secondo;
    await act(async () => {
      primo = await result.current.sendMessage('si', null, 'en', 'it', null);
      secondo = await result.current.sendMessage('si', null, 'en', 'it', null);
    });

    expect(primo).toBeTruthy();
    expect(secondo).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────
describe('3 · la traduzione si posa sul messaggio giusto', () => {

  it('la fase 2 del PRIMO messaggio non colpisce il secondo', async () => {
    // ROSSO prima di b.247, ed e il difetto piu grave del giro.
    // La mappa era TESTO → id: dopo il secondo "ok" la chiave "ok"
    // puntava al SECONDO messaggio. La traduzione del primo, arrivando
    // in ritardo (succede: sono due chiamate in parallelo), leggeva la
    // mappa e riscriveva il secondo.
    const { result } = renderHook(() => useTranslationAPI(props()));

    await act(async () => {
      await result.current.sendMessage('ok', null, 'en', 'it', null, { idCattura: idCattura(1) });
      await result.current.sendMessage('ok', null, 'en', 'it', null, { idCattura: idCattura(2) });
      // La traduzione del PRIMO torna per ultima.
      result.current.sendTranslationUpdate('ok', 'va bene', 'en', 'it', { it: 'va bene' }, { clientId: idCattura(1) });
    });

    const patch = corpiVerso('/api/messages', 'PATCH');
    expect(patch).toHaveLength(1);
    expect(patch[0].clientId, 'la PATCH deve nominare il PRIMO messaggio').toBe(idCattura(1));
    expect(patch[0].clientId).not.toBe(idCattura(2));
  });

  it('l\'aggiornamento verso l\'altro telefono porta lo stesso identificativo', async () => {
    // ROSSO prima: `handleMessageUpdate` (useRoomPolling) legge gia
    // `tempId` per non applicare due volte lo stesso aggiornamento, ma
    // nessuno glielo mandava e ripiegava su `sender|original`. Con due
    // messaggi uguali quella chiave era la stessa: il secondo
    // aggiornamento veniva scartato come doppione.
    const sendDirectMessage = vi.fn();
    const { result } = renderHook(() => useTranslationAPI(props({ sendDirectMessage })));

    await act(async () => {
      await result.current.sendMessage('ok', null, 'en', 'it', null, { idCattura: idCattura(3) });
      result.current.sendTranslationUpdate('ok', 'va bene', 'en', 'it', { it: 'va bene' }, { clientId: idCattura(3) });
    });

    const aggiornamento = sendDirectMessage.mock.calls
      .map(([m]) => m)
      .find((m) => m.type === 'message-update');
    expect(aggiornamento).toBeTruthy();
    expect(aggiornamento.tempId).toBe(idCattura(3));
  });

  it('senza identificativo la fase 2 non se lo inventa dal testo', async () => {
    // ROSSO prima: `clientId: idSpedizioneRef.current.get(original)`
    // ricostruiva l'identita dal contenuto. Ora, se non arriva, si manda
    // vuoto e decide il server col suo ripiego dichiarato — meglio un
    // ripiego visibile di un'identita indovinata.
    const { result } = renderHook(() => useTranslationAPI(props()));

    await act(async () => {
      await result.current.sendMessage('ok', null, 'en', 'it', null, { idCattura: idCattura(1) });
      result.current.sendTranslationUpdate('ok', 'va bene', 'en', 'it', { it: 'va bene' });
    });

    const patch = corpiVerso('/api/messages', 'PATCH');
    expect(patch[0].clientId).toBe('');
    expect(patch[0].original, 'resta il ripiego per i server vecchi').toBe('ok');
  });
});

// ───────────────────────────────────────────────────────────────
describe('4 · il registro delle spedizioni e cambiato di verso', () => {
  const api = () => senzaCommenti(leggi('app/hooks/useTranslationAPI.js'));

  it('non si annota piu il testo come chiave', () => {
    expect(api(), 'la mappa TESTO → id era il difetto')
      .not.toMatch(/idSpedizioneRef\.current\.set\(original\b/);
    expect(api(), 'ne si rilegge per contenuto')
      .not.toMatch(/idSpedizioneRef\.current\.get\(original\)/);
  });

  it('la chiave e l\'identificativo della spedizione', () => {
    expect(api()).toMatch(/idSpedizioneRef\.current\.set\(tempId,/);
  });

  it('e il registro non cresce all\'infinito', () => {
    // Stessa regola della posta in uscita (b.111): una mappa che cresce
    // sempre e una perdita di memoria con un altro nome.
    expect(api()).toMatch(/idSpedizioneRef\.current\.size > 50/);
  });
});

// ───────────────────────────────────────────────────────────────
describe('5 · l\'identificativo nasce dove nasce il testo', () => {
  const orch = () => senzaCommenti(leggi('app/hooks/useTranslation.js'));

  it('una dettatura nuova apre una cattura nuova', () => {
    // E' il punto in cui due "si" di fila diventano due eventi: il modo
    // mani libere svuota il magazzino delle parole dopo ogni invio.
    expect(orch()).toMatch(/if \(!allWordsRef\.current\) apriCattura\(\);/);
  });

  it('un blocco audio e una cattura sua', () => {
    const s = orch();
    expect(s).toMatch(/const idCattura = nuovoIdCattura\(\);/);
    // b.289 — con targetLangs vuoto il messaggio parte nella lingua di
    // chi parla: il controllo segue la nuova forma protetta dal vuoto.
    // b.486 — la riga ha guadagnato `soloOriginale`: si difende che
    // l'identificativo viaggi con la fase 1, non la riga fotografata.
    expect(s).toMatch(/sendMessage\(original, null, myL\.code, primaryTarget\?\.code \|\| myL\.code, null, \{ idCattura[^}]*\}\)/);
  });

  it('e lo stesso identificativo copre fase 1 e fase 2', () => {
    const s = orch();
    // b.363 — la prova pretendeva che le opzioni della fase 1 contenessero
    // SOLO l'identificativo. Da oggi accanto viaggia anche il messaggio
    // citato (la risposta con citazione), che non c'entra nulla con
    // l'identita: pretendere la parentesi vuota faceva fallire una cosa
    // giusta. Resta invariato cio che questa prova difende: e' lo STESSO
    // identificativo a coprire fase 1 e fase 2, mai ricostruito dal testo.
    expect(s).toMatch(/sendMessage\(text, null, myL\.code, primaryTargetLang, null, \{ idCattura[,\s}][^}]*\}\)/);
    expect(s).toMatch(/sendTranslationUpdate\(text, primaryTranslated, myL\.code, finalTargetLang, translations, \{ clientId: idCattura \}\)/);
  });

  it('il formato e quello che il server accetta', () => {
    // Un identificativo fuori formato verrebbe scartato da /api/messages
    // e il client tornerebbe a farsi riconoscere dal contenuto senza
    // dirlo a nessuno.
    expect(orch()).toMatch(/`tmp_\$\{Date\.now\(\)\}_\$\{crypto\.randomUUID\(\)\.slice\(0, 8\)\}`/);
    expect(senzaCommenti(leggi('app/hooks/useTranslationAPI.js')))
      .toMatch(/FORMATO_ID_SPEDIZIONE\.test\(opzioni\.idCattura\)/);
  });
});

// ───────────────────────────────────────────────────────────────
describe('6 · il confronto sul testo sopravvive solo dove serve', () => {

  it('nel freno c\'e una strada sola che guarda il contenuto, ed e quella senza origine', () => {
    const s = senzaCommenti(leggi('app/hooks/useTranslationAPI.js'));
    // Il confronto col testo deve stare in un ramo `else`: si arriva li
    // solo quando l'origine NON e stata dichiarata.
    expect(s).toMatch(/\} else if \(original === lastSentTextRef\.current\.testo/);
    // E il ramo con l'identificativo viene prima.
    const iId = s.indexOf('idSpedizioneRef.current.has(idDichiarato)');
    const iTesto = s.indexOf('original === lastSentTextRef.current.testo');
    expect(iId, 'il controllo per identificativo deve esistere').toBeGreaterThan(-1);
    expect(iId).toBeLessThan(iTesto);
  });

  it('in useTranslation il testo si confronta solo con la dettatura in corso', () => {
    // E' il caso vero del doppio scatto: il riquadro contiene ESATTAMENTE
    // cio che la dettatura ha prodotto. Fuori da li, nessun confronto.
    const s = senzaCommenti(leggi('app/hooks/useTranslation.js'));
    expect(s).toMatch(/c\.testoDettato\.trim\(\) === testo/);
    expect(s, 'e vale solo entro il tempo di un doppio scatto')
      .toMatch(/Date\.now\(\) - c\.spedita < 2500/);
  });
});

// ───────────────────────────────────────────────────────────────
describe('7 · a schermo la traduzione trova la nuvoletta giusta', () => {
  // L'ultimo tratto della catena: gli identificativi ormai viaggiano,
  // ma l'ELENCO dei messaggi li ignorava. `updateLocalMessage` e
  // `handleMessageUpdate` (useRoomPolling.js) cercavano con
  // `findIndex(sender + original)`, che trova sempre il PRIMO: la
  // traduzione e lo stato del secondo di due messaggi identici si
  // posavano sul primo anche con la PATCH giusta sul server.

  function montaPolling() {
    return renderHook(() => useRoomPolling({
      prefsRef: { current: { name: 'Alice' } },
      myLangRef: { current: 'en' },
      roomInfoRef: { current: null },
      queueAudio: vi.fn(),
      getEffectiveToken: () => 'gettone',
      onMessageReceived: vi.fn(),
    }));
  }

  const messaggio = (id, original) => ({
    id, sender: 'Alice', original, translated: null,
    sourceLang: 'en', targetLang: 'it', timestamp: Date.now(),
  });

  it('handleMessageUpdate aggiorna il messaggio NOMINATO, non il primo col testo uguale', async () => {
    // ROSSO prima di b.247: con due "ok" in elenco, l'aggiornamento del
    // secondo (tempId del secondo) finiva sul primo, e il secondo
    // restava per sempre senza traduzione.
    const { result } = montaPolling();

    await act(async () => {
      result.current.addLocalMessage(messaggio(idCattura(1), 'ok'));
      result.current.addLocalMessage(messaggio(idCattura(2), 'ok'));
      result.current.handleMessageUpdate({
        sender: 'Alice', original: 'ok', translated: 'va bene (secondo)',
        targetLang: 'it', translations: { it: 'va bene (secondo)' },
        timestamp: Date.now(), tempId: idCattura(2),
      });
    });

    const [primo, secondo] = result.current.messages;
    expect(secondo.translated, 'la traduzione va sul SECONDO').toBe('va bene (secondo)');
    expect(primo.translated, 'e il primo non viene toccato').toBeNull();
  });

  it('e riconosce anche la copia del server, che tiene il clientId', async () => {
    // Il polling sostituisce il messaggio `tmp_...` con la copia del
    // server, che ha un id suo ma conserva il `clientId`: una PATCH in
    // ritardo deve trovarlo lo stesso.
    const { result } = montaPolling();

    await act(async () => {
      result.current.addLocalMessage({ ...messaggio('srv-9', 'ok'), clientId: idCattura(3) });
      result.current.handleMessageUpdate({
        sender: 'Alice', original: 'ok', translated: 'va bene',
        targetLang: 'it', translations: { it: 'va bene' },
        timestamp: Date.now(), tempId: idCattura(3),
      });
    });

    expect(result.current.messages[0].translated).toBe('va bene');
  });

  it('updateLocalMessage con l\'identificativo segna lo stato sul messaggio giusto', async () => {
    // ROSSO prima: la spunta "inviato" del secondo "ok" si posava sul
    // primo — stesso findIndex, stesso vizio.
    const { result } = montaPolling();

    await act(async () => {
      result.current.addLocalMessage(messaggio(idCattura(1), 'ok'));
      result.current.addLocalMessage(messaggio(idCattura(2), 'ok'));
      result.current.updateLocalMessage('ok', 'Alice', { _status: 'inviato' }, idCattura(2));
    });

    const [primo, secondo] = result.current.messages;
    expect(secondo._status).toBe('inviato');
    expect(primo._status, 'il primo non ha ricevuto niente').toBeUndefined();
  });

  it('senza identificativo resta il vecchio criterio, per compatibilita', async () => {
    // I messaggi vecchi un identificativo non ce l'hanno: per loro il
    // ripiego sul contenuto deve continuare a funzionare come prima.
    const { result } = montaPolling();

    await act(async () => {
      result.current.addLocalMessage(messaggio('vecchio-1', 'ciao'));
      result.current.updateLocalMessage('ciao', 'Alice', { _status: 'inviato' });
      result.current.handleMessageUpdate({
        sender: 'Alice', original: 'ciao', translated: 'hello',
        targetLang: 'en', translations: { en: 'hello' }, timestamp: Date.now(),
      });
    });

    expect(result.current.messages[0]._status).toBe('inviato');
    expect(result.current.messages[0].translated).toBe('hello');
  });

  it('e nel sorgente l\'identificativo viene PRIMA del contenuto', () => {
    const s = senzaCommenti(leggi('app/hooks/useRoomPolling.js'));
    // handleMessageUpdate: prima il tempId, poi il ripiego sul testo.
    const iId = s.indexOf('m.id === data.tempId || m.clientId === data.tempId');
    const iTesto = s.indexOf('m.sender === data.sender && m.original === data.original');
    expect(iId, 'la ricerca per identificativo deve esistere').toBeGreaterThan(-1);
    expect(iId).toBeLessThan(iTesto);
    // updateLocalMessage: stessa struttura.
    expect(s).toMatch(/m\.id === msgId \|\| m\.clientId === msgId/);
  });
});
