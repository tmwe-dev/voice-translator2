// b.535 — LE TESTATE CHIUSE. Ordine di Luca: «considerato che sappiamo se
// possibile o no aprire, evidenziamolo subito non dando disponibile
// l'icona... di sicuro non vogliamo aprire una maschera che sappiamo e'
// vuota e ti obbliga a fare altre scelte».
// Alcuni editori vietano l'apertura della loro pagina dentro un'altra
// applicazione (X-Frame-Options / frame-ancestors). Dal browser non si
// puo' chiederlo PRIMA: lo si scopre solo provando. Quindi: un elenco
// SEMINATO con le testate gia' viste chiuse, piu' l'APPRENDIMENTO — al
// primo rifiuto il dominio viene ricordato (localStorage) e dalla volta
// dopo l'app non offre piu' la porta che sa chiusa.
const SEMI = [
  'tuttomercatoweb.com', // [VERIFICATO] screenshot di Luca, 27/8/2026
];
const CHIAVE = 'vt-testate-chiuse';

export function dominioDi(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function imparate() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

// La testata di questo indirizzo e' nota per rifiutare la cornice?
// (vale anche per i sottodomini: m.esempio.com se e' chiuso esempio.com)
export function testataChiusa(url) {
  const d = dominioDi(url);
  if (!d) return false;
  const chiuse = [...SEMI, ...imparate()];
  return chiuse.some((x) => d === x || d.endsWith('.' + x));
}

// Il rifiuto appena visto diventa memoria: la prossima volta si sa prima.
export function imparaChiusa(url) {
  const d = dominioDi(url);
  if (!d || typeof localStorage === 'undefined') return;
  try {
    const gia = imparate();
    if (gia.includes(d) || SEMI.includes(d)) return;
    localStorage.setItem(CHIAVE, JSON.stringify([...gia, d].slice(-80)));
  } catch { /* senza memoria si riprova la prossima volta: nessun danno */ }
}
