// ═══════════════════════════════════════════════════════════════
// b.248 — «i comandi della chiamata fanno quello che dicono».
//
// Quattro difetti verificati riga per riga sui sorgenti:
//
//  1. Il pulsante VOCE aveva ANCORA la guardia `webrtcState === 'idle'`
//     che il pulsante Video ha perso in b.245: dopo una caduta lo stato
//     resta 'failed' e ripremere Voce non faceva più niente.
//     (Il commento b.245 diceva che l'audio "non ha mai avuto questa
//     guardia": era falso — la guardia c'era, due righe sopra.)
//  2. "Passa a video" cambiava solo l'interfaccia: nessuna camera,
//     nessuna rinegoziazione, il partner non riceveva nulla. La cura
//     esisteva già — toggleVideo acquisisce, fa addTrack e rinegozia —
//     ma nessuno la chiamava dal pulsante.
//  3. "Chiudi video" nel menu ••• nascondeva la finestra e basta:
//     camera e connessione restavano vive. Ora passa dalla stessa via
//     dei pulsanti rossi dell'overlay: disconnect() → chiusura voluta.
//  4. flipCamera buttava lo stream: switchCamera ritorna un flusso di
//     SOLO video, e `localStreamRef.current = newStream` perdeva la
//     traccia AUDIO — il mute non controllava più il microfono giusto.
//
// NOTA ONESTA: questi test leggono il codice, non aprono due telefoni.
// Provano che i fili sono attaccati ai pulsanti giusti; che camera e
// microfono facciano davvero quel che devono lo dice solo il collaudo
// a due dispositivi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
// b.245 (regola di casa): i commenti si tolgono SEMPRE prima di cercare,
// così un difetto citato in un commento non soddisfa mai il controllo.
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ui = () => senzaCommenti(leggi('app/components/RoomHeader.js'));
const hook = () => senzaCommenti(leggi('app/hooks/useWebRTC.js'));
const vista = () => senzaCommenti(leggi('app/components/RoomView.js'));
const lib = () => senzaCommenti(leggi('app/lib/webrtc.js'));

// Ritaglia il corpo di una funzione fra due ancore testuali.
const ritaglia = (s, da, a) => {
  const i = s.indexOf(da);
  expect(i, `deve esistere l'ancora «${da}»`).toBeGreaterThan(-1);
  const j = s.indexOf(a, i);
  return j > -1 ? s.slice(i, j) : s.slice(i);
};

describe('1. il pulsante VOCE torna a funzionare dopo una caduta (stessa cura di b.245)', () => {
  it('non c\'è più NESSUNA guardia sullo stato, né sul voce né sul video', () => {
    // Prima: `else if (webrtc.webrtcState === 'idle')` sul ramo voce.
    // Dopo una chiamata caduta lo stato è 'failed' → il pulsante era morto.
    expect(ui()).not.toMatch(/webrtcState === 'idle'/);
  });

  it('il ramo voce chiama sempre, e chi decide è initiateConnection', () => {
    const s = ui();
    expect(s).toMatch(/webrtc\.initiateConnection\(false\)/);
    // In chiamata vocale già attiva si riapre solo la finestra, come prima.
    expect(s).toMatch(/setShowVoiceCall\(true\)/);
  });
});

