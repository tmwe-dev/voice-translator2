// ═══════════════════════════════════════════════
// Edge TTS Voice Map — Microsoft Neural Voices (FREE)
//
// These voices are available via the Edge TTS service at no cost.
// Quality is comparable to paid neural TTS services.
// Each language has male + female options.
// Regional variants use exact match first, then 2-letter fallback.
// ═══════════════════════════════════════════════

export const EDGE_VOICES = {
  // ── Core languages ──
  'it':    { female: 'it-IT-ElsaNeural',        male: 'it-IT-DiegoNeural' },
  'th':    { female: 'th-TH-PremwadeeNeural',    male: 'th-TH-NiwatNeural' },
  'en':    { female: 'en-US-JennyNeural',        male: 'en-US-GuyNeural' },
  'es':    { female: 'es-ES-ElviraNeural',       male: 'es-ES-AlvaroNeural' },
  'fr':    { female: 'fr-FR-DeniseNeural',       male: 'fr-FR-HenriNeural' },
  'de':    { female: 'de-DE-KatjaNeural',        male: 'de-DE-ConradNeural' },
  'pt':    { female: 'pt-BR-FranciscaNeural',    male: 'pt-BR-AntonioNeural' },
  'zh':    { female: 'zh-CN-XiaoxiaoNeural',     male: 'zh-CN-YunxiNeural' },
  'ja':    { female: 'ja-JP-NanamiNeural',       male: 'ja-JP-KeitaNeural' },
  'ko':    { female: 'ko-KR-SunHiNeural',        male: 'ko-KR-InJoonNeural' },
  'ar':    { female: 'ar-SA-ZariyahNeural',      male: 'ar-SA-HamedNeural' },
  'hi':    { female: 'hi-IN-SwaraNeural',        male: 'hi-IN-MadhurNeural' },
  'ru':    { female: 'ru-RU-SvetlanaNeural',     male: 'ru-RU-DmitryNeural' },
  'tr':    { female: 'tr-TR-EmelNeural',         male: 'tr-TR-AhmetNeural' },
  'vi':    { female: 'vi-VN-HoaiMyNeural',       male: 'vi-VN-NamMinhNeural' },
  'id':    { female: 'id-ID-GadisNeural',        male: 'id-ID-ArdiNeural' },
  'ms':    { female: 'ms-MY-YasminNeural',       male: 'ms-MY-OsmanNeural' },
  'nl':    { female: 'nl-NL-ColetteNeural',      male: 'nl-NL-MaartenNeural' },
  'pl':    { female: 'pl-PL-ZofiaNeural',        male: 'pl-PL-MarekNeural' },
  'sv':    { female: 'sv-SE-SofieNeural',        male: 'sv-SE-MattiasNeural' },
  'el':    { female: 'el-GR-AthinaNeural',       male: 'el-GR-NestorasNeural' },
  'cs':    { female: 'cs-CZ-VlastaNeural',       male: 'cs-CZ-AntoninNeural' },
  'ro':    { female: 'ro-RO-AlinaNeural',        male: 'ro-RO-EmilNeural' },
  'hu':    { female: 'hu-HU-NoemiNeural',        male: 'hu-HU-TamasNeural' },
  'fi':    { female: 'fi-FI-NooraNeural',        male: 'fi-FI-HarriNeural' },
  // ── Regional variants (native speakers) ──
  'en-GB': { female: 'en-GB-SoniaNeural',        male: 'en-GB-RyanNeural' },
  'es-MX': { female: 'es-MX-DaliaNeural',        male: 'es-MX-JorgeNeural' },
  'fr-CA': { female: 'fr-CA-SylvieNeural',       male: 'fr-CA-JeanNeural' },
  'pt-PT': { female: 'pt-PT-RaquelNeural',       male: 'pt-PT-DuarteNeural' },
  'zh-TW': { female: 'zh-TW-HsiaoChenNeural',    male: 'zh-TW-YunJheNeural' },
  'ar-EG': { female: 'ar-EG-SalmaNeural',        male: 'ar-EG-ShakirNeural' },
  // ── New languages ──
  'uk':    { female: 'uk-UA-PolinaNeural',       male: 'uk-UA-OstapNeural' },
  'da':    { female: 'da-DK-ChristelNeural',     male: 'da-DK-JeppeNeural' },
  'nb':    { female: 'nb-NO-PernilleNeural',     male: 'nb-NO-FinnNeural' },
  'he':    { female: 'he-IL-HilaNeural',         male: 'he-IL-AvriNeural' },
  'fil':   { female: 'fil-PH-BlessicaNeural',    male: 'fil-PH-AngeloNeural' },
  'bg':    { female: 'bg-BG-KalinaNeural',       male: 'bg-BG-BorislavNeural' },
  'hr':    { female: 'hr-HR-GabrijelaNeural',    male: 'hr-HR-SreckoNeural' },
  'sk':    { female: 'sk-SK-ViktoriaNeural',     male: 'sk-SK-LukasNeural' },
  'ca':    { female: 'ca-ES-JoanaNeural',        male: 'ca-ES-EnricNeural' },
  'bn':    { female: 'bn-BD-NabanitaNeural',     male: 'bn-BD-PradeepNeural' },
  'ta':    { female: 'ta-IN-PallaviNeural',      male: 'ta-IN-ValluvarNeural' },
  'sw':    { female: 'sw-KE-ZuriNeural',         male: 'sw-KE-RafikiNeural' },
  'af':    { female: 'af-ZA-AdriNeural',         male: 'af-ZA-WillemNeural' },
};

/**
 * Get the Edge TTS voice name for a language code + gender.
 * Tries exact match first (e.g. 'en-GB'), then 2-letter fallback ('en').
 * @param {string} langCode - e.g. 'th', 'zh', 'en-GB', 'pt-PT'
 * @param {string} gender - 'female' or 'male'
 * @returns {string} Voice name for Edge TTS
 */
export function getEdgeVoice(langCode, gender = 'female') {
  // Try exact match first (for regional variants like en-GB, zh-TW)
  const exact = EDGE_VOICES[langCode];
  if (exact) return exact[gender] || exact.female;
  // Fallback to 2-letter base code
  const lang2 = langCode.replace(/-.*/, '');
  const voices = EDGE_VOICES[lang2] || EDGE_VOICES['en'];
  return voices[gender] || voices.female;
}

/**
 * Get all available voices for a language (for Settings UI)
 */
export function getAvailableEdgeVoices(langCode) {
  const exact = EDGE_VOICES[langCode];
  if (exact) return exact;
  const lang2 = langCode.replace(/-.*/, '');
  return EDGE_VOICES[lang2] || EDGE_VOICES['en'];
}
