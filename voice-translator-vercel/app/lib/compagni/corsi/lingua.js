// ═══════════════════════════════════════════════════════════════
// LINGUA — imparare una lingua USANDOLA (Luca, b.241)
//
// Ripreso da RadioChat (src/lib/maestro/*), dove funzionava e noi non
// l'avevamo mai portato: in Impara mancava del tutto la pratica orale.
// Il corso di lingua era una dispensa più un quiz a scelta multipla —
// cioè il modo più sicuro per NON imparare a parlare.
//
// Il pezzo centrale è il tag [L2: ...]:
//
//   Il Maestro parla nella lingua dello studente, ma ogni parola o frase
//   nella lingua STUDIATA la racchiude in [L2: ...]. A schermo il tag
//   sparisce; alla voce, invece, quel pezzo viene letto da una voce
//   madrelingua. Così "How are you?" dentro una frase italiana non viene
//   letto con l'accento italiano — che è esattamente ciò che insegnerebbe
//   la pronuncia sbagliata.
//
// DUE MIGLIORIE rispetto all'originale:
//  1. Le lingue non sono più un elenco scritto a mano di venti voci: si
//     ricavano da LANGS (44 lingue già nel prodotto), quindi un corso di
//     swahili o di catalano viene riconosciuto senza toccare questo file.
//  2. I segmenti adiacenti nella stessa lingua vengono UNITI prima di
//     parlare: meno chiamate al fornitore, meno costo, meno attesa.
//
// PURO e testabile: nessuna rete, nessuno stato.
// ═══════════════════════════════════════════════════════════════

import { LANGS, getLang } from '../../constants.js';
import { ISTRUZIONE_PRONUNCIA } from './pronuncia.js';

// Nomi con cui una lingua viene chiamata nelle lingue che contano per noi.
// Serve solo dove il nome non si deduce da LANGS (che è già in lingua madre).
const ALIAS = {
  en: ['english', 'inglese', 'anglais', 'englisch', 'inglés', 'ingles'],
  fr: ['french', 'francese', 'français', 'francais', 'französisch', 'francés'],
  de: ['german', 'tedesco', 'deutsch', 'allemand', 'alemán'],
  es: ['spanish', 'spagnolo', 'español', 'espanol', 'espagnol', 'spanisch'],
  pt: ['portuguese', 'portoghese', 'português', 'portugues', 'portugais'],
  it: ['italian', 'italiano', 'italien', 'italienisch'],
  zh: ['chinese', 'cinese', 'mandarino', 'chinois', '中文'],
  ja: ['japanese', 'giapponese', 'japonais', '日本語'],
  ko: ['korean', 'coreano', 'coréen', '한국어'],
  ru: ['russian', 'russo', 'russe', 'русский'],
  ar: ['arabic', 'arabo', 'arabe', 'العربية'],
  nl: ['dutch', 'olandese', 'néerlandais', 'nederlands'],
  sv: ['swedish', 'svedese', 'suédois'],
  pl: ['polish', 'polacco', 'polonais'],
  tr: ['turkish', 'turco', 'turc'],
  el: ['greek', 'greco', 'grec'],
  he: ['hebrew', 'ebraico', 'hébreu'],
  hi: ['hindi'],
  th: ['thai', 'tailandese', 'thailandese'],
  vi: ['vietnamese', 'vietnamita'],
  // Queste hanno un endonimo che non somiglia al nome italiano ("Română" vs
  // "romeno"), quindi il passaggio su LANGS da solo non le troverebbe.
  ro: ['romanian', 'rumeno', 'romeno', 'romena'],
  uk: ['ukrainian', 'ucraino'],
  cs: ['czech', 'ceco'],
  hu: ['hungarian', 'ungherese'],
  fi: ['finnish', 'finlandese'],
  da: ['danish', 'danese'],
  id: ['indonesian', 'indonesiano'],
};

const senzaAccenti = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Qual è la lingua che si sta studiando? Si ricava dal titolo del corso.
 * Ritorna il codice ('en', 'ja', …) oppure null se non è un corso di lingua.
 */