describe('2. "passa a video" accende davvero la camera', () => {
  it('il pulsante di upgrade chiama toggleVideo (acquisizione + rinegoziazione)', () => {
    const corpo = ritaglia(vista(), 'onUpgradeToVideo={() => {', '}}');
    expect(corpo).toMatch(/webrtc\.toggleVideo\(\)/);
  });

  it('quando il video si accende su una chiamata voce, il tipo diventa "video"', () => {
    // Senza questo la finestra giusta non si apre e una riconnessione
    // ricostruirebbe la chiamata come solo-audio (memoria di b.245).
    const corpo = ritaglia(hook(), 'const toggleVideo', 'const flipCamera');
    expect(corpo).toMatch(/setCallType\('video'\)/);
    expect(corpo).toMatch(/callTypeRef\.current = 'video'/);
  });

  it('anche il PARTNER promuove la chiamata quando gli arriva la traccia video', () => {
    const corpo = ritaglia(hook(), 'const handleRemoteTrack', 'const handleDCMessage');
    expect(corpo).toMatch(/callTypeRef\.current === 'voice'/);
    expect(corpo).toMatch(/setCallType\('video'\)/);
  });

  it('e la vista apre la finestra giusta quando il tipo cambia, non solo quando cambia lo stato', () => {
    expect(vista()).toMatch(/\[webrtc\?\.webrtcState, webrtc\?\.callType\]/);
  });

  it('PROTEZIONE (già verde): la rinegoziazione si accetta da sola, senza banner', () => {
    // È il motivo per cui il partner NON deve riaccettare: il ramo
    // 'renegotiate' risponde con un answer e non tocca incomingCall.
    const corpo = ritaglia(hook(), "type === 'renegotiate'", "handleIncomingSignalRef");
    expect(corpo).toMatch(/createAnswer\(\)/);
    expect(corpo).toMatch(/sendSignal\('answer'/);
    expect(corpo).not.toMatch(/setIncomingCall\(/);
  });
});

describe('3. "chiudi video" chiude davvero, non nasconde', () => {
  it('la voce di menu passa da disconnect(), come i pulsanti rossi dell\'overlay', () => {
    expect(ui()).toMatch(/webrtc\.disconnect\(\)/);
  });

  it('e usa l\'idioma di casa: disconnect + finestra giù + niente fullscreen', () => {
    const corpo = ritaglia(ui(), 'webrtc.disconnect()', 'setShowMoreMenu');
    expect(corpo).toMatch(/setShowVideoCall\(false\)/);
    expect(corpo).toMatch(/setVideoFullscreen\(false\)/);
  });

  it('PROTEZIONE (già verde): disconnect è una chiusura VOLUTA e lo dice all\'altro', () => {
    // b.116 + b.117 — la via che il menu ora imbocca: flag di chiusura
    // voluta (niente auto-riconnessione) e segnale call-ended al partner.
    const corpo = ritaglia(hook(), 'const disconnect', 'return {');
    expect(corpo).toMatch(/chiusuraVolutaRef\.current = true/);
    expect(corpo).toMatch(/sendSignal\('call-ended'/);
    expect(corpo).toMatch(/cleanup\(\)/);
  });
});

describe('4. il cambio camera non perde più il microfono', () => {
  it('lo stream di solo-video di switchCamera NON sostituisce più il ref intero', () => {
    expect(hook()).not.toMatch(/localStreamRef\.current = newStream/);
  });

  it('flipCamera ricompone: audio VECCHIO + video NUOVO', () => {
    const corpo = ritaglia(hook(), 'const flipCamera', 'const toggleAudio');
    expect(corpo).toMatch(/getAudioTracks\(\)/);
    expect(corpo).toMatch(/getVideoTracks\(\)/);
    expect(corpo).toMatch(/new MediaStream\(/);
  });

  it('PROTEZIONE (già verde): il replaceTrack sul sender lo fa già la lib', () => {
    const corpo = ritaglia(lib(), 'export async function switchCamera', 'return newStream');
    expect(corpo).toMatch(/sender\.replaceTrack\(newVideoTrack\)/);
  });
});

describe('le difese b.116 / b.117 / b.245 restano intatte', () => {
  it('b.117: chi riceve call-ended non riprova e smonta tutto', () => {
    const corpo = ritaglia(hook(), "if (type === 'call-ended')", "if (type === 'call-request')");
    expect(corpo).toMatch(/autoReconnectAttemptRef\.current = MAX_AUTO_RECONNECTS/);
    expect(corpo).toMatch(/cleanup\(\)/);
  });

  it('b.116: dopo un CHIUDI la riconnessione automatica non parte', () => {
    expect(hook()).toMatch(/if \(chiusuraVolutaRef\.current\) return;/);
  });

  it('b.116: una chiamata NUOVA riapre la porta chiusa da CHIUDI', () => {
    expect(hook()).toMatch(/chiusuraVolutaRef\.current = false;/);
  });

  it('b.245: la riconnessione viene intercettata PRIMA del busy', () => {
    const s = hook();
    const iRiconn = s.indexOf('payload?.reconnect &&');
    const iBusy = s.indexOf("reason: 'busy'");
    expect(iRiconn).toBeGreaterThan(-1);
    expect(iBusy).toBeGreaterThan(-1);
    expect(iRiconn).toBeLessThan(iBusy);
  });

  it('b.245: il pulsante Video continua a chiamare senza guardie', () => {
    expect(ui()).toMatch(/webrtc\.initiateConnection\(true\)/);
  });

  it('b.245: una videochiamata caduta si ricorda di essere video', () => {
    const s = hook();
    expect(s).toMatch(/tipoChiamataPrecedenteRef\.current = callTypeRef\.current/);
    expect(s).toMatch(/withVideo: tipoDaRipristinare === 'video', reconnect: true/);
  });
});
