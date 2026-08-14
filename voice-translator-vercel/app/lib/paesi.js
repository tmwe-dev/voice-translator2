// ═══════════════════════════════════════════════════════════════
// PAESI — la tabella da cui nasce tutta la configurazione (b.136)
//
// Fino a b.135 la lingua si sceglieva da un elenco di LINGUE, e da
// nessuna parte si sapeva DA DOVE viene chi usa l'applicazione. Le
// conseguenze erano due, tutte e due visibili:
//
//   - il profilo non aveva una bandiera vera, solo quella della lingua
//     (un messicano risultava spagnolo, un brasiliano portoghese);
//   - non c'era modo di indovinare bene la prima volta, perche
//     `navigator.language` da "es" e basta su meta dei telefoni.
//
// Il paese invece si indovina da due indizi indipendenti — la regione
// di `navigator.language` (it-IT -> IT) e il fuso orario del sistema
// (Europe/Rome -> IT) — e dal paese discende tutto il resto: lingua
// parlata, lingua dell'interfaccia, bandiera.
//
// `lingua` e un codice di LANGS (constants.js). La lingua
// dell'INTERFACCIA si ricava da questa con mapLang() di i18n.js,
// perche l'interfaccia esiste solo in 15 lingue mentre le lingue
// parlate sono 44.
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Paese
 * @property {string} codice   ISO 3166-1 alpha-2
 * @property {string} nome     nome nella lingua del posto
 * @property {string} nomeEn   nome in inglese (per la ricerca di chi cerca "Germany")
 * @property {string} bandiera emoji
 * @property {string} lingua   codice di LANGS
 * @property {string[]} fusi   fusi orari IANA principali, per indovinare
 */

