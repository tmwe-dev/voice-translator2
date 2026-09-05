import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { urlElevenLabs, leggiMessaggioElevenLabs, chiediChiaveSTT, apriAscolto } from '../app/lib/audio/sttLive.js';

// ═══════════════════════════════════════════════════════════════
// b.637 — LA TRASCRIZIONE DAL VIVO LA FA CHI GIA CI PARLA
//
// Ordine di Luca: «noi non abbiamo bisogno di nessun servizio esterno,
// Deepgram o altra minchiata. Abbiamo gia ElevenLabs a disposizione».
//
//   ElevenLabs Scribe v2 Realtime — $0,39/ora, ~150 ms, 90+ lingue
//   Deepgram nova-2                — $0,46/ora, fornitore NUOVO
//
// E soprattutto: /api/stt-token rispondeva 503 a TUTTI, sempre, perche
// DEEPGRAM_API_KEY non e mai stata impostata in produzione (22 su 22 nei
// registri Vercel dei 7 giorni al 05/09). L'interprete in streaming —
// 687 righe scritte e provate — non e MAI partito.
// ═══════════════════════════════════════════════════════════════

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('b.637 — il gettone: ElevenLabs per primo, Deepgram come ripiego', () => {
  const rotta = leggi('app/api/stt-token/route.js');

  it('senza NESSUNA chiave si dichiara, e non si finge', () => {
    expect(rotta).toMatch(/if \(!chiaveEleven && !chiaveDeepgram\)/);
    expect(rotta).toMatch(/nessuna chiave \(ELEVENLABS_API_KEY \/ DEEPGRAM_API_KEY\)/);
  });

  it('chiede a ElevenLabs un gettone MONOUSO, non la chiave vera', () => {
    expect(rotta).toContain("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe");
    expect(rotta).toMatch(/'xi-api-key': chiaveEleven/);
    expect(rotta, 'la chiave vera non esce mai dal server').not.toMatch(/key: chiaveEleven/);
  });

  it('la risposta dice CHI trascrive', () => {
    expect(rotta).toMatch(/fornitore: 'elevenlabs'/);
    expect(rotta).toMatch(/fornitore: 'deepgram'/);
  });

  it('un guasto di ElevenLabs non spegne la trascrizione: si prova il ripiego', () => {
    const iEleven = rotta.indexOf('if (chiaveEleven) {');
    const iDeepgram = rotta.indexOf("https://api.deepgram.com/v1/keys");
    expect(iEleven).toBeGreaterThan(-1);
    expect(iDeepgram).toBeGreaterThan(iEleven);
    // fra i due non ci deve essere un `return 503` incondizionato
    const inMezzo = rotta.slice(iEleven, iDeepgram);
    expect(inMezzo).toMatch(/if \(!chiaveDeepgram\)/);
  });

  it('i cancelli di prima non si toccano: sessione, stanza, modalita Diretta, credito', () => {
    expect(rotta).toMatch(/assertElaborazioneConsentita/);
    expect(rotta).toMatch(/creditoFinito\(billingEmail, \{ failClosed: true \}\)/);
    expect(rotta).toMatch(/resolveRoomIdentity/);
    const iGate = rotta.indexOf('creditoFinito(billingEmail');
    const iEleven = rotta.indexOf('single-use-token');
    expect(iGate, 'il credito si controlla PRIMA di emettere il gettone').toBeLessThan(iEleven);
  });
});

describe('b.637 — l\'indirizzo di Scribe', () => {
  it('porta modello, formato dei campioni, lingua e il taglio sulla voce', () => {
    const u = new URL(urlElevenLabs({ lingua: 'it-IT', chiave: 'sutkn_X' }));
    expect(u.protocol).toBe('wss:');
    expect(u.host).toBe('api.elevenlabs.io');
    expect(u.pathname).toBe('/v1/speech-to-text/realtime');
    expect(u.searchParams.get('model_id')).toBe('scribe_v2_realtime');
    expect(u.searchParams.get('audio_format')).toBe('pcm_16000');
    expect(u.searchParams.get('language_code'), 'lingua ridotta a due lettere').toBe('it');
    expect(u.searchParams.get('commit_strategy'), 'il taglio delle frasi lo fa il loro rilevatore').toBe('vad');
    expect(u.searchParams.get('token')).toBe('sutkn_X');
  });

  it('senza lingua non inventa un language_code', () => {
    const u = new URL(urlElevenLabs({ chiave: 'K' }));
    expect(u.searchParams.has('language_code')).toBe(false);
  });
});

