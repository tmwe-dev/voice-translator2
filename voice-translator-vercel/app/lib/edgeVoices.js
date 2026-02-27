// ═══════════════════════════════════════════════
// Edge TTS Voice Map — Microsoft Neural Voices (FREE)
//
// These voices are available via the Edge TTS service at no cost.
// Quality is comparable to paid neural TTS services.
// Each language has male + female options.
// ═══════════════════════════════════════════════

export const EDGE_VOICES = {
  'it': { female: 'it-IT-ElsaNeural',        male: 'it-IT-DiegoNeural' },
  'th': { female: 'th-TH-PremwadeeNeural',    male: 'th-TH-NiwatNeural' },
  'en': { female: 'en-US-JennyNeural',        male: 'en-US-GuyNeural' },
  'es': { female: 'es-ES-ElviraNeural',       male: 'es-ES-AlvaroNeural' },
  'fr': { female: 'fr-FR-DeniseNeural',       male: 'fr-FR-HenriNeural' },
  'de': { female: 'de-DE-KatjaNeural',        male: 'de-DE-ConradNeural' },
  'pt': { female: 'pt-BR-FranciscaNeural',    male: 'pt-BR-AntonioNeural' },
  'zh': { female: 'zh-CN-XiaoxiaoNeural',     male: 'zh-CN-YunxiNeural' },
  'ja': { female: 'ja-JP-NanamiNeural',       male: 'ja-JP-KeitaNeural' },
  'ko': { female: 'ko-KR-SunHiNeural',        male: 'ko-KR-InJoonNeural' },
  'ar': { female: 'ar-SA-ZariyahNeural',      male: 'ar-SA-HamedNeural' },
  'hi': { female: 'hi-IN-SwaraNeural',        male: 'hi-IN-MadhurNeural' },
  'ru': { female: 'ru-RU-SvetlanaNeural',     male: 'ru-RU-DmitryNeural' },
  'tr': { female: 'tr-TR-EmelNeural',         male: 'tr-TR-AhmetNeural' },
  'vi': { female: 'vi-VN-HoaiMyNeural',       male: 'vi-VN-NamMinhNeural' },
  'id': { female: 'id-ID-GadisNeural',        male: 'id-ID-ArdiNeural' },
  'ms': { female: 'ms-MY-YasminNeural',       male: 'ms-MY-OsmanNeural' },
  'nl': { female: 'nl-NL-ColetteNeural',      male: 'nl-NL-MaartenNeural' },
  'pl': { female: 'pl-PL-ZofiaNeural',        male: 'pl-PL-MarekNeural' },
  'sv': { female: 'sv-SE-SofieNeural',        male: 'sv-SE-MattiasNeural' },
  'el': { female: 'el-GR-AthinaNeural',       male: 'el-GR-NestorasNeural' },
  'cs': { female: 'cs-CZ-VlastaNeural',       male: 'cs-CZ-AntoninNeural' },
  'ro': { female: 'ro-RO-AlinaNeural',        male: 'ro-RO-EmilNeural' },
  'hu': { female: 'hu-HU-NoemiNeural',        male: 'hu-HU-TamasNeural' },
  'fi': { female: 'fi-FI-NooraNeural',        male: 'fi-FI-HarriNeural' },
};

/**
 * Get the Edge TTS voice name for a language code + gender
 * @param {string} langCode - e.g. 'th', 'zh', 'it-IT'
 * @param {string} gender - 'female' or 'male'
 * @returns {string} Voice name for Edge TTS
 */
export function getEdgeVoice(langCode, gender = 'female') {
  const lang2 = langCode.replace(/-.*/, ''); // 'th-TH' → 'th'
  const voices = EDGE_VOICES[lang2] || EDGE_VOICES['en'];
  return voices[gender] || voices.female;
}

/**
 * Get all available voices for a language (for Settings UI)
 */
export function getAvailableEdgeVoices(langCode) {
  const lang2 = langCode.replace(/-.*/, '');
  return EDGE_VOICES[lang2] || EDGE_VOICES['en'];
}