export const PAESI = [
  { codice:'IT', nome:'Italia', nomeEn:'Italy', bandiera:'\u{1F1EE}\u{1F1F9}', lingua:'it', fusi:['Europe/Rome'] },
  { codice:'US', nome:'United States', nomeEn:'United States', bandiera:'\u{1F1FA}\u{1F1F8}', lingua:'en', fusi:['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','America/Anchorage','Pacific/Honolulu','America/Detroit'] },
  { codice:'GB', nome:'United Kingdom', nomeEn:'United Kingdom', bandiera:'\u{1F1EC}\u{1F1E7}', lingua:'en-GB', fusi:['Europe/London'] },
  { codice:'IE', nome:'Ireland', nomeEn:'Ireland', bandiera:'\u{1F1EE}\u{1F1EA}', lingua:'en-GB', fusi:['Europe/Dublin'] },
  { codice:'CA', nome:'Canada', nomeEn:'Canada', bandiera:'\u{1F1E8}\u{1F1E6}', lingua:'en', fusi:['America/Toronto','America/Vancouver','America/Edmonton','America/Winnipeg','America/Halifax','America/St_Johns'] },
  { codice:'AU', nome:'Australia', nomeEn:'Australia', bandiera:'\u{1F1E6}\u{1F1FA}', lingua:'en', fusi:['Australia/Sydney','Australia/Melbourne','Australia/Brisbane','Australia/Perth','Australia/Adelaide','Australia/Darwin','Australia/Hobart'] },
  { codice:'NZ', nome:'New Zealand', nomeEn:'New Zealand', bandiera:'\u{1F1F3}\u{1F1FF}', lingua:'en', fusi:['Pacific/Auckland'] },
  { codice:'ES', nome:'España', nomeEn:'Spain', bandiera:'\u{1F1EA}\u{1F1F8}', lingua:'es', fusi:['Europe/Madrid','Atlantic/Canary'] },
  { codice:'MX', nome:'México', nomeEn:'Mexico', bandiera:'\u{1F1F2}\u{1F1FD}', lingua:'es-MX', fusi:['America/Mexico_City','America/Monterrey','America/Tijuana','America/Cancun'] },
  { codice:'AR', nome:'Argentina', nomeEn:'Argentina', bandiera:'\u{1F1E6}\u{1F1F7}', lingua:'es', fusi:['America/Argentina/Buenos_Aires','America/Argentina/Cordoba'] },
  { codice:'CO', nome:'Colombia', nomeEn:'Colombia', bandiera:'\u{1F1E8}\u{1F1F4}', lingua:'es', fusi:['America/Bogota'] },
  { codice:'CL', nome:'Chile', nomeEn:'Chile', bandiera:'\u{1F1E8}\u{1F1F1}', lingua:'es', fusi:['America/Santiago'] },
  { codice:'PE', nome:'Perú', nomeEn:'Peru', bandiera:'\u{1F1F5}\u{1F1EA}', lingua:'es', fusi:['America/Lima'] },
  { codice:'VE', nome:'Venezuela', nomeEn:'Venezuela', bandiera:'\u{1F1FB}\u{1F1EA}', lingua:'es', fusi:['America/Caracas'] },
  { codice:'EC', nome:'Ecuador', nomeEn:'Ecuador', bandiera:'\u{1F1EA}\u{1F1E8}', lingua:'es', fusi:['America/Guayaquil'] },
  { codice:'UY', nome:'Uruguay', nomeEn:'Uruguay', bandiera:'\u{1F1FA}\u{1F1FE}', lingua:'es', fusi:['America/Montevideo'] },
  { codice:'CU', nome:'Cuba', nomeEn:'Cuba', bandiera:'\u{1F1E8}\u{1F1FA}', lingua:'es', fusi:['America/Havana'] },
  { codice:'DO', nome:'República Dominicana', nomeEn:'Dominican Republic', bandiera:'\u{1F1E9}\u{1F1F4}', lingua:'es', fusi:['America/Santo_Domingo'] },
  { codice:'GT', nome:'Guatemala', nomeEn:'Guatemala', bandiera:'\u{1F1EC}\u{1F1F9}', lingua:'es', fusi:['America/Guatemala'] },
  { codice:'CR', nome:'Costa Rica', nomeEn:'Costa Rica', bandiera:'\u{1F1E8}\u{1F1F7}', lingua:'es', fusi:['America/Costa_Rica'] },
  { codice:'PA', nome:'Panamá', nomeEn:'Panama', bandiera:'\u{1F1F5}\u{1F1E6}', lingua:'es', fusi:['America/Panama'] },
  { codice:'BO', nome:'Bolivia', nomeEn:'Bolivia', bandiera:'\u{1F1E7}\u{1F1F4}', lingua:'es', fusi:['America/La_Paz'] },
  { codice:'PY', nome:'Paraguay', nomeEn:'Paraguay', bandiera:'\u{1F1F5}\u{1F1FE}', lingua:'es', fusi:['America/Asuncion'] },
  { codice:'BR', nome:'Brasil', nomeEn:'Brazil', bandiera:'\u{1F1E7}\u{1F1F7}', lingua:'pt', fusi:['America/Sao_Paulo','America/Bahia','America/Fortaleza','America/Manaus','America/Recife'] },
  { codice:'PT', nome:'Portugal', nomeEn:'Portugal', bandiera:'\u{1F1F5}\u{1F1F9}', lingua:'pt-PT', fusi:['Europe/Lisbon','Atlantic/Azores','Atlantic/Madeira'] },
  { codice:'AO', nome:'Angola', nomeEn:'Angola', bandiera:'\u{1F1E6}\u{1F1F4}', lingua:'pt-PT', fusi:['Africa/Luanda'] },
  { codice:'MZ', nome:'Moçambique', nomeEn:'Mozambique', bandiera:'\u{1F1F2}\u{1F1FF}', lingua:'pt-PT', fusi:['Africa/Maputo'] },
  { codice:'FR', nome:'France', nomeEn:'France', bandiera:'\u{1F1EB}\u{1F1F7}', lingua:'fr', fusi:['Europe/Paris'] },
  { codice:'BE', nome:'Belgique / België', nomeEn:'Belgium', bandiera:'\u{1F1E7}\u{1F1EA}', lingua:'fr', fusi:['Europe/Brussels'] },
  { codice:'CH', nome:'Schweiz / Suisse', nomeEn:'Switzerland', bandiera:'\u{1F1E8}\u{1F1ED}', lingua:'de', fusi:['Europe/Zurich'] },
  { codice:'LU', nome:'Luxembourg', nomeEn:'Luxembourg', bandiera:'\u{1F1F1}\u{1F1FA}', lingua:'fr', fusi:['Europe/Luxembourg'] },
  { codice:'MC', nome:'Monaco', nomeEn:'Monaco', bandiera:'\u{1F1F2}\u{1F1E8}', lingua:'fr', fusi:['Europe/Monaco'] },
  { codice:'SN', nome:'Sénégal', nomeEn:'Senegal', bandiera:'\u{1F1F8}\u{1F1F3}', lingua:'fr', fusi:['Africa/Dakar'] },
  { codice:'CI', nome:'Côte d’Ivoire', nomeEn:'Ivory Coast', bandiera:'\u{1F1E8}\u{1F1EE}', lingua:'fr', fusi:['Africa/Abidjan'] },
  { codice:'MA', nome:'المغرب', nomeEn:'Morocco', bandiera:'\u{1F1F2}\u{1F1E6}', lingua:'ar', fusi:['Africa/Casablanca'] },
  { codice:'TN', nome:'تونس', nomeEn:'Tunisia', bandiera:'\u{1F1F9}\u{1F1F3}', lingua:'ar', fusi:['Africa/Tunis'] },
  { codice:'DZ', nome:'الجزائر', nomeEn:'Algeria', bandiera:'\u{1F1E9}\u{1F1FF}', lingua:'ar', fusi:['Africa/Algiers'] },
  { codice:'EG', nome:'مصر', nomeEn:'Egypt', bandiera:'\u{1F1EA}\u{1F1EC}', lingua:'ar-EG', fusi:['Africa/Cairo'] },
  { codice:'SA', nome:'السعودية', nomeEn:'Saudi Arabia', bandiera:'\u{1F1F8}\u{1F1E6}', lingua:'ar', fusi:['Asia/Riyadh'] },
  { codice:'AE', nome:'الإمارات', nomeEn:'United Arab Emirates', bandiera:'\u{1F1E6}\u{1F1EA}', lingua:'ar', fusi:['Asia/Dubai'] },
  { codice:'QA', nome:'قطر', nomeEn:'Qatar', bandiera:'\u{1F1F6}\u{1F1E6}', lingua:'ar', fusi:['Asia/Qatar'] },
  { codice:'KW', nome:'الكويت', nomeEn:'Kuwait', bandiera:'\u{1F1F0}\u{1F1FC}', lingua:'ar', fusi:['Asia/Kuwait'] },
  { codice:'JO', nome:'الأردن', nomeEn:'Jordan', bandiera:'\u{1F1EF}\u{1F1F4}', lingua:'ar', fusi:['Asia/Amman'] },
  { codice:'LB', nome:'لبنان', nomeEn:'Lebanon', bandiera:'\u{1F1F1}\u{1F1E7}', lingua:'ar', fusi:['Asia/Beirut'] },
  { codice:'IQ', nome:'العراق', nomeEn:'Iraq', bandiera:'\u{1F1EE}\u{1F1F6}', lingua:'ar', fusi:['Asia/Baghdad'] },
  { codice:'DE', nome:'Deutschland', nomeEn:'Germany', bandiera:'\u{1F1E9}\u{1F1EA}', lingua:'de', fusi:['Europe/Berlin','Europe/Busingen'] },
  { codice:'AT', nome:'Österreich', nomeEn:'Austria', bandiera:'\u{1F1E6}\u{1F1F9}', lingua:'de', fusi:['Europe/Vienna'] },
  { codice:'NL', nome:'Nederland', nomeEn:'Netherlands', bandiera:'\u{1F1F3}\u{1F1F1}', lingua:'nl', fusi:['Europe/Amsterdam'] },
  { codice:'PL', nome:'Polska', nomeEn:'Poland', bandiera:'\u{1F1F5}\u{1F1F1}', lingua:'pl', fusi:['Europe/Warsaw'] },
  { codice:'SE', nome:'Sverige', nomeEn:'Sweden', bandiera:'\u{1F1F8}\u{1F1EA}', lingua:'sv', fusi:['Europe/Stockholm'] },
  { codice:'NO', nome:'Norge', nomeEn:'Norway', bandiera:'\u{1F1F3}\u{1F1F4}', lingua:'nb', fusi:['Europe/Oslo'] },
  { codice:'DK', nome:'Danmark', nomeEn:'Denmark', bandiera:'\u{1F1E9}\u{1F1F0}', lingua:'da', fusi:['Europe/Copenhagen'] },
  { codice:'FI', nome:'Suomi', nomeEn:'Finland', bandiera:'\u{1F1EB}\u{1F1EE}', lingua:'fi', fusi:['Europe/Helsinki'] },
  { codice:'IS', nome:'Ísland', nomeEn:'Iceland', bandiera:'\u{1F1EE}\u{1F1F8}', lingua:'en', fusi:['Atlantic/Reykjavik'] },
  { codice:'GR', nome:'Ελλάδα', nomeEn:'Greece', bandiera:'\u{1F1EC}\u{1F1F7}', lingua:'el', fusi:['Europe/Athens'] },
  { codice:'CZ', nome:'Česko', nomeEn:'Czechia', bandiera:'\u{1F1E8}\u{1F1FF}', lingua:'cs', fusi:['Europe/Prague'] },
  { codice:'SK', nome:'Slovensko', nomeEn:'Slovakia', bandiera:'\u{1F1F8}\u{1F1F0}', lingua:'sk', fusi:['Europe/Bratislava'] },
  { codice:'HU', nome:'Magyarország', nomeEn:'Hungary', bandiera:'\u{1F1ED}\u{1F1FA}', lingua:'hu', fusi:['Europe/Budapest'] },
  { codice:'RO', nome:'România', nomeEn:'Romania', bandiera:'\u{1F1F7}\u{1F1F4}', lingua:'ro', fusi:['Europe/Bucharest'] },
  { codice:'BG', nome:'България', nomeEn:'Bulgaria', bandiera:'\u{1F1E7}\u{1F1EC}', lingua:'bg', fusi:['Europe/Sofia'] },
  { codice:'HR', nome:'Hrvatska', nomeEn:'Croatia', bandiera:'\u{1F1ED}\u{1F1F7}', lingua:'hr', fusi:['Europe/Zagreb'] },
  { codice:'RS', nome:'Srbija', nomeEn:'Serbia', bandiera:'\u{1F1F7}\u{1F1F8}', lingua:'hr', fusi:['Europe/Belgrade'] },
  { codice:'SI', nome:'Slovenija', nomeEn:'Slovenia', bandiera:'\u{1F1F8}\u{1F1EE}', lingua:'hr', fusi:['Europe/Ljubljana'] },
  { codice:'UA', nome:'Україна', nomeEn:'Ukraine', bandiera:'\u{1F1FA}\u{1F1E6}', lingua:'uk', fusi:['Europe/Kyiv','Europe/Kiev'] },
  { codice:'RU', nome:'Россия', nomeEn:'Russia', bandiera:'\u{1F1F7}\u{1F1FA}', lingua:'ru', fusi:['Europe/Moscow','Asia/Yekaterinburg','Asia/Novosibirsk','Asia/Vladivostok'] },
  { codice:'TR', nome:'Türkiye', nomeEn:'Turkey', bandiera:'\u{1F1F9}\u{1F1F7}', lingua:'tr', fusi:['Europe/Istanbul'] },
  { codice:'IL', nome:'ישראל', nomeEn:'Israel', bandiera:'\u{1F1EE}\u{1F1F1}', lingua:'he', fusi:['Asia/Jerusalem'] },
  { codice:'CN', nome:'中国', nomeEn:'China', bandiera:'\u{1F1E8}\u{1F1F3}', lingua:'zh', fusi:['Asia/Shanghai','Asia/Chongqing','Asia/Urumqi'] },
  { codice:'TW', nome:'台灣', nomeEn:'Taiwan', bandiera:'\u{1F1F9}\u{1F1FC}', lingua:'zh-TW', fusi:['Asia/Taipei'] },
  { codice:'HK', nome:'香港', nomeEn:'Hong Kong', bandiera:'\u{1F1ED}\u{1F1F0}', lingua:'zh-TW', fusi:['Asia/Hong_Kong'] },
  { codice:'SG', nome:'Singapore', nomeEn:'Singapore', bandiera:'\u{1F1F8}\u{1F1EC}', lingua:'en', fusi:['Asia/Singapore'] },
  { codice:'JP', nome:'日本', nomeEn:'Japan', bandiera:'\u{1F1EF}\u{1F1F5}', lingua:'ja', fusi:['Asia/Tokyo'] },
  { codice:'KR', nome:'대한민국', nomeEn:'South Korea', bandiera:'\u{1F1F0}\u{1F1F7}', lingua:'ko', fusi:['Asia/Seoul'] },
  { codice:'TH', nome:'ประเทศไทย', nomeEn:'Thailand', bandiera:'\u{1F1F9}\u{1F1ED}', lingua:'th', fusi:['Asia/Bangkok'] },
  { codice:'VN', nome:'Việt Nam', nomeEn:'Vietnam', bandiera:'\u{1F1FB}\u{1F1F3}', lingua:'vi', fusi:['Asia/Ho_Chi_Minh','Asia/Saigon'] },
  { codice:'ID', nome:'Indonesia', nomeEn:'Indonesia', bandiera:'\u{1F1EE}\u{1F1E9}', lingua:'id', fusi:['Asia/Jakarta','Asia/Makassar','Asia/Jayapura'] },
  { codice:'MY', nome:'Malaysia', nomeEn:'Malaysia', bandiera:'\u{1F1F2}\u{1F1FE}', lingua:'ms', fusi:['Asia/Kuala_Lumpur','Asia/Kuching'] },
  { codice:'PH', nome:'Pilipinas', nomeEn:'Philippines', bandiera:'\u{1F1F5}\u{1F1ED}', lingua:'fil', fusi:['Asia/Manila'] },
  { codice:'IN', nome:'भारत', nomeEn:'India', bandiera:'\u{1F1EE}\u{1F1F3}', lingua:'hi', fusi:['Asia/Kolkata','Asia/Calcutta'] },
  { codice:'PK', nome:'پاکستان', nomeEn:'Pakistan', bandiera:'\u{1F1F5}\u{1F1F0}', lingua:'hi', fusi:['Asia/Karachi'] },
  { codice:'BD', nome:'বাংলাদেশ', nomeEn:'Bangladesh', bandiera:'\u{1F1E7}\u{1F1E9}', lingua:'bn', fusi:['Asia/Dhaka'] },
  { codice:'LK', nome:'Sri Lanka', nomeEn:'Sri Lanka', bandiera:'\u{1F1F1}\u{1F1F0}', lingua:'ta', fusi:['Asia/Colombo'] },
  { codice:'NP', nome:'नेपाल', nomeEn:'Nepal', bandiera:'\u{1F1F3}\u{1F1F5}', lingua:'hi', fusi:['Asia/Kathmandu'] },
  { codice:'ZA', nome:'South Africa', nomeEn:'South Africa', bandiera:'\u{1F1FF}\u{1F1E6}', lingua:'af', fusi:['Africa/Johannesburg'] },
  { codice:'NG', nome:'Nigeria', nomeEn:'Nigeria', bandiera:'\u{1F1F3}\u{1F1EC}', lingua:'en', fusi:['Africa/Lagos'] },
  { codice:'KE', nome:'Kenya', nomeEn:'Kenya', bandiera:'\u{1F1F0}\u{1F1EA}', lingua:'sw', fusi:['Africa/Nairobi'] },
  { codice:'TZ', nome:'Tanzania', nomeEn:'Tanzania', bandiera:'\u{1F1F9}\u{1F1FF}', lingua:'sw', fusi:['Africa/Dar_es_Salaam'] },
  { codice:'GH', nome:'Ghana', nomeEn:'Ghana', bandiera:'\u{1F1EC}\u{1F1ED}', lingua:'en', fusi:['Africa/Accra'] },
  { codice:'ET', nome:'Ethiopia', nomeEn:'Ethiopia', bandiera:'\u{1F1EA}\u{1F1F9}', lingua:'en', fusi:['Africa/Addis_Ababa'] },
];

