// ═══════════════════════════════════════════════════════════════
// b.317 — VOCI ↔ LINGUE: la fonte unica di compatibilità (audit D1).
//
// Prima queste mappe vivevano SOLO dentro la rotta TTS, invisibili al
// client: il form dei Compagni offriva 44 lingue e 8 voci senza alcun
// controllo, e nessuno avvisava che "he" o "ca" non hanno una voce
// ElevenLabs, o che per il giapponese c'è una voce che rende meglio.
// Ora la rotta e il form leggono da QUI. Un fatto, un posto.
// ═══════════════════════════════════════════════════════════════

// Lingue con language_code ElevenLabs (flash/turbo v2.5). Fuori da questa
// lista la sintesi passa al modello multilingua generico: funziona ma la
// pronuncia è approssimativa — l'utente va avvisato.
export const LANG_CODES = {
  'it': 'it', 'en': 'en', 'es': 'es', 'fr': 'fr', 'de': 'de', 'pt': 'pt',
  'zh': 'zh', 'ja': 'ja', 'ko': 'ko', 'ar': 'ar', 'hi': 'hi', 'ru': 'ru',
  'tr': 'tr', 'id': 'id', 'ms': 'ms', 'nl': 'nl', 'pl': 'pl', 'sv': 'sv',
  'el': 'el', 'cs': 'cs', 'ro': 'ro', 'fi': 'fi', 'th': 'th', 'vi': 'vi', 'hu': 'hu',
};

// La voce premade che rende MEGLIO per ciascuna lingua (per genere).
// Nota onesta (audit): sono voci premade inglesi lette dal modello
// multilingua — per it/es/fr/de la resa è buona, per ja/zh/ko/ar è
// accettabile ma con accento; la resa davvero nativa arriverà dal
// Modulo Lingue (voci per locale).
export const NATIVE_VOICES_BY_LANG = {
  'en': { female: 'EXAVITQu4vr4xnSDxMaL', male: 'pNInz6obpgDQGcFmaJgB' },  // Sarah / Adam
  'it': { female: 'EXAVITQu4vr4xnSDxMaL', male: 'ErXwobaYiN019PkySvjV' },  // Sarah / Antoni
  'es': { female: 'XB0fDUnXU5powFXDhCwa', male: 'TxGEqnHWrfWFTfGW9XjX' },  // Charlotte / Josh
  'fr': { female: 'XB0fDUnXU5powFXDhCwa', male: 'GBv7mTt0atIp3Br8iCZE' },  // Charlotte / Thomas
  'de': { female: 'piTKgcLEGmPE4e6mEKli', male: 'GBv7mTt0atIp3Br8iCZE' },  // Nicole / Thomas
  'pt': { female: '21m00Tcm4TlvDq8ikWAM', male: 'ErXwobaYiN019PkySvjV' },  // Rachel / Antoni
  'zh': { female: 'XB0fDUnXU5powFXDhCwa', male: 'pNInz6obpgDQGcFmaJgB' },  // Charlotte / Adam
  'ja': { female: 'piTKgcLEGmPE4e6mEKli', male: 'GBv7mTt0atIp3Br8iCZE' },  // Nicole / Thomas
  'ko': { female: 'MF3mGyEYCl7XYWbV9V6O', male: 'TxGEqnHWrfWFTfGW9XjX' },  // Elli / Josh
  'th': { female: '21m00Tcm4TlvDq8ikWAM', male: 'ErXwobaYiN019PkySvjV' },  // Rachel / Antoni (multilingual)
  'vi': { female: '21m00Tcm4TlvDq8ikWAM', male: 'ErXwobaYiN019PkySvjV' },  // Rachel / Antoni (multilingual)
  'ar': { female: 'XB0fDUnXU5powFXDhCwa', male: 'pNInz6obpgDQGcFmaJgB' },  // Charlotte / Adam
  'hi': { female: '21m00Tcm4TlvDq8ikWAM', male: 'ErXwobaYiN019PkySvjV' },  // Rachel / Antoni
  'ru': { female: 'piTKgcLEGmPE4e6mEKli', male: 'VR6AewLTigWG4xSOukaG' },  // Nicole / Arnold
  'tr': { female: 'EXAVITQu4vr4xnSDxMaL', male: '29vD33N1CtxCmqQRPOHJ' },  // Sarah / Drew
  'nl': { female: 'XB0fDUnXU5powFXDhCwa', male: 'GBv7mTt0atIp3Br8iCZE' },  // Charlotte / Thomas
  'pl': { female: 'piTKgcLEGmPE4e6mEKli', male: 'VR6AewLTigWG4xSOukaG' },  // Nicole / Arnold
  'sv': { female: 'MF3mGyEYCl7XYWbV9V6O', male: 'TxGEqnHWrfWFTfGW9XjX' },  // Elli / Josh
};

/**
 * Verdetto di compatibilità voce↔lingua, per il form (audit D1):
 *   { ok: true }                                       → nessun avviso
 *   { ok: false, motivo: 'lingua-senza-voce' }          → la lingua non ha language_code
 *   { ok: true, consiglio: { id, perche } }             → c'è una voce che rende meglio
 */
export function compatibilitaVoceLingua({ voceId, lingua, genere = 'neutral' } = {}) {
  const lang2 = String(lingua || '').replace(/-.*/, '');
  if (!lang2) return { ok: true };
  if (!LANG_CODES[lang2]) return { ok: false, motivo: 'lingua-senza-voce' };
  const nativa = NATIVE_VOICES_BY_LANG[lang2];
  if (!nativa) return { ok: true };
  const consigliata = (genere === 'male' ? nativa.male : nativa.female) || nativa.female;
  if (consigliata && voceId && consigliata !== voceId) {
    return { ok: true, consiglio: { id: consigliata, perche: lang2 } };
  }
  return { ok: true };
}
