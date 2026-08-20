// ═══════════════════════════════════════════════════════════════
// b.348 — IL FORMATO STANDARD DELLE SCENE (Luca).
//
// «Immagina un libro di inglese alle elementari, poi alle superiori,
// poi all'universita con le appendici. Devi poter creare uno standard
// format per design, tipo di scene, elementi da presentare e vere e
// proprie sceneggiature insieme alla creazione del corso.»
//
// Un libro di lingue non e prosa: e una SCENA (il bar, la stazione, la
// classe), un elenco di OGGETTI da nominare dentro quella scena, e un
// DIALOGO recitato da due voci. Qui vive lo standard: gli ambienti, lo
// stile grafico per ogni livello scolastico, e il modo di costruire il
// disegno che accompagna la lezione — sempre coerente, come le tavole
// di un libro vero.
// ═══════════════════════════════════════════════════════════════

/** Gli AMBIENTI del quotidiano: il repertorio di un manuale di lingua. */
export const AMBIENTI = [
  { id: 'bar', nome: 'al bar', scena: 'a cozy neighbourhood cafe counter with pastries, cups, a barista and a customer ordering', oggetti: ['coffee', 'cup', 'counter', 'menu', 'pastry', 'table', 'chair', 'napkin'] },
  { id: 'stazione', nome: 'alla stazione', scena: 'a train station platform with a departure board, benches, a traveller with luggage asking an attendant', oggetti: ['train', 'platform', 'ticket', 'suitcase', 'clock', 'timetable', 'bench', 'sign'] },
  { id: 'negozio', nome: 'in negozio', scena: 'a small clothing shop with shelves, a fitting room, a shop assistant and a customer holding a shirt', oggetti: ['shirt', 'price tag', 'shelf', 'fitting room', 'size', 'till', 'bag', 'mirror'] },
  { id: 'casa', nome: 'a casa', scena: 'a bright family kitchen and living room, table set for breakfast, a family talking', oggetti: ['table', 'chair', 'fridge', 'window', 'plate', 'glass', 'sofa', 'lamp'] },
  { id: 'scuola', nome: 'a scuola', scena: 'a friendly classroom with a blackboard, desks, backpacks, a teacher and pupils raising hands', oggetti: ['blackboard', 'desk', 'book', 'pen', 'backpack', 'notebook', 'ruler', 'clock'] },
  { id: 'ufficio', nome: 'in ufficio', scena: 'a modern open-plan office with desks, laptops, a meeting starting around a small table', oggetti: ['laptop', 'desk', 'meeting', 'phone', 'folder', 'coffee mug', 'chair', 'calendar'] },
  { id: 'strada', nome: 'per strada', scena: 'a lively city street corner with shop fronts, a map, a person asking a passer-by for directions', oggetti: ['street', 'map', 'traffic light', 'corner', 'shop', 'bus stop', 'crossing', 'sign'] },
  { id: 'ristorante', nome: 'al ristorante', scena: 'a warm restaurant table with a waiter taking the order from two guests, dishes and menus', oggetti: ['menu', 'waiter', 'dish', 'fork', 'knife', 'bill', 'water', 'dessert'] },
  { id: 'medico', nome: 'dal medico', scena: 'a calm doctor\'s office, doctor listening to a patient describing symptoms', oggetti: ['doctor', 'patient', 'stethoscope', 'appointment', 'medicine', 'desk', 'chair', 'poster'] },
  { id: 'albergo', nome: 'in albergo', scena: 'a hotel reception desk with a receptionist handing a key card to a guest with luggage', oggetti: ['reception', 'key', 'room', 'luggage', 'lift', 'booking', 'lobby', 'sign'] },
  { id: 'aeroporto', nome: 'in aeroporto', scena: 'an airport check-in area with boards, queues, a passenger showing a boarding pass', oggetti: ['boarding pass', 'gate', 'check-in', 'passport', 'suitcase', 'security', 'flight', 'board'] },
  { id: 'mercato', nome: 'al mercato', scena: 'an outdoor market stall full of fruit and vegetables, a vendor weighing produce for a customer', oggetti: ['apple', 'tomato', 'scales', 'basket', 'stall', 'change', 'bag', 'price'] },
];

/**
 * LO STILE PER LIVELLO — come nei manuali veri: alle elementari il
 * disegno e grande, colorato e rassicurante; alle superiori diventa
 * un'illustrazione editoriale; all'universita una tavola sobria, quasi
 * un'infografica. Lo stile resta IDENTICO per tutte le lezioni dello
 * stesso corso: e questo che fa sembrare un libro, e non una raccolta.
 */
export const STILE_LIVELLO = {
  bambino: 'Children\'s picture-book illustration: bold friendly outlines, warm saturated colours, rounded shapes, cheerful expressive characters, everything clearly recognisable and safe. Like a primary-school language book.',
  base: 'Clean modern textbook illustration: flat vector style, soft warm palette, simple readable shapes, friendly characters in everyday clothes. Like a beginner language coursebook.',
  intermedio: 'Editorial textbook illustration: flat vector with light shading, balanced natural palette, realistic proportions, everyday adult characters. Like a secondary-school language coursebook.',
  avanzato: 'Refined editorial illustration: restrained palette, elegant flat style with subtle depth, adult characters in natural everyday situations. Like an upper-secondary coursebook.',
  universitario: 'Sober academic plate: minimal flat design, muted professional palette, precise clean lines, uncluttered composition. Like a university language manual.',
  ricercatore: 'Sober academic plate: minimal flat design, muted professional palette, precise clean lines, uncluttered composition, documentary feel.',
};

