// Lightweight i18n — loads language packs on demand
// Fallback languages (en, it) are loaded eagerly; others lazy-loaded
// Total: 15 languages, 1078 keys each
//
// Il numero e uguale in tutti e quindici, e deve restarlo: e la sola
// cosa che si puo contare per sapere se una schermata parla a tutti o
// solo a chi legge l'inglese. Aggiungere una chiave vuol dire
// aggiungerla quindici volte, non una.
//
// b.136 — QUESTA E' LA LINGUA DELL'INTERFACCIA, NON QUELLA PARLATA.
// Fino a b.135 erano la stessa cosa (`prefs.lang`), e non lo sono: un
// italiano che parla con un americano vuole i menu in italiano e le
// traduzioni in inglese. Ora chi chiama t() passa `prefs.uiLang`.
//
// Le due liste hanno anche lunghezze diverse, ed e il motivo per cui
// mapLang() esiste: si parlano 44 lingue (LANGS in constants.js), ma
// l'interfaccia e tradotta in 15. Chi sceglie il danese parla danese
// e legge i menu in inglese — non c'e un pacchetto danese da caricare.
import { createLogger } from './logger.js';
import en from './locales/en.js';

const log = createLogger('i18n');
import it from './locales/it.js';
import { memGet } from './memoria.js';

const SUPPORTED = ['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi',
  // b.260 — pacchetti COMPLETI generati (1182 chiavi ciascuno):
  'nl','pl','sv','da','cs','ro','hu',
  // b.260 — mini-pacchetti: la schermata principale parla la lingua
  // scelta, il resto ripiega sull'inglese finche il pacchetto pieno
  // non arriva. Meglio una prima schermata giusta che tutto in inglese.
  'el','fi','uk','nb','he','id','ms','ca','hr','sk','bg','fil','bn','ta','sw','af'];

/**
 * Le lingue in cui l'INTERFACCIA esiste davvero.
 * Serve a chi disegna un selettore: proporre le 44 lingue parlate come
 * lingua dei menu sarebbe una promessa non mantenuta.
 */
export const LINGUE_INTERFACCIA = SUPPORTED;

/** Cache of loaded language packs */
const T = { en, it };

/** Dynamic import map for lazy-loaded languages */
const loaders = {
  es: () => import('./locales/es.js'),
  fr: () => import('./locales/fr.js'),
  de: () => import('./locales/de.js'),
  pt: () => import('./locales/pt.js'),
  zh: () => import('./locales/zh.js'),
  ja: () => import('./locales/ja.js'),
  ko: () => import('./locales/ko.js'),
  th: () => import('./locales/th.js'),
  ar: () => import('./locales/ar.js'),
  hi: () => import('./locales/hi.js'),
  ru: () => import('./locales/ru.js'),
  tr: () => import('./locales/tr.js'),
  nl: () => import('./locales/nl.js'),
  pl: () => import('./locales/pl.js'),
  sv: () => import('./locales/sv.js'),
  da: () => import('./locales/da.js'),
  cs: () => import('./locales/cs.js'),
  ro: () => import('./locales/ro.js'),
  hu: () => import('./locales/hu.js'),
  el: () => import('./locales/el.js'),
  fi: () => import('./locales/fi.js'),
  uk: () => import('./locales/uk.js'),
  nb: () => import('./locales/nb.js'),
  he: () => import('./locales/he.js'),
  id: () => import('./locales/id.js'),
  ms: () => import('./locales/ms.js'),
  ca: () => import('./locales/ca.js'),
  hr: () => import('./locales/hr.js'),
  sk: () => import('./locales/sk.js'),
  bg: () => import('./locales/bg.js'),
  fil: () => import('./locales/fil.js'),
  bn: () => import('./locales/bn.js'),
  ta: () => import('./locales/ta.js'),
  sw: () => import('./locales/sw.js'),
  af: () => import('./locales/af.js'),
  vi: () => import('./locales/vi.js'),
};

/**
 * Preload a language pack into cache.
 * Call this when the user selects a language so strings are ready for t().
 * @param {string} code - Language code (e.g. 'es', 'fr')
 * @returns {Promise<boolean>} true if loaded successfully
 */
export async function preloadLang(code) {
  if (T[code]) return true;
  const loader = loaders[code];
  if (!loader) return false;
  try {
    const mod = await loader();
    T[code] = mod.default;
    // ═══ INIZIO b.256 — chi ha gia disegnato non lo sapeva mai ═══
    // TROVATO DAL VIVO (Luca): "non riesci neanche a tradurre la lingua
    // del menu". Vero, ed era qui. Solo inglese e italiano sono dentro
    // il programma; le altre TREDICI si caricano a parte, e finche non
    // arrivano `t()` ripiega sull'inglese — giusto. Il difetto e che
    // quando arrivavano NESSUNO lo veniva a sapere: React aveva gia
    // disegnato col ripiego e non aveva motivo di rifarlo. Scegliendo
    // tedesco o spagnolo i menu restavano in inglese finche non
    // succedeva qualcos'altro che costringesse a ridisegnare.
    // Funzionava solo alla scelta del paese perche li si cambia
    // schermata subito dopo, e il cambio di schermata ridisegna.
    annunciaLingua(code);
    // ═══ FINE b.256 ═══
    return true;
  } catch (e) {
    log.warn('Failed to load', code, e.message);
    return false;
  }
}