describe('b.637 — i messaggi di Scribe, nello stesso contratto di prima', () => {
  it('partial_transcript = testo in corsa', () => {
    expect(leggiMessaggioElevenLabs(JSON.stringify({ message_type: 'partial_transcript', text: 'ciao co' })))
      .toEqual({ tipo: 'testo', transcript: 'ciao co', isFinal: false });
  });

  it('committed_transcript = frase finita, e vale ANCHE come fine frase', () => {
    const m = leggiMessaggioElevenLabs(JSON.stringify({ message_type: 'committed_transcript', text: 'ciao come stai' }));
    expect(m.tipo).toBe('testo');
    expect(m.isFinal).toBe(true);
    expect(m.fineFrase, 'con commit_strategy=vad la frase chiusa E la fine frase').toBe(true);
  });

  it('un partial vuoto non e niente; la spazzatura non esplode', () => {
    expect(leggiMessaggioElevenLabs(JSON.stringify({ message_type: 'partial_transcript', text: '' }))).toBeNull();
    expect(leggiMessaggioElevenLabs('non json')).toBeNull();
    expect(leggiMessaggioElevenLabs(JSON.stringify({ message_type: 'committed_transcript_entities' }))).toBeNull();
  });

  // ═══ b.637-bis — trovato dal vivo, non dedotto ═══
  it('session_started e il segnale che si e DENTRO', () => {
    expect(leggiMessaggioElevenLabs(JSON.stringify({ message_type: 'session_started', session_id: 'x' })))
      .toEqual({ tipo: 'pronto' });
  });

  it('ogni messaggio di errore e un guasto dichiarato, non un silenzio', () => {
    for (const tipo of ['auth_error', 'quota_exceeded_error', 'rate_limited_error']) {
      expect(leggiMessaggioElevenLabs(JSON.stringify({ message_type: tipo })), tipo)
        .toEqual({ tipo: 'guasto', motivo: tipo });
    }
  });
});

describe('b.637 — apriAscolto parla la lingua del fornitore giusto', () => {
  class SocketFinto {
    constructor(url, protocolli) { this.url = url; this.protocolli = protocolli; this.readyState = 0; this.inviati = []; SocketFinto.ultimo = this; }
    send(d) { this.inviati.push(d); }
    close() { this.readyState = 3; }
    apri() { this.readyState = 1; this.onopen?.(); }
  }

  const audioFinto = () => {
    globalThis.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = { id: 'dest' }; }
      createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
      createScriptProcessor() { const p = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() }; AudioContext.ultimo = p; return p; }
      close() { this.state = 'closed'; }
    };
  };

  it('con ElevenLabs: gettone nella query, nessun sottoprotocollo, campioni in JSON base64', async () => {
    audioFinto();
    const p = apriAscolto({ chiave: 'sutkn_X', fornitore: 'elevenlabs', stream: {}, lingua: 'it', WebSocketImpl: SocketFinto });
    SocketFinto.ultimo.apri();
    // b.637-bis — aprire non basta: si e dentro quando lo dice il fornitore.
    SocketFinto.ultimo.onmessage({ data: JSON.stringify({ message_type: 'session_started' }) });
    const sessione = await p;
    expect(sessione).toBeTruthy();
    expect(SocketFinto.ultimo.url).toContain('api.elevenlabs.io');
    expect(SocketFinto.ultimo.url).toContain('token=sutkn_X');
    expect(SocketFinto.ultimo.protocolli, 'il gettone non va nel sottoprotocollo').toBeUndefined();

    // un blocco di campioni: deve partire come JSON, non grezzo
    const proc = globalThis.AudioContext.ultimo;
    proc.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([0.1, -0.1, 0.2, 0]) } });
    const inviato = SocketFinto.ultimo.inviati[0];
    expect(typeof inviato).toBe('string');
    const corpo = JSON.parse(inviato);
    expect(corpo.message_type).toBe('input_audio_chunk');
    expect(typeof corpo.audio_base_64).toBe('string');
    expect(corpo.audio_base_64.length).toBeGreaterThan(0);
    delete globalThis.AudioContext;
  });

  it('con Deepgram non cambia niente: sottoprotocollo e campioni grezzi', async () => {
    audioFinto();
    const p = apriAscolto({ chiave: 'K', fornitore: 'deepgram', stream: {}, lingua: 'it', WebSocketImpl: SocketFinto });
    SocketFinto.ultimo.apri();
    await p;
    expect(SocketFinto.ultimo.url).toContain('api.deepgram.com');
    expect(SocketFinto.ultimo.protocolli).toEqual(['token', 'K']);
    const proc = globalThis.AudioContext.ultimo;
    proc.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([0.1, -0.1]) } });
    expect(typeof SocketFinto.ultimo.inviati[0], 'grezzo, non JSON').not.toBe('string');
    delete globalThis.AudioContext;
  });
});

