// ═══════════════════════════════════════════════
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
    const v = parseFloat(localStorage.getItem(chiave));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : base;
  } catch { return base; }
}
function scrivi(chiave, v) {
  try { localStorage.setItem(chiave, String(v)); } catch { /* privato/pieno */ }
}

export function getVolumeTTS() { return leggi('vt-vol-tts', 1); }
export function setVolumeTTS(v) { scrivi('vt-vol-tts', v); }

export function getAttenuazione() { return leggi('vt-attenuazione', 0.2); }
export function setAttenuazione(v) { scrivi('vt-attenuazione', v); }

// Preset per la UI: quanto senti l'originale mentre parla la traduzione
export const PRESET_ATTENUAZIONE = [
  { id: 'tutto', nome: 'Solo tradotta', valore: 0 },
  { id: 'medio', nome: 'Attenuata', valore: 0.2 },
  { id: 'poco', nome: 'Entrambe', valore: 0.55 },
];