// b.256 — chi disegna si iscrive qui e viene svegliato quando un
// pacchetto lingua entra davvero in memoria. Deliberatamente senza
// React: i18n.js e usato anche fuori dai componenti.
const ascoltatoriLingua = new Set();
function annunciaLingua(code) {
  ascoltatoriLingua.forEach((fn) => { try { fn(code); } catch { /* un ascoltatore rotto non deve fermare gli altri */ } });
}

/** Si iscrive ai pacchetti lingua che arrivano; la funzione restituita disiscrive. */
export function ascoltaLingueCaricate(fn) {
  ascoltatoriLingua.add(fn);
  return () => ascoltatoriLingua.delete(fn);
}

/** Per i controlli: il pacchetto di questa lingua e gia in memoria? */
export function linguaPronta(code) {
  return !!T[code];
}

/**
 * Translate a key for the given language.
 * Fallback chain: requested lang -> en -> it -> raw key
 * If the language pack is not loaded yet, falls back to en and triggers async load.
 */
export function t(lang, key) {
  const l = lang || 'en';
  if (!T[l] && loaders[l]) {
    preloadLang(l); // fire-and-forget, next render will have it
  }
  if (T[l] && T[l][key] !== undefined) return T[l][key];
  if (T.en[key] !== undefined) return T.en[key];
  if (T.it[key] !== undefined) return T.it[key];
  return key;
}

/**
 * La lingua dell'interfaccia per chi vive FUORI da AppProvider.
 *
 * b.138 — la logica era scritta dentro CookieConsent.js, e i due altri
 * componenti che stanno fuori dal contesto (ToastContainer e
 * NetworkStatus, montati in page.js sopra <HomeInner/>) non ce l'avevano:
 * il primo aveva l'etichetta in italiano fisso, il secondo l'avviso
 * "Sei offline" in italiano per tutti. Ora la funzione e una sola.
 *
 * Ordine: la scelta esplicita dell'utente, poi la lingua del browser,
 * e in ultimo l'inglese — mai l'italiano, che era il ripiego sbagliato
 * corretto in b.136.
 */
export function linguaInterfacciaFuoriContesto() {
  if (typeof window === 'undefined') return 'en';
  try {
    const p = JSON.parse(memGet('vt-prefs') || 'null');
    if (p?.uiLang) return p.uiLang;
    if (p?.lang) return mapLang(p.lang);
  } catch { /* preferenze illeggibili: si ripiega sul browser */ }
  return mapLang((navigator.language || 'en').split('-')[0]);
}

/**
 * Traduce una chiave per chi non ha ne il contesto ne un `prefs` a portata.
 *
 * b.138 — serve agli hook (useTranslation, useRoomPolling, useStanzaVideo...):
 * girano DENTRO HomeInner, cioe sopra AppProvider, quindi useApp() li farebbe
 * cadere. I loro messaggi d'errore finiscono pero sotto gli occhi dell'utente
 * ("Non riesco a entrare", "Credito esaurito") ed erano rimasti in italiano.
 */
export function tFuori(key) {
  const l = linguaInterfacciaFuoriContesto();
  preloadLang(l);
  return t(l, key);
}

/** Map unsupported language codes to the closest supported one */
export function mapLang(code) {
  if (T[code] || SUPPORTED.includes(code)) return code;
  // ═══ INIZIO b.258 — le varianti regionali finivano in inglese ═══
  // TROVATO DAL VIVO (Luca): scelto "العربية (مصر)" i menu restavano in
  // inglese, mentre col vietnamita cambiavano. La differenza e il codice:
  // 'vi' e nell'elenco, 'ar-EG' no — e cadeva nel ripiego finale.
  // Ma l'arabo l'interfaccia CE L'HA: e 'ar'. Lo stesso valeva per
  // en-GB, es-MX, fr-CA, pt-PT, zh-TW — cinque lingue su sei che
  // esistono, buttate sull'inglese per via del suffisso regionale.
  // La lingua di una variante e la sua base: 'ar-EG' e arabo.
  const base = String(code || '').split(/[-_]/)[0];
  if (base !== code && (T[base] || SUPPORTED.includes(base))) return base;
  // ═══ FINE b.258 ═══
  // b.260 — la mappa 'lingua -> inglese' e sparita: ogni lingua del
  // selettore ora ha un pacchetto (pieno o della prima schermata).
  return 'en';
}

export default T;
