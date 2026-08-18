// ═══════════════════════════════════════════════════════════════
// b.248 — LA VOCE SEGUE L'IDENTITA, NON IL CONTENUTO
//
// b.247 ha dato ai messaggi un identificativo vero che nasce alla
// cattura e viaggia fino allo schermo. Ma il dedup del TTS era rimasto
// a prima: riconosceva un "doppione" dal CONTENUTO, su due strati.
//
//  1. useRoomPolling.processIncomingMessage —
//     `sender | original.substring(0,20) | finestra di 30 s`.
//     Due messaggi REALMENTE DIVERSI dello stesso mittente che
//     cominciano uguale ("Va bene, ci vediamo domani alle otto" /
//     "...alle nove", entro 30 s) avevano la stessa impronta: la voce
//     del secondo spariva senza un errore.
//
//  2. useAudioSystem.queueAudio —
//     `text.substring(0,60) | lang`, sempre con scadenza a 30 s.
//     Anche aggiustato lo strato 1, la stessa frase detta due volte
//     ("si" e poi ancora "si") veniva zittita qui.
//
// La correzione: l'impronta e l'IDENTIFICATIVO del messaggio —
// `clientId` (l'id di cattura, che la copia del server conserva) o,
// in mancanza, `id`. Un id gia letto non si rilegge; un id NUOVO si
// legge SEMPRE, qualunque sia il testo. Il confronto sul contenuto
// resta SOLO per i messaggi senza alcun id (client vecchi), e li si
// confronta il testo INTERO, non un prefisso.
//
// Il motivo per cui l'impronta sul contenuto esisteva era il doppio
// arrivo dello STESSO messaggio da piu canali (P2P + Realtime +
// polling, anche a ~50 ms di distanza) e con DUE id diversi (il
// `tmp_...` del broadcast e l'id server del polling). La sezione 2
// dimostra che quella protezione e ancora in piedi: la copia del
// server si riconosce dal `clientId`, che e lo stesso id di cattura.
//
// I test delle sezioni 1, 3 e 4 sarebbero stati ROSSI prima di b.248
// (verificato rimettendo l'impronta sul contenuto). La sezione 2 era
// gia verde e sta qui perche il fix non deve indebolirla.
//
// NOTA ONESTA: si montano gli hook veri con la coda audio e il motore
// TTS finti: si conta COSA viene mandato a leggere, non il suono.
// La conferma finale resta il collaudo dal vivo a due telefoni.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

vi.mock('../app/lib/constants.js', () => ({
  getLang: (code) => ({ code: code || 'en', name: code || 'en', speech: 'en-US' }),
  CONTEXTS: [],
  LIVE_TEXT_THROTTLE: 200,
  TYPING_TIMEOUT: 3000,
  SPEAKING_TIMEOUT: 20000,
}));

// Realtime non serve: i messaggi si consegnano a mano con
// `addIncomingMessage`, come farebbero P2P e broadcast.
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

// La coda audio si sostituisce con una spia: `accoda` E' la lettura.
const accodaSpy = vi.fn();
vi.mock('../app/lib/codaAudio.js', () => ({
  creaCodaAudio: () => ({
    accoda: (...args) => accodaSpy(...args),
    attiva: () => true,
    inCoda: () => 0,
    svuota: vi.fn(),
    tronca: vi.fn(),
  }),
}));

// Il motore TTS non deve toccare rete ne altoparlanti.
vi.mock('../app/hooks/useTTSEngine.js', () => ({
  default: () => ({
    procuraVoce: vi.fn(async () => null),
    suonaVoce: vi.fn(async () => {}),
    playEdgeTTS: vi.fn(),
    playTTSElevenLabs: vi.fn(),
    playTTS: vi.fn(),
    checkVoiceAvailability: vi.fn(),
  }),
}));
vi.mock('../app/lib/audioPrefs.js', () => ({ getVolumeTTS: () => 1 }));

import useRoomPolling from '../app/hooks/useRoomPolling.js';
import useAudioSystem from '../app/hooks/useAudioSystem.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Timestamp fissi DENTRO la stessa finestra di 30 s: il vecchio dedup
// deve poter scattare, cosi il rosso-prima non dipende dall'orologio.
const T0 = 1700000010000; // 1700000010000 / 30000 = 56666667 esatto

