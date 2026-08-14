// ═══════════════════════════════════════════════════════════════
// IL MOTORE VOCALE SCELTO SI SENTE DAVVERO (b.155)
//
// Nato dall'audit dei setting di conversazione chiesto da Luca
// (14/8): "siamo sicuri che il setting funzioni correttamente?".
//
// CONFERMATO leggendo il codice: c'erano DUE percorsi di lettura
// della voce.
//   · playMessage (useAudioSystem.js) — il riascolto MANUALE di un
//     singolo messaggio — riconosceva tutti e 4 i motori
//     (auto/elevenlabs/openai/edge).
//   · procuraVoce (useTTSEngine.js) — la coda VERA usata in ogni
//     conversazione dal vivo (accodaConAnticipo → tts.procuraVoce) —
//     riconosceva solo "elevenlabs" (esplicito o via auto+clone) e
//     altrimenti andava SEMPRE su Edge TTS, "openai" incluso.
//
// Risultato dal vivo: chi sceglieva "OpenAI" nel selettore voce
// sentiva comunque Edge TTS in ogni conversazione reale — solo il
// riascolto manuale del singolo messaggio rispettava la scelta.
// Il test legge il codice SENZA i commenti (che citano "openai" nelle
// spiegazioni) cosi non si autoconvince leggendo la propria diagnosi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('procuraVoce (la coda vera) riconosce "openai" come motore esplicito', () => {
  const src = leggi('app/hooks/useTTSEngine.js');
  const iFn = src.indexOf('async function procuraVoce(');
  const iFinePreparazione = src.indexOf('async function suonaVoce(');
  const corpoGrezzo = src.slice(iFn, iFinePreparazione > -1 ? iFinePreparazione : iFn + 2000);
  const corpo = senzaCommenti(corpoGrezzo);

  it('la funzione esiste', () => {
    expect(iFn).toBeGreaterThan(-1);
  });

  it('c\'e un ramo dedicato a motore === "openai" (non solo elevenlabs/auto)', () => {
    expect(corpo).toMatch(/motore === 'openai'/);
  });

  it('quel ramo chiama davvero fetchTTSBlob (l\'OpenAI TTS), non un altro motore', () => {
    const iOpenai = corpo.indexOf("motore === 'openai'");
    const dopo = corpo.slice(iOpenai, iOpenai + 300);
    expect(dopo).toMatch(/fetchTTSBlob\(/);
  });

  it('il ramo "openai" viene PRIMA del ripiego su Edge, non dopo', () => {
    const iOpenai = corpo.indexOf("motore === 'openai'");
    const iEdge = corpo.indexOf('fetchEdgeTTSBlob(text, langCode)');
    expect(iOpenai).toBeGreaterThan(-1);
    expect(iEdge).toBeGreaterThan(-1);
    expect(iOpenai).toBeLessThan(iEdge);
  });
});

describe('coerenza fra i due percorsi di lettura (riascolto manuale vs coda live)', () => {
  it('playMessage (riascolto manuale) riconosce tutti e 4 i motori', () => {
    const src = senzaCommenti(leggi('app/hooks/useAudioSystem.js'));
    const iFn = src.indexOf('async function playMessage(');
    const corpo = src.slice(iFn, iFn + 1500);
    for (const motore of ["'edge'", "'elevenlabs'", "'openai'"]) {
      expect(corpo, `playMessage deve riconoscere ${motore}`).toContain(`voiceEngine === ${motore}`);
    }
  });
});
