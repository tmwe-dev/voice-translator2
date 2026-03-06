// Shared constants for VoiceTranslate app

export const APP_URL = process.env.NEXT_PUBLIC_URL || 'https://www.voicetranslate.app';

export const LANGS = [
  { code:'it', name:'Italiano', flag:'\u{1F1EE}\u{1F1F9}', speech:'it-IT' },
  { code:'th', name:'\u0E44\u0E17\u0E22 (Thai)', flag:'\u{1F1F9}\u{1F1ED}', speech:'th-TH' },
  { code:'en', name:'English', flag:'\u{1F1EC}\u{1F1E7}', speech:'en-US' },
  { code:'es', name:'Espa\u00F1ol', flag:'\u{1F1EA}\u{1F1F8}', speech:'es-ES' },
  { code:'fr', name:'Fran\u00E7ais', flag:'\u{1F1EB}\u{1F1F7}', speech:'fr-FR' },
  { code:'de', name:'Deutsch', flag:'\u{1F1E9}\u{1F1EA}', speech:'de-DE' },
  { code:'pt', name:'Portugu\u00EAs', flag:'\u{1F1E7}\u{1F1F7}', speech:'pt-BR' },
  { code:'zh', name:'\u4E2D\u6587', flag:'\u{1F1E8}\u{1F1F3}', speech:'zh-CN' },
  { code:'ja', name:'\u65E5\u672C\u8A9E', flag:'\u{1F1EF}\u{1F1F5}', speech:'ja-JP' },
  { code:'ko', name:'\uD55C\uAD6D\uC5B4', flag:'\u{1F1F0}\u{1F1F7}', speech:'ko-KR' },
  { code:'ar', name:'\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag:'\u{1F1F8}\u{1F1E6}', speech:'ar-SA' },
  { code:'hi', name:'\u0939\u093F\u0928\u094D\u0926\u0940', flag:'\u{1F1EE}\u{1F1F3}', speech:'hi-IN' },
  { code:'ru', name:'\u0420\u0443\u0441\u0441\u043A\u0438\u0439', flag:'\u{1F1F7}\u{1F1FA}', speech:'ru-RU' },
  { code:'tr', name:'T\u00FCrk\u00E7e', flag:'\u{1F1F9}\u{1F1F7}', speech:'tr-TR' },
  { code:'vi', name:'Ti\u1EBFng Vi\u1EC7t', flag:'\u{1F1FB}\u{1F1F3}', speech:'vi-VN' },
  { code:'id', name:'Bahasa Indonesia', flag:'\u{1F1EE}\u{1F1E9}', speech:'id-ID' },
  { code:'ms', name:'Bahasa Melayu', flag:'\u{1F1F2}\u{1F1FE}', speech:'ms-MY' },
  { code:'nl', name:'Nederlands', flag:'\u{1F1F3}\u{1F1F1}', speech:'nl-NL' },
  { code:'pl', name:'Polski', flag:'\u{1F1F5}\u{1F1F1}', speech:'pl-PL' },
  { code:'sv', name:'Svenska', flag:'\u{1F1F8}\u{1F1EA}', speech:'sv-SE' },
  { code:'el', name:'\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC', flag:'\u{1F1EC}\u{1F1F7}', speech:'el-GR' },
  { code:'cs', name:'\u010Ce\u0161tina', flag:'\u{1F1E8}\u{1F1FF}', speech:'cs-CZ' },
  { code:'ro', name:'Rom\u00E2n\u0103', flag:'\u{1F1F7}\u{1F1F4}', speech:'ro-RO' },
  { code:'hu', name:'Magyar', flag:'\u{1F1ED}\u{1F1FA}', speech:'hu-HU' },
  { code:'fi', name:'Suomi', flag:'\u{1F1EB}\u{1F1EE}', speech:'fi-FI' },
];

export const VOICES = ['alloy','echo','fable','onyx','nova','shimmer'];

// AI translation models
// ownKeyOnly: true means only available for users with own API keys
export const AI_MODELS = [
  { id:'gpt-4o-mini', name:'GPT-4o Mini', desc:'Veloce ed economico', cost:'~0.1¢/msg', provider:'openai', default:true },
  { id:'gpt-4o', name:'GPT-4o', desc:'Più preciso, costo 10x', cost:'~1¢/msg', provider:'openai', ownKeyOnly:true },
  { id:'claude-sonnet', name:'Claude Sonnet 4.5', desc:'Eccellente qualità', cost:'~0.5¢/msg', provider:'anthropic', ownKeyOnly:true },
  { id:'claude-haiku', name:'Claude Haiku 4.5', desc:'Veloce e preciso', cost:'~0.1¢/msg', provider:'anthropic', ownKeyOnly:true },
  { id:'gemini-flash', name:'Gemini 2.0 Flash', desc:'Ultra veloce, Google', cost:'~0.05¢/msg', provider:'gemini', ownKeyOnly:true },
  { id:'gemini-pro', name:'Gemini 2.5 Pro', desc:'Alta qualità, Google', cost:'~0.3¢/msg', provider:'gemini', ownKeyOnly:true },
];
export const AVATARS = Array.from({length:9}, (_,i) => `/avatars/${i+1}.png`);
export const AVATAR_NAMES = ['Marcus','Elena','Omar','Aisha','Alex','Thomas','Yuki','Margaret','Leo'];

export const MODES = [
  { id:'conversation', nameKey:'conversation', icon:'\u{1F4AC}', descKey:'conversationDesc' },
  { id:'classroom', nameKey:'classroom', icon:'\u{1F3EB}', descKey:'classroomDesc' },
  { id:'freetalk', nameKey:'freeTalk', icon:'\u{1F389}', descKey:'freeTalkDesc' },
  { id:'simultaneous', nameKey:'simultaneous', icon:'\u{26A1}', descKey:'simultaneousDesc' },
];

export const CONTEXTS = [
  { id:'general', icon:'\u{1F30D}', nameKey:'ctxGeneral', descKey:'ctxGeneralDesc', prompt:'' },
  { id:'tourism', icon:'\u{1F3D6}\uFE0F', nameKey:'ctxTourism', descKey:'ctxTourismDesc',
    prompt:'This is a tourism/travel conversation. Use travel terminology: directions, accommodation, sightseeing, transportation, restaurants, bookings. Keep translations practical and clear for travelers.' },
  { id:'medical', icon:'\u{1F3E5}', nameKey:'ctxMedical', descKey:'ctxMedicalDesc',
    prompt:'This is a medical conversation. Use precise medical terminology: symptoms, medications, dosages, diagnoses, body parts, medical procedures. Accuracy is critical - never approximate medical terms.' },
  { id:'education', icon:'\u{1F393}', nameKey:'ctxEducation', descKey:'ctxEducationDesc',
    prompt:'This is an educational conversation. Use academic terminology: courses, grades, assignments, lectures, exams, enrollment. Keep the tone educational and clear.' },
  { id:'business', icon:'\u{1F4BC}', nameKey:'ctxBusiness', descKey:'ctxBusinessDesc',
    prompt:'This is a business conversation. Use professional/corporate terminology: contracts, negotiations, deadlines, KPIs, deliverables, stakeholders. Maintain formal register.' },
  { id:'restaurant', icon:'\u{1F37D}\uFE0F', nameKey:'ctxRestaurant', descKey:'ctxRestaurantDesc',
    prompt:'This is a restaurant/dining conversation. Use food and hospitality terminology: menu items, ingredients, allergies, dietary restrictions, cooking methods, reservations. Be precise about food terms.' },
  { id:'personal', icon:'\u{1F91D}', nameKey:'ctxPersonal', descKey:'ctxPersonalDesc',
    prompt:'This is an informal personal meeting. Use friendly, conversational tone. Translate idioms and colloquialisms naturally rather than literally. Preserve humor and warmth.' },
  { id:'legal', icon:'\u{2696}\uFE0F', nameKey:'ctxLegal', descKey:'ctxLegalDesc',
    prompt:'This is a legal conversation. Use precise legal terminology: contracts, clauses, liability, compliance, jurisdiction, regulations. Never paraphrase legal terms - translate them exactly.' },
  { id:'shopping', icon:'\u{1F6CD}\uFE0F', nameKey:'ctxShopping', descKey:'ctxShoppingDesc',
    prompt:'This is a shopping conversation. Use retail terminology: prices, sizes, colors, discounts, returns, payment methods, warranties. Be precise with numbers and measurements.' },
  { id:'realestate', icon:'\u{1F3E0}', nameKey:'ctxRealEstate', descKey:'ctxRealEstateDesc',
    prompt:'This is a real estate conversation. Use property terminology: rent, lease, mortgage, square meters, rooms, amenities, neighborhood, deposits, inspections.' },
  { id:'tech', icon:'\u{1F527}', nameKey:'ctxTech', descKey:'ctxTechDesc',
    prompt:'This is a technical support conversation. Use technical terminology: troubleshooting, error codes, specifications, warranties, repairs, configurations. Be precise with technical terms.' },
  { id:'emergency', icon:'\u{1F6A8}', nameKey:'ctxEmergency', descKey:'ctxEmergencyDesc',
    prompt:'This is an EMERGENCY conversation. Translate with maximum clarity and urgency. Use direct, unambiguous language. Include emergency-specific terms: location, danger, injury, police, ambulance, fire. Speed and clarity are paramount.' },
];

export const FONT = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const THEMES = { DARK: 'dark', LIGHT: 'light', BROWN: 'brown', ORANGE: 'orange' };
export const THEME_LIST = [
  { id:'dark', name:'Dark', icon:'\uD83C\uDF19', desc:'Tema scuro classico' },
  { id:'light', name:'Light', icon:'\u2600\uFE0F', desc:'Tema chiaro' },
  { id:'brown', name:'Elegante', icon:'\u{1F33F}', desc:'Marrone scuro elegante' },
  { id:'orange', name:'Vivace', icon:'\u{1F525}', desc:'Arancione energico' },
];

export const FREE_DAILY_LIMIT = 50000;

export const CREDIT_PACKAGES = [
  { id:'pack_starter', euros:0.90, credits:90, label:'\u20AC0.90', messages:'90 crediti', starter:true,
    icon:'\u{1F680}', perks:['creditPerksStarter1','creditPerksStarter2'] },
  { id:'pack_2', euros:2, credits:200, label:'\u20AC2', messages:'200 crediti',
    icon:'\u{1F4AC}', perks:['creditPerks2_1','creditPerks2_2'] },
  { id:'pack_5', euros:5, credits:550, label:'\u20AC5', messages:'550 crediti', bonus:'+10%', popular:true,
    icon:'\u{2B50}', perks:['creditPerks5_1','creditPerks5_2','creditPerks5_3'] },
  { id:'pack_10', euros:10, credits:1200, label:'\u20AC10', messages:'1200 crediti', bonus:'+20%',
    icon:'\u{1F451}', perks:['creditPerks10_1','creditPerks10_2','creditPerks10_3'], topProTrial:20 },
  { id:'pack_20', euros:20, credits:2600, label:'\u20AC20', messages:'2600 crediti', bonus:'+30%',
    icon:'\u{1F48E}', perks:['creditPerks20_1','creditPerks20_2','creditPerks20_3'], topProTrial:50 },
];

// Referral system
export const REFERRAL_BONUS_NEW = 50;
export const REFERRAL_BONUS_REFERRER = 100;

// Timing constants
export const POLLING_INTERVAL = 1000;       // ms between room polls (was 1200)
export const SILENCE_DELAY = 1300;          // ms of silence before auto-stop (was 2000)
export const VAD_THRESHOLD = 25;            // Voice Activity Detection volume threshold
export const REVIEW_INTERVAL = 8000;        // ms between translation reviews (was 12000)
export const CHUNK_MIN_WORDS = 3;           // words before emitting translation chunk (was 4)
export const CHUNK_MAX_WORDS = 10;          // interim words before force-emit (was 12)
export const LIVE_TEXT_THROTTLE = 600;      // ms throttle for live text broadcast (was 800)
export const TYPING_TIMEOUT = 5000;         // ms before typing indicator expires
export const SPEAKING_TIMEOUT = 30000;      // ms before speaking indicator expires
export const STATUS_DISPLAY_TIME = 2000;    // ms to show status messages
export const BROWSER_SPEAK_MIN_DURATION = 1500;
export const BROWSER_SPEAK_CHAR_RATE = 80;

// STT Engine Selection — languages where browser SpeechRecognition is unreliable
// These languages use Whisper/gpt-4o-mini-transcribe as PRIMARY STT engine
export const WHISPER_PRIMARY_LANGS = new Set([
  'th',  // Thai — tonal, no spaces, browser STT very poor
  'zh',  // Chinese — character-based, browser STT mediocre
  'ja',  // Japanese — mixed scripts, browser STT inconsistent
  'ko',  // Korean — browser STT acceptable but Whisper is much better
  'ar',  // Arabic — RTL + diacritics, browser STT often fails
  'hi',  // Hindi — Devanagari script, limited browser support
  'vi',  // Vietnamese — tonal + diacritics, browser STT poor
]);

// Minimum confidence threshold for browser SpeechRecognition
// Below this, auto-switch to Whisper fallback for the rest of the session
export const STT_CONFIDENCE_THRESHOLD = 0.55;
export const STT_LOW_CONFIDENCE_COUNT = 3; // consecutive low-confidence results before switching

// Helpers
export function getLang(code) { return LANGS.find(l => l.code === code) || LANGS[0]; }
export function isWhisperPrimaryLang(code) { return WHISPER_PRIMARY_LANGS.has(code); }

export function vibrate(ms = 15) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
}

export function formatCredits(cents) {
  return '\u20AC' + (cents / 100).toFixed(2);
}