function montaPolling(queueAudio) {
  return renderHook(() => useRoomPolling({
    prefsRef: { current: { name: 'Alice' } },
    myLangRef: { current: 'en' },
    roomInfoRef: { current: null },
    queueAudio,
    getEffectiveToken: () => 'gettone',
    onMessageReceived: vi.fn(),
  }));
}

// Un messaggio di Bob gia tradotto nella lingua di Alice: la lettura
// deve partire appena arriva.
const messaggioDiBob = (id, original, extra = {}) => ({
  id, sender: 'Bob', original,
  translations: { en: `[en] ${original}` },
  sourceLang: 'it', targetLang: 'en',
  timestamp: T0 + 1000,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
});

// ───────────────────────────────────────────────────────────────
describe('1 · due messaggi DIVERSI con lo stesso attacco: due voci', () => {

  it('stesso mittente, stessi primi 20 caratteri, entro 30 secondi: si leggono TUTTI E DUE', async () => {
    // ROSSO prima di b.248: l'impronta `sender|primi 20|finestra` era
    // identica e la voce del secondo spariva.
    const queueAudio = vi.fn();
    const { result } = montaPolling(queueAudio);

    await act(async () => {
      result.current.addIncomingMessage(messaggioDiBob('tmp_1700000000000_capa1', 'Va bene, ci vediamo domani alle otto'));
      result.current.addIncomingMessage(messaggioDiBob('tmp_1700000000000_capa2', 'Va bene, ci vediamo domani alle nove'));
    });

    expect(queueAudio).toHaveBeenCalledTimes(2);
    const testi = queueAudio.mock.calls.map(([testo]) => testo);
    expect(testi[0]).toContain('alle otto');
    expect(testi[1], 'la voce del secondo non deve sparire').toContain('alle nove');
  });

  it('perfino il testo IDENTICO, se gli id sono diversi, sono due messaggi', async () => {
    // "Si." detto due volte di fila: b.247 garantisce due id di cattura
    // diversi, quindi sono due eventi veri e vanno letti tutti e due.
    const queueAudio = vi.fn();
    const { result } = montaPolling(queueAudio);

    await act(async () => {
      result.current.addIncomingMessage(messaggioDiBob('tmp_1700000000000_capa3', 'Si.'));
      result.current.addIncomingMessage(messaggioDiBob('tmp_1700000000000_capa4', 'Si.'));
    });

    expect(queueAudio).toHaveBeenCalledTimes(2);
  });
});

// ───────────────────────────────────────────────────────────────
describe('2 · lo STESSO messaggio da tre canali: una voce sola', () => {

  it('P2P, Realtime e polling consegnano lo stesso id: una lettura', async () => {
    // Era il motivo di vita della vecchia impronta: P2P e Realtime
    // arrivano a ~50 ms, e il polling porta la COPIA DEL SERVER con un
    // id suo ma lo stesso `clientId`. Il fix deve coprire ESATTAMENTE
    // questo caso: tre arrivi, una voce.
    const queueAudio = vi.fn();
    const { result } = montaPolling(queueAudio);
    const idCattura = 'tmp_1700000000000_capa5';

    await act(async () => {
      // 1° canale: P2P (DataChannel)
      result.current.addIncomingMessage(messaggioDiBob(idCattura, 'Benvenuto al bar'));
      // 2° canale: broadcast Realtime, ~50 ms dopo, stesso id
      result.current.addIncomingMessage(messaggioDiBob(idCattura, 'Benvenuto al bar'));
      // 3° canale: il polling porta la copia del server — id NUOVO,
      // ma il `clientId` e l'id di cattura (b.247, /api/messages).
      result.current.addIncomingMessage(messaggioDiBob('srv-abc123', 'Benvenuto al bar', { clientId: idCattura }));
    });

    expect(queueAudio, 'tre arrivi dello stesso messaggio = una sola voce').toHaveBeenCalledTimes(1);
  });
});

