// ═══════════════════════════════════════════════════════════════
// ASSISTENTI MADRELINGUA (b.323) — il duetto didattico di Luca.
//
// Il Maestro guida SEMPRE nella lingua dell'utente; ma la lingua studiata
// va pronunciata da chi la parla davvero. Per ogni lingua c'e un
// ASSISTENTE con nome e volto: dice tutte le parti in lingua originale
// (i tag [L2:]), legge i brani, rimodella le frasi dopo una correzione.
// Non e un trucco tecnico: e un personaggio che lo studente riconosce.
//
// La voce viene dal piano voce-per-lingua condiviso (vociLingue.js), con
// il genere coerente con l'identita del personaggio. Quando il catalogo
// curato in DB (voci_lingue) avra voci native migliori, vincera quello
// lato server: qui si fissa l'IDENTITA, non il fornitore.
// ═══════════════════════════════════════════════════════════════

import { NATIVE_VOICES_BY_LANG } from '../../vociLingue.js';

// Un personaggio per lingua: nome proprio del posto, genere (per la voce),
// avatar dal set esistente, una riga di carattere per il prompt.
const ASSISTENTI = {
  en: { nome: 'Jack',   genere: 'male',   avatar: '/avatars/5.png', tratto: 'diretto e incoraggiante, accento neutro americano' },
  es: { nome: 'Lucía',  genere: 'female', avatar: '/avatars/2.png', tratto: 'solare, scandisce bene le sillabe' },
  fr: { nome: 'Camille', genere: 'female', avatar: '/avatars/4.png', tratto: 'elegante e paziente' },
  de: { nome: 'Lukas',  genere: 'male',   avatar: '/avatars/6.png', tratto: 'preciso, ritmo chiaro' },
  pt: { nome: 'Ana',    genere: 'female', avatar: '/avatars/8.png', tratto: 'calda, musicale' },
  it: { nome: 'Marco',  genere: 'male',   avatar: '/avatars/3.png', tratto: 'chiaro e cordiale' },
  zh: { nome: 'Li Wei', genere: 'male',   avatar: '/avatars/1.png', tratto: 'calmo, esagera leggermente i toni per farli sentire' },
  ja: { nome: 'Hana',   genere: 'female', avatar: '/avatars/7.png', tratto: 'gentile, scandisce le more' },
  ko: { nome: 'Minji',  genere: 'female', avatar: '/avatars/4.png', tratto: 'vivace e chiara' },
  ar: { nome: 'Layla',  genere: 'female', avatar: '/avatars/2.png', tratto: 'posata, cura le consonanti profonde' },
  ru: { nome: 'Nadia',  genere: 'female', avatar: '/avatars/8.png', tratto: 'ferma e chiara' },
  hi: { nome: 'Priya',  genere: 'female', avatar: '/avatars/4.png', tratto: 'melodica e paziente' },
  tr: { nome: 'Emre',   genere: 'male',   avatar: '/avatars/5.png', tratto: 'diretto e amichevole' },
  nl: { nome: 'Sanne',  genere: 'female', avatar: '/avatars/7.png', tratto: 'pratica e chiara' },
  pl: { nome: 'Ola',    genere: 'female', avatar: '/avatars/8.png', tratto: 'precisa e gentile' },
  sv: { nome: 'Elsa',   genere: 'female', avatar: '/avatars/7.png', tratto: 'calma, cantilena naturale' },
  th: { nome: 'Mali',   genere: 'female', avatar: '/avatars/2.png', tratto: 'sorridente, esagera i toni per farli sentire' },
  vi: { nome: 'Linh',   genere: 'female', avatar: '/avatars/4.png', tratto: 'paziente, scandisce i toni' },
};

/**
 * L'Assistente madrelingua per una lingua studiata. C'e SEMPRE: se la
 * lingua non ha un personaggio suo, ne nasce uno generico ("l'assistente
 * madrelingua") con la voce migliore disponibile per quella lingua.
 */
export function assistentePer(lingua) {
  const lang2 = String(lingua || '').replace(/-.*/, '');
  const base = ASSISTENTI[lang2] || { nome: 'l’assistente madrelingua', genere: 'female', avatar: '/avatars/9.png', tratto: 'chiara e paziente' };
  const voci = NATIVE_VOICES_BY_LANG[lang2];
  const voceId = voci ? (voci[base.genere] || voci.female) : null;
  return { ...base, lingua: lang2, voceId };
}