/** Indice fuso orario -> codice paese, costruito una volta sola. */
const PER_FUSO = (() => {
  const m = {};
  for (const p of PAESI) for (const f of p.fusi) m[f] = p.codice;
  return m;
})();

/** @returns {Paese|undefined} */
export function getPaese(codice) {
  if (!codice) return undefined;
  const c = String(codice).toUpperCase();
  return PAESI.find(p => p.codice === c);
}

/**
 * Ricerca per testo: nome locale, nome inglese, codice.
 * Insensibile a maiuscole e ad accenti — chi cerca "espana" deve
 * trovare "Espana" anche senza la tilde sulla tastiera.
 */
export function cercaPaesi(testo) {
  const q = normalizza(testo);
  if (!q) return PAESI;
  return PAESI.filter(p =>
    normalizza(p.nome).includes(q) ||
    normalizza(p.nomeEn).includes(q) ||
    p.codice.toLowerCase().startsWith(q)
  );
}

function normalizza(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

/**
 * Indovina il paese da due indizi indipendenti, in quest'ordine:
 *
 *   1. la REGIONE di navigator.language ("it-IT" -> IT). E l'indizio
 *      piu forte quando c'e, perche l'utente l'ha scelta lui nel
 *      sistema operativo;
 *   2. il FUSO ORARIO ("Europe/Rome" -> IT). Serve nella meta dei casi
 *      in cui la lingua arriva senza regione ("es", "en");
 *   3. la sola LINGUA, prendendo il primo paese che la parla. Ultima
 *      risorsa: e una tirata a indovinare, ma meglio di niente.
 *
 * Non decide niente da sola: e solo la proposta che la schermata
 * mette in cima. L'utente conferma o cerca il suo.
 *
 * @returns {Paese|undefined}
 */
export function indovinaPaese({ lingua, fuso } = {}) {
  const lang = lingua || (typeof navigator !== 'undefined' ? navigator.language : '') || '';
  const tz = fuso || (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
    catch { return ''; } // qualche browser vecchio non ha resolvedOptions
  })();

  const regione = (lang.split('-')[1] || '').toUpperCase();
  const perRegione = getPaese(regione);
  if (perRegione) return perRegione;

  const perFuso = getPaese(PER_FUSO[tz]);
  if (perFuso) return perFuso;

  const base = (lang.split('-')[0] || '').toLowerCase();
  if (base) {
    const perLingua = PAESI.find(p => p.lingua === base || p.lingua.split('-')[0] === base);
    if (perLingua) return perLingua;
  }
  return undefined;
}

export default PAESI;