// ───────────────────────────────────────────────────────────────
describe('3 · messaggio senza alcun id: il ripiego sul testo intero', () => {

  it('un messaggio senza id si legge lo stesso', async () => {
    // ROSSO prima di b.248: `if (!msg.id) return` — un client vecchio
    // senza identificativi restava MUTO del tutto.
    const queueAudio = vi.fn();
    const { result } = montaPolling(queueAudio);

    await act(async () => {
      result.current.addIncomingMessage(messaggioDiBob(undefined, 'Ciao a tutti quanti'));
    });

    expect(queueAudio).toHaveBeenCalledTimes(1);
  });

  it('e nel sorgente il ripiego confronta il testo INTERO, non un prefisso', () => {
    const s = senzaCommenti(leggi('app/hooks/useRoomPolling.js'));
    // La vecchia impronta sui primi 20 caratteri non deve esistere piu.
    expect(s).not.toMatch(/original\?\.substring\(0,\s*20\)/);
    expect(s).not.toMatch(/contentFingerprint/);
    // L'identificativo viene prima: la copia del server si riconosce
    // dal clientId, che e l'id di cattura.
    expect(s).toMatch(/msg\.clientId \|\| msg\.id/);
    // E il ripiego usa `msg.original` intero, senza tagli.
    expect(s).toMatch(/\$\{msg\.sender\}\|\$\{msg\.original\}/);
  });
});

// ───────────────────────────────────────────────────────────────
describe('4 · anche la coda audio rispetta gli id (useAudioSystem)', () => {

  function montaAudio() {
    return renderHook(() => useAudioSystem({
      prefsRef: { current: { voiceEngine: 'openai' } },
      myLangRef: { current: 'en' },
      isTrialRef: { current: false },
      isTopProRef: { current: false },
      canUseElevenLabsRef: { current: false },
      selectedELVoice: '',
      clonedVoiceIdRef: { current: null },
      roomIdRef: { current: 'stanza-1' },
      roomSessionTokenRef: { current: null },
      getEffectiveToken: () => null,
    }));
  }

  it('stesso testo con due id diversi: due letture', async () => {
    // ROSSO prima di b.248: la `contentKey` sui primi 60 caratteri
    // zittiva la seconda anche con l'id nuovo.
    const { result } = montaAudio();

    await act(async () => {
      await result.current.queueAudio('Va bene, ci vediamo domani', 'en-US', 'tmp_1700000000000_capa6');
      await result.current.queueAudio('Va bene, ci vediamo domani', 'en-US', 'tmp_1700000000000_capa7');
    });

    expect(accodaSpy).toHaveBeenCalledTimes(2);
  });

  it('lo stesso id ripresentato non si rilegge, nemmeno dopo', async () => {
    const { result } = montaAudio();

    await act(async () => {
      await result.current.queueAudio('Benvenuto al bar', 'en-US', 'tmp_1700000000000_capa8');
      await result.current.queueAudio('Benvenuto al bar', 'en-US', 'tmp_1700000000000_capa8');
      await result.current.queueAudio('Benvenuto al bar', 'en-US', 'tmp_1700000000000_capa8');
    });

    expect(accodaSpy).toHaveBeenCalledTimes(1);
  });

  it('senza id il ripiego guarda il testo INTERO: due frasi uguali fino al 60° carattere sono due frasi', async () => {
    // ROSSO prima di b.248: `substring(0,60)` — due frasi lunghe con lo
    // stesso inizio diventavano "la stessa" e la seconda spariva.
    const { result } = montaAudio();
    const attacco = 'Questa frase comincia esattamente come la prossima e supera i sessanta caratteri, ';

    await act(async () => {
      await result.current.queueAudio(`${attacco}poi dice otto`, 'en-US');
      await result.current.queueAudio(`${attacco}poi dice nove`, 'en-US');
      // Ma il testo DAVVERO identico, senza id, resta un doppione:
      // senza identita non c'e modo di distinguere, meglio una voce in
      // meno che la stessa frase due volte.
      await result.current.queueAudio(`${attacco}poi dice otto`, 'en-US');
    });

    expect(accodaSpy).toHaveBeenCalledTimes(2);
  });

  it('e nel sorgente il taglio a 60 caratteri non esiste piu', () => {
    const s = senzaCommenti(leggi('app/hooks/useAudioSystem.js'));
    expect(s).not.toMatch(/substring\(0,\s*60\)/);
  });
});