/** Sceglie l'ambiente piu adatto al titolo della lezione (o uno stabile). */
export function ambientePer(titolo = '', argomento = '') {
  const t = `${titolo} ${argomento}`.toLowerCase();
  const indizi = [
    ['bar', /caff|bar\b|colazion|coffee|drink|bevut/],
    ['ristorante', /ristorant|mangi|cena|pranzo|food|restaurant|order|men[uù]/],
    ['stazione', /stazion|treno|train|viagg|biglietto|travel/],
    ['aeroporto', /aeroport|aereo|volo|flight|airport|imbarc/],
    ['albergo', /albergo|hotel|camera|prenotaz|reception/],
    ['negozio', /negozio|shopping|vestit|compr|shop|clothes|taglia/],
    ['mercato', /mercato|frutta|verdura|market|spesa/],
    ['medico', /medico|salute|dottor|health|doctor|malat|farmac/],
    ['scuola', /scuola|classe|school|studi|lezione|class|insegn/],
    ['ufficio', /ufficio|lavoro|office|work|riunion|meeting|coll(?:oquio|ega)/],
    ['strada', /strada|indicaz|direction|citt[àa]|street|perders|chiedere la via/],
    ['casa', /casa|famiglia|home|family|cucina|stanza/],
  ];
  for (const [id, re] of indizi) { if (re.test(t)) return AMBIENTI.find((a) => a.id === id); }
  // Nessun indizio: si sceglie in modo STABILE dal titolo, cosi la stessa
  // lezione ha sempre la stessa scena (e le lezioni diverse si alternano).
  let somma = 0;
  for (const c of String(titolo || argomento || 'x')) somma = (somma + c.charCodeAt(0)) % 9973;
  return AMBIENTI[somma % AMBIENTI.length];
}

/**
 * Il prompt della TAVOLA di scena: ambiente + oggetti da nominare, nello
 * stile del livello. Niente testo dentro l'immagine — le parole le dice
 * la lezione (e nei disegni le scritte vengono sempre storpiate).
 */
export function promptScena({ titolo = '', argomento = '', livello = 'base', ambiente = null, elementi = [] } = {}) {
  const amb = ambiente || ambientePer(titolo, argomento);
  const stile = STILE_LIVELLO[livello] || STILE_LIVELLO.base;
  const cose = (elementi.length ? elementi : amb.oggetti).slice(0, 8).join(', ');
  return [
    stile,
    `SCENE: ${amb.scena}.`,
    `The scene must clearly show these everyday objects, each recognisable at a glance: ${cose}.`,
    'Wide horizontal composition, single coherent scene, plenty of white space, no speech bubbles, NO TEXT, NO LETTERS, no numbers, no watermark, no logos.',
    'Transparent or plain light background outside the scene.',
  ].join(' ');
}

/** Il prompt dell'ICONA del corso: un simbolo, non una scena. */
export function promptIcona({ argomento = '', livello = 'base' } = {}) {
  const stile = STILE_LIVELLO[livello] || STILE_LIVELLO.base;
  return [
    stile,
    `A single iconic emblem that represents the course subject: "${argomento}".`,
    'One central symbol (or two overlapping), centred, simple and memorable like an app icon or a book cover emblem.',
    'Flat vector, transparent background, NO TEXT, NO LETTERS, no watermark.',
  ].join(' ');
}

// ── LA SCENEGGIATURA ─────────────────────────────────────────────
// La lezione di lingua dichiara la sua scena e il suo copione con un tag,
// esattamente come gia fa con [L2:] e [LETTURA:]. Il sistema li stacca,
// disegna la tavola giusta e fa recitare il dialogo alle due voci.

const TAG_SCENA = /\[SCENA:\s*([^\]]*?)\s*\]/i;

/**
 * Stacca la scena dichiarata dalla lezione.
 * Formato: [SCENA: ambiente | oggetto1, oggetto2, oggetto3]
 * @returns {{testo:string, scena:{ambienteId:string, elementi:string[]}|null}}
 */
export function staccaScena(testo = '') {
  const s = String(testo || '');
  const m = s.match(TAG_SCENA);
  if (!m) return { testo: s, scena: null };
  const [ambTesto, elencoTesto] = m[1].split('|').map((x) => (x || '').trim());
  const chiave = ambTesto.toLowerCase();
  const amb = AMBIENTI.find((a) => a.id === chiave || a.nome.includes(chiave)) || ambientePer(ambTesto);
  const elementi = (elencoTesto || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean).slice(0, 8);
  return { testo: s.replace(TAG_SCENA, '').trim(), scena: { ambienteId: amb.id, elementi } };
}

/** L'istruzione che chiede la scena al Maestro: una riga, nel formato fisso. */
export function istruzioneScena(livello = 'base') {
  const elenco = AMBIENTI.map((a) => a.id).join(', ');
  return `\nLA TAVOLA: apri la lezione dichiarando la scena su una riga sola, in questo formato esatto:
[SCENA: ambiente | oggetto1, oggetto2, oggetto3, oggetto4]
dove "ambiente" e uno di questi: ${elenco}; e gli oggetti (da quattro a otto) sono le cose CONCRETE presenti nella scena che la lezione insegna a nominare, scritte nella lingua studiata. Il sistema disegna la tavola del libro da questa riga${livello === 'bambino' ? ', in stile da libro illustrato per bambini' : ''}. Non spiegare il tag: mettilo e basta, una volta sola, in cima.`;
}
