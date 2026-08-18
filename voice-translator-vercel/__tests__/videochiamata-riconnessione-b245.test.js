// ═══════════════════════════════════════════════════════════════
// b.245 — «non viene più allacciato l'ospite».
//
// Quattro difetti verificati riga per riga, che insieme spiegano esattamente
// il sintomo. Non riguardano codec, qualità o TURN: quando la connessione
// parte funziona. Riguardano la MACCHINA DEGLI STATI attorno.
//
//  1. Il pulsante VIDEO chiamava `initiateConnection` solo da stato 'idle'.
//     Dopo una caduta lo stato resta 'failed': premere Video non faceva più
//     NIENTE. Il pulsante AUDIO, due righe sopra, non ha mai avuto quella
//     guardia — ecco perché si rompeva solo il video.
//  2. Chi cade manda `reconnect: true`, ma il ricevente non lo leggeva: si
//     credeva ancora 'connected' e rispondeva BUSY. La riconnessione si
//     autosabotava.
//  3. `cleanup()` azzerava `callTypeRef` PRIMA della riconnessione: una
//     videochiamata si sarebbe ricostruita come audio.
//  4. Da 'failed' si ripartiva senza smontare la connessione morta.
//
// NOTA ONESTA: questi test leggono il codice, non aprono due telefoni.
// Provano che la macchina degli stati è quella giusta; che la chiamata si
// riallacci davvero lo dice solo il collaudo a due dispositivi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('il pulsante Video torna a funzionare dopo una caduta', () => {
  const ui = () => senzaCommenti(leggi('app/components/RoomHeader.js'));

  it('non c\'è più la guardia che lo bloccava in stato "failed"', () => {
    expect(ui()).not.toMatch(/if \(webrtc\.webrtcState === 'idle'\) webrtc\.initiateConnection/);
  });

  it('e chiama sempre, come ha sempre fatto il pulsante Audio', () => {
    const s = ui();
    expect(s).toMatch(/webrtc\.initiateConnection\(true\)/);   // video
    expect(s).toMatch(/webrtc\.initiateConnection\(false\)/);  // audio
  });
});

describe('da "failed" si riparte davvero', () => {
  const h = () => senzaCommenti(leggi('app/hooks/useWebRTC.js'));

  it('chi decide se si può chiamare è l\'hook, e rifiuta solo connecting/connected', () => {
    expect(h()).toMatch(/if \(stateRef\.current === 'connecting' \|\| stateRef\.current === 'connected'\) return;/);
  });

  it('e prima di richiamare butta via la connessione morta', () => {
    const s = h();
    const i = s.indexOf("if (stateRef.current === 'failed')");
    expect(i, 'il ramo failed deve esistere').toBeGreaterThan(-1);
    const corpo = s.slice(i, i + 260);
    expect(corpo).toMatch(/cleanup\(\)/);
    expect(corpo).toMatch(/autoReconnectAttemptRef\.current = 0/);
  });
});

describe('una riconnessione non è una chiamata nuova', () => {
  const h = () => senzaCommenti(leggi('app/hooks/useWebRTC.js'));

  it('il flag reconnect ORA viene letto dal ricevente', () => {
    expect(h()).toMatch(/payload\?\.reconnect &&/);
  });

  it('e chi si crede ancora connesso non risponde più BUSY a una riconnessione', () => {
    const s = h();
    const iRiconn = s.indexOf('payload?.reconnect &&');
    const iBusy = s.indexOf("reason: 'busy'");
    expect(iRiconn, 'il ramo riconnessione deve esserci').toBeGreaterThan(-1);
    expect(iBusy, 'il busy deve esistere ancora, per le chiamate vere').toBeGreaterThan(-1);
    expect(iRiconn, 'ma la riconnessione va intercettata PRIMA del busy').toBeLessThan(iBusy);
  });

  it('si riaccetta senza far ricomparire il banner "chiamata in arrivo"', () => {
    const s = h();
    const i = s.indexOf('payload?.reconnect &&');
    const corpo = s.slice(i, i + 700);
    expect(corpo).toMatch(/sendSignal\('call-accepted'/);
    expect(corpo).not.toMatch(/setIncomingCall\(/);
  });
});

describe('una videochiamata si riconnette come videochiamata', () => {
  const h = () => senzaCommenti(leggi('app/hooks/useWebRTC.js'));

  it('il tipo si ricorda PRIMA che il cleanup lo azzeri', () => {
    const s = h();
    const i = s.indexOf('tipoChiamataPrecedenteRef.current = callTypeRef.current');
    const iAzzera = s.indexOf('callTypeRef.current = null;');
    expect(i, 'il ricordo del tipo deve esistere').toBeGreaterThan(-1);
    expect(i, 'si ricorda prima di azzerare').toBeLessThan(iAzzera);
  });

  it('e la riconnessione lo usa invece del ref appena azzerato', () => {
    const s = h();
    expect(s).toMatch(/const tipoDaRipristinare = callTypeRef\.current \|\| tipoChiamataPrecedenteRef\.current;/);
    expect(s).toMatch(/withVideo: tipoDaRipristinare === 'video', reconnect: true/);
    // Il difetto era proprio questo: leggere un ref già azzerato.
    expect(s).not.toMatch(/withVideo: callTypeRef\.current === 'video', reconnect: true/);
  });

  it('anche chi riceve la riconnessione ricostruisce il video', () => {
    const s = h();
    const i = s.indexOf('payload?.reconnect &&');
    expect(s.slice(i, i + 400)).toMatch(/payload\.withVideo \|\| tipoChiamataPrecedenteRef\.current === 'video'/);
  });
});

describe('cio che NON deve essersi rotto', () => {
  const h = () => senzaCommenti(leggi('app/hooks/useWebRTC.js'));

  it('chiudere di proposito continua a non far riconnettere nessuno', () => {
    // b.117 — se uno riaggancia, l'altro non deve ricomporre né riaccendere
    // la telecamera. È il difetto che il collaudo a due telefoni aveva trovato.
    const s = h();
    const i = s.indexOf("if (type === 'call-ended')");
    const corpo = s.slice(i, i + 600);
    expect(corpo).toMatch(/autoReconnectAttemptRef\.current = MAX_AUTO_RECONNECTS/);
    expect(corpo).toMatch(/cleanup\(\)/);
  });

  it('e una chiamata NUOVA continua a riaprire la porta chiusa da CHIUDI', () => {
    expect(h()).toMatch(/chiusuraVolutaRef\.current = false;/);
  });

  it('il busy resta per le chiamate vere di un terzo', () => {
    expect(h()).toMatch(/reason: 'busy'/);
  });
});
