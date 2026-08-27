import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getVoceChiamata, setVoceChiamata } from '../app/lib/audioPrefs.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.530 — Luca: «permettimi nella video call di cambiare la voce di
// traduzione».

describe('b.530 — la preferenza voce-chiamata (funzioni VERE, non stringhe)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* niente storage */ } });
  it('parte automatica, si imposta, si azzera', () => {
    expect(getVoceChiamata()).toBe('');
    setVoceChiamata('pNInz6obpgDQGcFmaJgB');
    expect(getVoceChiamata()).toBe('pNInz6obpgDQGcFmaJgB');
    setVoceChiamata('');
    expect(getVoceChiamata()).toBe('');
  });
});

describe('b.530 — la voce scelta viaggia con OGNI frase (cambio a meta chiamata)', () => {
  it('streaming: letta a ogni sintesi, dentro il corpo, premium per prima', () => {
    const f = leggi('app/hooks/useStreamingInterpreter.js');
    expect(f).toMatch(/const voceScelta = getVoceChiamata\(\);/);
    expect(f).toMatch(/voiceId: voceScelta \|\| undefined/);
    expect(f).toMatch(/\(voceScelta \|\| preferisciElevenRef\.current\)/);
  });
  it('anche il percorso legacy a blocchi fa lo stesso', () => {
    const f = leggi('app/hooks/useInterpreterMode.js');
    expect(f).toMatch(/const voceScelta = getVoceChiamata\(\);/);
    expect(f).toMatch(/voiceId: voceScelta \|\| undefined/);
  });
  it('il server accetta il voiceId esplicito (era gia cosi: ora qualcuno glielo manda)', () => {
    expect(leggi('app/api/tts-elevenlabs/route.js')).toMatch(/voiceId, langCode/);
  });
});

describe('b.530 — il selettore sta nel pannello Volumi della chiamata', () => {
  const f = leggi('app/components/VideoCallOverlay.js');
  it('tendina con Automatica + le voci con nome', () => {
    expect(f).toMatch(/L\('ttsVoicePick'\)/);
    expect(f).toMatch(/L\('autoVoiceWord'\)/);
    expect(f).toMatch(/VOCI_ELENCO\.map/);
  });
  it('il cambio salva subito la preferenza', () => {
    expect(f).toMatch(/setVoceTraduzione\(v\); setVoceChiamata\(v\);/);
  });
});
