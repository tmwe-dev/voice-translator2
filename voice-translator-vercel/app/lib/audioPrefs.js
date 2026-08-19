// ═══════════════════════════════════════════════
import { memGet, memSet } from './memoria.js';
// audioPrefs — i volumi della chiamata, in un posto solo.
//
// Tre manopole, salvate sul telefono:
//   volume voce tradotta (TTS)      0..1   default 1
//   attenuazione dell'originale     0..1   default 0.2 (mentre parla la TTS)
// Il volume del partner vive già in RoomView (partnerVolume).
//
// Niente React qui: funzioni pure leggibili da chiunque.
// ═══════════════════════════════════════════════

function leggi(chiave, base) {
  try {
    const v = parseFloat(memGet(chiave));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : base;
  } catch { return base; }
}
function scrivi(chiave, v) {
  try { memSet(chiave, String(v)); } catch { /* navigazione privata o memoria piena: le preferenze restano in memoria */ }
}

export function getVolumeTTS() { return leggi('vt-vol-tts', 1); }
export function setVolumeTTS(v) { scrivi('vt-vol-tts', v); }

export function getAttenuazione() { return leggi('vt-attenuazione', 0.2); }
export function setAttenuazione(v) { scrivi('vt-attenuazione', v); }

// Preset per la UI: quanto senti l'originale mentre parla la traduzione
// b.139 — `nome` era il testo italiano. La tabella nasce col modulo, prima
// che si sappia la lingua: ora porta la CHIAVE e chi disegna traduce.
export const PRESET_ATTENUAZIONE = [
  { id: 'tutto', chiave: 'onlyTranslated', valore: 0 },
  { id: 'medio', chiave: 'attenuatedWord', valore: 0.2 },
  { id: 'poco', chiave: 'bothWord', valore: 0.55 },
];
