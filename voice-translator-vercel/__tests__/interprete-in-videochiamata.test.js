// ═══════════════════════════════════════════════════════════════
// L'INTERPRETE NON ARRIVAVA ALLA VIDEOCHIAMATA (b.132)
//
// Luca ha chiesto: "verifica che il testo della traduzione vocale e la
// voce dell'agente tradotta vengano lette durante la video call".
//
// Seguendo la catena nel codice, tutto c'era:
//
//   voce → trascrizione → traduzione → sintesi
//     → sendDirectMessage('interpreter-subtitle' + 'interpreter-audio')
//     → handleDCMessage → page.js → handleInterpreterMessage
//     → setPartnerSubtitles + playBase64Audio
//
// Ogni anello collegato. E un difetto lo stesso.
//
// ── DOVE SI ROMPEVA ──
//
// `VoiceCallOverlay` riceve `interpreter`, `interpreterActive` e
// `setInterpreterActive`: nella chiamata VOCALE c'e il pulsante per
// accendere l'interprete.
//
// `VideoCallOverlay` riceveva solo `lastTranslationSubtitle` — che e
// il sottotitolo dell'ultimo messaggio di CHAT, un'altra cosa.
//
// Quindi in videochiamata non esisteva NESSUN modo di accendere
// l'interprete. Niente testo della voce tradotta, niente voce
// dell'agente. Mentre la Home promette:
//
//     "Videochiamata tradotta — Chiamata video con sottotitoli e
//      voce tradotta"
//
// Non un pezzo rotto: un comando presente in una delle due chiamate e
// assente nell'altra. La stessa forma dei difetti di b.128 e b.131 —
// una strada su due.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('la videochiamata riceve l\'interprete', () => {
  const v = () => senzaCommenti(leggi('app/components/VideoCallOverlay.js'));

  it('fra i suoi parametri', () => {
    expect(v()).toMatch(/interpreter, interpreterActive, setInterpreterActive,/);
  });

  it('e RoomView glieli passa davvero', () => {
    const r = senzaCommenti(leggi('app/components/RoomView.js'));
    const i = r.indexOf('<VideoCallOverlay');
    const corpo = r.slice(i, i + 900);
    expect(corpo).toMatch(/interpreter=\{interpreter\}/);
    expect(corpo).toMatch(/interpreterActive=\{interpreterActive\}/);
    expect(corpo).toMatch(/setInterpreterActive=\{setInterpreterActive\}/);
  });

  it('con lo stesso comando che ha gia la chiamata vocale', () => {
    // Non un meccanismo nuovo: lo stesso interruttore, nell'altra
    // schermata. Due strade diverse per la stessa cosa sarebbero
    // l'ambiguita che stiamo togliendo da giorni.
    const s = v();
    expect(s).toMatch(/setInterpreterActive\(!interpreterActive\)/);
    expect(s).toMatch(/IconGlobe/);
  });
});

describe('e il sottotitolo giusto vince', () => {
  it('quando l\'interprete e acceso si mostra il SUO sottotitolo', () => {
    // `lastTranslationSubtitle` viene dalla chat. Durante una
    // videochiamata tradotta il testo che conta e quello della voce in
    // tempo reale.
    const s = senzaCommenti(leggi('app/components/VideoCallOverlay.js'));
    // b.598 — il calcolo e' salito a livello di componente (cosi lo legge
    // anche la modalita compatta): stesso criterio, nomi nuovi.
    expect(s).toMatch(/const daInterpreteCompatto = interpreterActive && interpreter\?\.lastSubtitle/);
    expect(s).toMatch(/const subsCompatto = daInterpreteCompatto \|\|/);
  });

  it('ma senza interprete si continua a vedere quello della chat', () => {
    // Togliere il vecchio comportamento avrebbe curato un difetto
    // creandone un altro.
    // b.276 — il ripiego sulla chat c'e ancora, ma ora il sottotitolo
    // passa da una forma sola (inScheda): si controlla che il ramo esista,
    // non piu come e scritto dentro.
    const s = senzaCommenti(leggi('app/components/VideoCallOverlay.js'));
    expect(s).toMatch(/lastTranslationSubtitle \? \[[^\]]*lastTranslationSubtitle[^\]]*\] : \[\]/);
  });
});

describe('la catena a monte era gia intera: si verifica che resti tale', () => {
  it('l\'interprete manda sottotitolo E audio sul canale dati', () => {
    const s = senzaCommenti(leggi('app/hooks/useInterpreterMode.js'));
    // b.599 — nomi da lib/eventi.js; l'audio parte dal modulo unico.
    expect(s).toMatch(/type: MSG\.SOTTOTITOLO/);
    expect(s).toMatch(/inviaAudioDC\(webrtc, await blobABase64\(ttsBlob\)\)/);
    expect(senzaCommenti(leggi('app/lib/audio/voceTradotta.js'))).toMatch(/type: MSG\.AUDIO, data: base64/);
  });

  it('chi riceve li instrada all\'interprete', () => {
    expect(senzaCommenti(leggi('app/page.js')))
      .toMatch(/interpreterRef\.current\?\.handleInterpreterMessage\?\.\(msg\)/);
  });

  it('e l\'hook esporta davvero quella funzione', () => {
    // Con due `?.` di fila, se l'hook non la esportasse non
    // succederebbe niente e nessuno se ne accorgerebbe.
    expect(senzaCommenti(leggi('app/hooks/useInterpreterMode.js')))
      .toMatch(/handleInterpreterMessage: handleUnifiedMessage/);
  });

  it('e l\'audio ricevuto viene suonato', () => {
    const s = senzaCommenti(leggi('app/hooks/useInterpreterMode.js'));
    expect(s).toMatch(/const playBase64Audio = useCallback/);
    expect(s).toMatch(/playBase64Audio\(msg\.data\)/);
  });
});