export function rilevaLinguaStudiata(argomento = '', titolo = '') {
  const testo = senzaAccenti(`${argomento} ${titolo}`);
  if (!testo.trim()) return null;

  // 1) gli alias delle lingue più comuni: sono nomi inequivocabili, si
  //    possono cercare ovunque nel titolo.
  for (const [code, nomi] of Object.entries(ALIAS)) {
    for (const n of nomi) {
      if (new RegExp(`\\b${senzaAccenti(n)}\\b`).test(testo)) return code;
    }
  }
  // 2) i nomi propri delle altre lingue, presi da LANGS (44 lingue). Qui
  //    serve prudenza: il test ha trovato subito il difetto — "Storia
  //    romana" veniva letto come corso di RUMENO ("Română" → "romana").
  //    Un nome di lingua da solo non basta: o è la prima parola del titolo
  //    ("Català per principianti"), oppure c'è un indizio che si parla di
  //    una lingua ("corso di kiswahili"). Un aggettivo in mezzo a una frase
  //    non lo è.
  const INDIZIO = /\b(lingua|linguaggio|corso di|imparare|parlare|conversazione|learn|language|course|curso|idioma|sprache|langue)\b/;
  const primaParola = testo.trim().split(/\s+/)[0] || '';
  for (const l of LANGS) {
    const nome = senzaAccenti(l.name).replace(/\s*\(.*?\)\s*/g, '').trim();
    if (nome.length < 4 || !new RegExp(`\\b${nome}\\b`).test(testo)) continue;
    if (primaParola === nome || INDIZIO.test(testo)) return l.code.split('-')[0];
  }
  // 3) livello CEFR + codice ("B1 EN", "a2 fr").
  const cefr = testo.match(/\b[abc][12]\s+([a-z]{2})\b/);
  if (cefr && getLang(cefr[1])) return cefr[1];
  return null;
}

/** Il nome leggibile di una lingua (per parlarne nel prompt). */
export function nomeLinguaStudiata(code) {
  const l = getLang(code);
  return l ? l.name.replace(/\s*\(.*?\)\s*/g, '').trim() : String(code || '');
}

/**
 * Le istruzioni per il Maestro di lingua: marcare la lingua straniera e —
 * soprattutto — far PARLARE la persona invece di spiegarle la grammatica.
 */
export function istruzioniLingua({ linguaParlata = 'it', linguaStudiata = 'en' } = {}) {
  const parlata = nomeLinguaStudiata(linguaParlata);
  const studiata = nomeLinguaStudiata(linguaStudiata);
  return `
CORSO DI LINGUA — si impara usandola, non studiandola.
Tu parli in ${parlata}. Ogni parola, frase o espressione in ${studiata} DEVE stare dentro il tag [L2: ...]: il sistema la farà pronunciare da una voce madrelingua, così la persona sente la pronuncia giusta e non la tua.
Esempi: «La parola [L2: beautiful] significa bello.» · «Prova a dire [L2: How are you doing today?]» · «Il verbo [L2: to be]: [L2: I am], [L2: you are].»
Marca SOLO la parte in ${studiata}, anche quando è una parola sola dentro una frase in ${parlata}. Senza tag, quella parola verrebbe letta con l'accento sbagliato — cioè insegneresti una pronuncia scorretta.

FALLA PARLARE: non limitarti a spiegare. Metti la persona in una situazione vera (ordinare al ristorante, chiedere indicazioni, un colloquio) e recita tu l'altra parte, in ${studiata}. Chiedile di rispondere. Alza la difficoltà quando regge — anche con un imprevisto — e abbassala quando fatica.

${ISTRUZIONE_PRONUNCIA}

QUANDO SBAGLIA, non fermare la conversazione per una lezione di grammatica. Scegli: se l'errore non impedisce di capirsi, lascialo correre per ora; se conta, correggilo NEL FLUSSO ripetendo bene la frase ("Ah, [L2: you went yesterday]! E poi?"); e tieni da parte le due o tre cose importanti per dirle alla fine, insieme.`;
}

// ── Il tag [L2: ...] ──────────────────────────────────────────────

const TAG_L2 = /\[L2:\s*([^\]]*?)\s*\]/gi;

/** Il testo da MOSTRARE: i tag spariscono, il contenuto resta. */
export function testoVisibile(testo) {
  return String(testo || '').replace(TAG_L2, '$1').trim();
}

/**
 * Il testo da PARLARE, spezzato per lingua: ogni pezzo con la sua.
 * I pezzi adiacenti nella stessa lingua vengono uniti, così si fa una
 * chiamata sola invece di cinque (costo e attesa).
 * @returns {{testo:string, lingua:string}[]}
 */
export function segmentiPerVoce(testo, { linguaParlata = 'it', linguaStudiata = 'en' } = {}) {
  const s = String(testo || '');
  const pezzi = [];
  let i = 0;
  for (const m of s.matchAll(TAG_L2)) {
    if (m.index > i) pezzi.push({ testo: s.slice(i, m.index), lingua: linguaParlata });
    if (m[1]) pezzi.push({ testo: m[1], lingua: linguaStudiata });
    i = m.index + m[0].length;
  }
  if (i < s.length) pezzi.push({ testo: s.slice(i), lingua: linguaParlata });

  // Unisce i vicini con la stessa lingua e butta i vuoti.
  const uniti = [];
  for (const p of pezzi) {
    const t = p.testo.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const ultimo = uniti[uniti.length - 1];
    if (ultimo && ultimo.lingua === p.lingua) ultimo.testo = `${ultimo.testo} ${t}`.trim();
    else uniti.push({ testo: t, lingua: p.lingua });
  }
  return uniti;
}
