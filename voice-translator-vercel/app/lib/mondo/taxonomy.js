// ═══════════════════════════════════════════════════════════════
// LA TASSONOMIA — I NOMI VERI DELLE COSE (b.575, FASE 1)
//
// Dal documento di Luca, regola 4: «gli interessi devono utilizzare ID
// canonici, mai parole tradotte. MAI 'Economia' 'Economy' 'Économie';
// SEMPRE 'economy'».
//
// Non e' pignoleria. Oggi l'interesse si chiama 'economia' e la query
// si chiama 'economia': la stessa stringa fa due mestieri, e il giorno
// che l'interfaccia passa al francese il motore non riconosce piu i
// suoi stessi interessi. Un identificatore non e' una parola: e' un
// NOME PROPRIO, e non si traduce mai — come non si traduce «Milano»
// dentro un indirizzo.
//
// E c'e' la seconda cosa che una tassonomia da, e che un elenco piatto
// non puo dare: la PARENTELA. Chi segue `sport` e' probabilmente
// contento di vedere `formula1` anche senza averlo mai detto, perche'
// formula1 STA DENTRO sport. Con le stringhe si potrebbe solo
// confrontarle e sperare.
//
// File PURO: nessun import (lezione di b.559).
// ═══════════════════════════════════════════════════════════════

/** Ogni voce: figlio → padre. La radice ha padre null. */
export const TASSONOMIA = {
  news:                  null,
  breaking:              'news',
  politics:              'news',
  world:                 'news',

  economy:               null,
  markets:               'economy',
  companies:             'economy',
  finance:               'economy',
  macroeconomics:        'economy',

  sport:                 null,
  football:              'sport',
  motorsport:            'sport',
  formula1:              'motorsport',
  motogp:                'motorsport',
  tennis:                'sport',
  basketball:            'sport',
  cycling:               'sport',

  technology:            null,
  artificial_intelligence: 'technology',
  devices:               'technology',
  software:              'technology',
  cybersecurity:         'technology',
  motors:                'technology',

  science:               null,
  space:                 'science',
  environment:           'science',
  nature:                'science',
  animals:               'nature',
  history:               'science',

  culture:               null,
  cinema:                'culture',
  music:                 'culture',
  art:                   'culture',
  books:                 'culture',
  games:                 'culture',

  lifestyle:             null,
  food:                  'lifestyle',
  travel:                'lifestyle',
  fashion:               'lifestyle',
  wellness:              'lifestyle',
  health:                'wellness',
  curiosities:           'lifestyle',
  people:                'lifestyle',
};

export const TOPIC_IDS = Object.keys(TASSONOMIA);

/** Esiste? Serve a rifiutare presto una stringa che non e' un topic. */
export function esiste(id) {
  return Object.prototype.hasOwnProperty.call(TASSONOMIA, String(id || ''));
}

/** Il padre di un topic, o null se e' una radice (o non esiste). */
export function padreDi(id) {
  return esiste(id) ? TASSONOMIA[id] : null;
}

/**
 * La catena dal topic fino alla radice, se stesso incluso.
 * `catena('formula1')` → ['formula1', 'motorsport', 'sport'].
 * Chi segue uno qualsiasi di questi ha un motivo per vedere formula1.
 */
export function catena(id) {
  const fuori = [];
  let x = String(id || '');
  while (esiste(x) && !fuori.includes(x)) {   // il controllo evita cicli
    fuori.push(x);
    x = TASSONOMIA[x] || '';
  }
  return fuori;
}

/** `discende('formula1', 'sport')` → true. Un topic discende da se stesso. */
export function discende(id, avo) {
  return catena(id).includes(String(avo || ''));
}

/** I figli diretti di un topic. */
export function figliDi(id) {
  return TOPIC_IDS.filter((k) => TASSONOMIA[k] === String(id || ''));
}

// ═══ I VECCHI NOMI, PERCHE NESSUNO PERDE I SUOI INTERESSI ═══
// Regola 41 del documento: «le preferenze vecchie devono essere
// convertite... non cancellare dati vecchi prima della migrazione
// verificata». Chi aveva scelto «economia» a giugno deve ritrovarsi
// `economy` senza accorgersi di niente.
const VECCHI = {
  mondo: 'world', sport: 'sport', tecnologia: 'technology', economia: 'economy',
  scienza: 'science', arte: 'art', cinema: 'cinema', musica: 'music',
  viaggi: 'travel', cucina: 'food', salute: 'health', ambiente: 'environment',
  motori: 'motors', giochi: 'games', moda: 'fashion', storia: 'history',
  spazio: 'space', animali: 'animals',
  // i rami di b.573, che nascono gia con nomi loro
  ultimora: 'breaking', tendenze: 'news', benessere: 'wellness',
  curiosita: 'curiosities', storie: 'people', soldi: 'economy',
  natura: 'nature', cultura: 'culture',
};

/**
 * Il nome canonico di un interesse, da qualunque nome vecchio arrivi.
 * Se non lo riconosce torna stringa vuota: meglio perdere UN interesse
 * che inventarne uno sbagliato e costruirci sopra un profilo.
 */
export function canonico(x) {
  const s = String(x || '').trim().toLowerCase();
  if (!s) return '';
  if (esiste(s)) return s;
  return VECCHI[s] || '';
}
