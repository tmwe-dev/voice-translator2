// ═══════════════════════════════════════════════════════════════
// LE FONTI DEVONO PARLARE DEL TEMA — b.393, collaudo di Luca.
//
// Tavola rotonda, "Parti da fonti reali", domanda sul costo della vita.
// Fra i documenti di partenza: Michael Jackson. Non e una stranezza
// del motore di ricerca — e che nessuno guardava cosa tornava. La
// ricerca dava vent'anni di notizie, il briefing ne prendeva le prime
// sei con `slice(0, 6)`, e chiunque fosse in cima entrava nel tavolo.
//
// Il cancello sulle materie certificate (corsi/fonti.js) chiedeva
// "questa fonte VALE?" e lo chiedeva bene. Nessuno chiedeva l'altra
// meta: "questa fonte parla DI QUESTO?". Sono due domande diverse, e
// una fonte autorevole fuori tema fa piu danno di una fonte debole in
// tema: si presenta con l'autorita di un documento e porta il discorso
// da un'altra parte.
//
// Il criterio e volutamente grossolano — parole in comune fra il tema e
// il titolo/sintesi — perche deve sbagliare dalla parte giusta: chi non
// ha NESSUNA parola in comune col tema quasi certamente non c'entra;
// chi ne ha una potrebbe c'entrare e resta. Su alfabeti senza spazi
// (cinese, giapponese) non si riesce a estrarre parole: allora non si
// giudica e passa tutto, invece di buttare via tutto.
// ═══════════════════════════════════════════════════════════════

// Parole che ci sono in ogni frase e non dicono di cosa si parla. Non e
// un elenco completo di nessuna lingua: bastano le piu frequenti delle
// lingue in cui si scrivono i temi, il resto lo fa la soglia di lunghezza.
const VUOTE = new Set([
  'come', 'cosa', 'quale', 'quali', 'quando', 'dove', 'perche', 'perché',
  'della', 'dello', 'delle', 'degli', 'nella', 'nello', 'nelle', 'negli',
  'sulla', 'sullo', 'sulle', 'sugli', 'alla', 'allo', 'alle', 'agli',
  'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'essere',
  'sono', 'siamo', 'hanno', 'anche', 'ancora', 'oggi', 'piu', 'più', 'meno',
  'molto', 'tanto', 'tutto', 'tutti', 'tutte', 'ogni', 'senza', 'contro',
  'dopo', 'prima', 'sopra', 'sotto', 'verso', 'fare', 'stato', 'stata',
  'what', 'which', 'when', 'where', 'why', 'how', 'that', 'this', 'these',
  'those', 'with', 'without', 'about', 'from', 'into', 'over', 'under',
  'been', 'being', 'have', 'has', 'had', 'does', 'did', 'will', 'would',
  'should', 'could', 'their', 'there', 'here', 'more', 'most', 'some',
  'para', 'como', 'donde', 'cuando', 'porque', 'dans', 'pour', 'avec',
  'comment', 'pourquoi', 'quel', 'quelle', 'oder', 'aber', 'nicht', 'sich',
]);

/**
 * Le parole che dicono di cosa parla un testo. Minimo quattro lettere:
 * sotto ci sono quasi solo articoli e preposizioni, e una parola corta
 * ricorre ovunque per caso.
 */
export function paroleChiave(testo) {
  const parole = String(testo || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p.length >= 4 && !VUOTE.has(p));
  return [...new Set(parole)];
}

// Le lingue flettono: "abitazione"/"abitazioni", "price"/"prices". Il
// confronto si fa sulla radice — le prime lettere — non sulla parola
// intera, altrimenti un plurale conta come parola diversa.
function radice(p) {
  return p.length > 6 ? p.slice(0, 6) : p;
}

/**
 * Quante parole del tema compaiono in questa fonte. Zero = la fonte non
 * nomina mai niente di cio di cui si parla.
 */
export function quantoCentra(fonte, chiavi) {
  if (!chiavi.length) return 0;
  const testo = `${fonte?.titolo || ''} ${fonte?.sintesi || ''}`.toLowerCase();
  const radici = new Set(paroleChiave(testo).map(radice));
  let punti = 0;
  for (const c of chiavi) if (radici.has(radice(c))) punti += 1;
  return punti;
}

/**
 * Tiene solo le fonti che parlano del tema, le migliori per prime.
 *
 * Se dal tema non si estraggono almeno due parole utili non si giudica:
 * con una parola sola il verdetto sarebbe una monetina. Meglio far
 * passare tutto che buttare via a caso — a valle, chi non ha fonti lo
 * dichiara gia.
 *
 * @returns {{tenute: Array, scartate: Array, giudicato: boolean, soglia: number}}
 */
export function filtraFontiPertinenti(fonti = [], argomento = '') {
  const chiavi = paroleChiave(argomento);
  if (chiavi.length < 2) return { tenute: [...fonti], scartate: [], giudicato: false };
  const conPunti = fonti.map((f) => ({ f, punti: quantoCentra(f, chiavi) }));
  // UNA parola in comune puo essere un caso, ed e esattamente il caso che
  // ha portato Michael Jackson dentro una discussione sul costo della
  // VITA: la parola c'era davvero, in "la VITA del cantante". Quindi la
  // soglia si alza a due parole — ma solo quando c'e di che scegliere.
  // Se le fonti che ne condividono due sono meno di due, si torna a una:
  // meglio una fonte incerta che un tavolo vuoto.
  const quanteForti = conPunti.filter((x) => x.punti >= 2).length;
  const soglia = (chiavi.length >= 3 && quanteForti >= 2) ? 2 : 1;
  const tenute = conPunti.filter((x) => x.punti >= soglia).sort((a, b) => b.punti - a.punti).map((x) => x.f);
  const scartate = conPunti.filter((x) => x.punti < soglia).map((x) => x.f);
  // Se cade TUTTO, il sospettato numero uno non e il motore di ricerca: e
  // questo confronto. Un tema scritto a modo suo e fonti che dicono la
  // stessa cosa con altre parole non condividono niente, e buttarle via
  // tutte lascerebbe il tavolo vuoto per colpa nostra. Quando non resta
  // nessuno si passa la mano: passano tutte, e si dichiara di non aver
  // giudicato. Il caso vero — Michael Jackson in mezzo a fonti buone —
  // non passa di qui, perche li qualcosa resta sempre in piedi.
  if (fonti.length && !tenute.length) return { tenute: [...fonti], scartate: [], giudicato: false, soglia };
  return { tenute, scartate, giudicato: true, soglia };
}
