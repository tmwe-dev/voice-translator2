// ═══════════════════════════════════════════════════════════════
// ASSISTENTI MADRELINGUA — il duetto didattico di Luca (b.323, b.378).
//
// Il Maestro guida SEMPRE nella lingua dell'utente; le parti in lingua
// studiata le dice un ASSISTENTE con nome e volto. Il metodo delle due
// voci che si alternano NON cambia (ordine di Luca): cambia CHI fa la
// seconda voce, e quanto spesso resta la stessa persona.
//
// ── COSA C'ERA PRIMA, E PERCHE' ERA SBAGLIATO ──────────────────
// C'era un personaggio per lingua — Jack l'inglese, Li Wei il cinese —
// ma le voci sotto venivano da una manciata di voci PREMADE INGLESI
// lette dal modello multilingua. Interrogando l'account di Luca:
//
//     "Li Wei, assistente cinese"  =  Adam
//     "Jack, assistente inglese"   =  Adam
//     e Adam non ha NESSUNA lingua certificata.
//
// Il personaggio cambiava nome, la voce no. Non stavamo scegliendo male:
// non stavamo scegliendo. E su un corso di PRONUNCIA la voce non e un
// dettaglio — e la cosa che lo studente imita.
//
// ── COME FUNZIONA ADESSO (idea di Luca) ───────────────────────
// «Ci sono voci certificate per piu di una lingua: se abbiamo Sara che
//  parla inglese e cinese, quelle due lingue saranno gestite in modo
//  perfetto, e la persona non cambia mai durante la lezione.»
//
// Quindi il personaggio non e piu UNO PER LINGUA: e UNO PER VOCE, con
// le lingue che quella voce sa davvero fare. Chi studia inglese e poi
// cinese ritrova la stessa persona.
//
// Le lingue qui sotto NON sono scelte a occhio: sono le
// `verified_languages` dichiarate da ElevenLabs per quella voce.
// ═══════════════════════════════════════════════════════════════

/**
 * IL CAST. Cinque persone coprono dodici lingue. Ognuna porta le sue
 * lingue certificate: aggiungere una lingua a un personaggio senza che
 * sia in questo elenco vuol dire rimettere una voce con l'accento
 * sbagliato, cioe tornare al difetto di prima.
 */
export const CAST = [
  {
    id: 'jessica', nome: 'Jessica', genere: 'female', avatar: '/avatars/2.webp',
    voceId: 'cgSgspJ2msm6clMCkdW9',
    tratto: 'chiara e paziente, scandisce senza sembrare lenta',
    lingue: ['ar', 'cs', 'de', 'en', 'fr', 'hi', 'ja', 'zh'],
  },
  {
    id: 'will', nome: 'Will', genere: 'male', avatar: '/avatars/5.webp',
    voceId: 'bIHbv24MWmeRgasZH58o',
    tratto: 'rilassato e diretto, ritmo naturale da conversazione',
    lingue: ['cs', 'de', 'en', 'es', 'fil', 'fr', 'pt', 'sk', 'sv', 'zh'],
  },
  {
    id: 'matilda', nome: 'Matilda', genere: 'female', avatar: '/avatars/4.webp',
    voceId: 'XrExE9yKIg1WjnnlVkGX',
    tratto: 'calda e precisa, cura le vocali',
    lingue: ['ar', 'de', 'en', 'es', 'fr', 'it'],
  },
  {
    id: 'brian', nome: 'Brian', genere: 'male', avatar: '/avatars/6.webp',
    voceId: 'nPczCjzI2devNBz1zQrb',
    tratto: 'voce piena e posata, ottima sulle consonanti difficili',
    lingue: ['ar', 'de', 'en', 'hi', 'nl', 'pt', 'ro', 'sk', 'zh'],
  },
  {
    id: 'alice', nome: 'Alice', genere: 'female', avatar: '/avatars/7.webp',
    voceId: 'Xb7hH8MSUJpSbSDYk0k2',
    tratto: 'nitida e incoraggiante, da insegnante vera',
    lingue: ['ar', 'en', 'fr', 'hi', 'it', 'ja', 'pl'],
  },
  {
    id: 'liam', nome: 'Liam', genere: 'male', avatar: '/avatars/3.webp',
    voceId: 'TX3LPaxmHKxFdv7VOQHJ',
    tratto: 'energico e giovane, ritmo svelto',
    lingue: ['cs', 'de', 'en', 'hi', 'pl', 'pt', 'tr'],
  },
];

/**
 * CHI INSEGNA COSA. Scelto a mano fra i certificati, non a caso: si
 * cerca di far ritrovare la STESSA persona a chi studia piu lingue
 * vicine, e di non avere sempre lo stesso genere.
 */
const INSEGNA = {
  en: 'jessica', zh: 'jessica', ja: 'jessica',
  es: 'will',    pt: 'will',    de: 'will',
  fr: 'matilda', it: 'matilda',
  ar: 'brian',   nl: 'brian',
  hi: 'alice',
  tr: 'liam',
};

/**
 * b.378 — LE LINGUE SENZA NESSUNA VOCE CERTIFICATA.
 *
 * Sull'account non c'e una sola voce certificata per COREANO e RUSSO.
 * Si puo comunque sintetizzarle col modello multilingua — esce
 * comprensibile, con l'accento di un'altra lingua. Su un corso di
 * conversazione passerebbe; su un corso di PRONUNCIA no: staremmo
 * insegnando a imitare un accento sbagliato.
 *
 * Non si nasconde: chi apre uno di questi corsi deve saperlo, e la
 * decisione (comprare voci native, o partire lo stesso dichiarandolo)
 * e di Luca. Questo elenco esiste perche quella decisione sia visibile
 * invece che sepolta.
 */
export const LINGUE_SENZA_VOCE_CERTIFICATA = ['ko', 'ru'];

/** Vero se per questa lingua non abbiamo una voce davvero certificata. */
export function vocePrestata(lingua) {
  const l = String(lingua || '').replace(/-.*/, '');
  return !INSEGNA[l];
}

/**
 * L'Assistente madrelingua per una lingua studiata. C'e SEMPRE: se la
 * lingua non ha un personaggio certificato, si presta la voce piu vicina
 * — ma `vocePrestata` lo dice, cosi chi mostra la cosa puo essere onesto.
 */
export function assistentePer(lingua) {
  const lang2 = String(lingua || '').replace(/-.*/, '');
  const id = INSEGNA[lang2];
  if (id) {
    const p = CAST.find((c) => c.id === id);
    return { ...p, lingua: lang2, prestata: false };
  }
  // nessun certificato: si sceglie chi ne copre di piu (voce piu allenata
  // al multilingua), e si dichiara che e in prestito.
  const ripiego = CAST.reduce((a, b) => (b.lingue.length > a.lingue.length ? b : a), CAST[0]);
  return { ...ripiego, lingua: lang2, prestata: true };
}

/** Tutte le lingue che hanno un assistente certificato. */
export function lingueConVoceCertificata() {
  return Object.keys(INSEGNA).sort();
}