describe('b.637-bis — «aperto» non vuol dire «dentro» (trovato dal vivo)', () => {
  // Collaudo del 05/09 nel Chrome di Luca, con un gettone finto di
  // proposito: ElevenLabs ACCETTA la connessione e solo dopo manda
  //   {"message_type":"auth_error","error":"You must be authenticated..."}
  // e chiude con code 1000. Deepgram invece rifiuta la stretta di mano.
  // Prendere `onopen` per «sono dentro» voleva dire: interprete che si
  // dichiara partito, muore in silenzio, e nessun ripiego sui blocchi.
  class SocketFinto {
    constructor(url, protocolli) { this.url = url; this.protocolli = protocolli; this.readyState = 0; this.inviati = []; this.chiuso = false; SocketFinto.ultimo = this; }
    send(d) { this.inviati.push(d); }
    close() { this.readyState = 3; this.chiuso = true; }
    apri() { this.readyState = 1; this.onopen?.(); }
    di(msg) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  }
  const audioFinto = () => {
    globalThis.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = { id: 'dest' }; }
      createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
      createScriptProcessor() { const p = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() }; AudioContext.ultimo = p; return p; }
      close() { this.state = 'closed'; }
    };
  };

  it('un auth_error dopo l\'apertura NON e un avvio riuscito: si torna null', async () => {
    audioFinto();
    const p = apriAscolto({ chiave: 'scaduto', fornitore: 'elevenlabs', stream: {}, lingua: 'it', WebSocketImpl: SocketFinto });
    SocketFinto.ultimo.apri();
    SocketFinto.ultimo.di({ message_type: 'auth_error', error: 'You must be authenticated to use this endpoint.' });
    const sessione = await p;
    expect(sessione, 'chi chiama deve poter ripiegare sui blocchi').toBeNull();
    expect(SocketFinto.ultimo.chiuso, 'e non deve restare niente acceso').toBe(true);
    delete globalThis.AudioContext;
  });

  it('senza nessun segnale non si dichiara partito: scade e torna null', async () => {
    audioFinto();
    const p = apriAscolto({ chiave: 'K', fornitore: 'elevenlabs', stream: {}, lingua: 'it', WebSocketImpl: SocketFinto, scadenzaAperturaMs: 30 });
    SocketFinto.ultimo.apri();
    expect(await p).toBeNull();
    delete globalThis.AudioContext;
  });

  it('se il messaggio d\'ingresso non arriva ma il testo si, si e dentro lo stesso', async () => {
    audioFinto();
    const testi = [];
    const p = apriAscolto({ chiave: 'K', fornitore: 'elevenlabs', stream: {}, lingua: 'it', WebSocketImpl: SocketFinto, onTesto: (t) => testi.push(t) });
    SocketFinto.ultimo.apri();
    SocketFinto.ultimo.di({ message_type: 'committed_transcript', text: 'ciao' });
    expect(await p, 'una trascrizione vale come prova di ingresso').toBeTruthy();
    expect(testi).toEqual(['ciao']);
    delete globalThis.AudioContext;
  });

  it('con Deepgram l\'apertura basta ancora: nessuna regressione', async () => {
    audioFinto();
    const p = apriAscolto({ chiave: 'K', fornitore: 'deepgram', stream: {}, lingua: 'it', WebSocketImpl: SocketFinto });
    SocketFinto.ultimo.apri();
    expect(await p, 'Deepgram rifiuta la stretta di mano, non serve aspettare altro').toBeTruthy();
    delete globalThis.AudioContext;
  });
});

describe('b.637 — il gettone monouso non si conserva', () => {
  for (const f of ['app/hooks/useStreamingInterpreter.js', 'app/hooks/useDeepgramSTT.js', 'app/components/SpeakerView.js']) {
    it(`${f}: nessun gettone tenuto in un ref`, () => {
      const src = leggi(f);
      expect(src, 'un gettone monouso conservato e un socket che non si apre')
        .not.toMatch(/(dgKeyRef|deepgramKeyRef)/);
      expect(src).toMatch(/const credenziale = await chiediChiaveSTT\(/);
      expect(src).toMatch(/fornitore: credenziale\.fornitore/);
    });
  }
});
