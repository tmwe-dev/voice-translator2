// ═══════════════════════════════════════════════════════════════
// RIORDINO — la Fase 2 della ricerca approfondita (Luca)
//
// Concordato: la ricerca veloce resta identica (ordina per numero di
// fonti, poi per data). La APPROFONDITA fa un passo in piu: riordina le
// card pesando QUATTRO segnali, tutti calcolati senza rete e senza AI —
// puro, quindi verificabile e a costo zero:
//
//   1. CORROBORAZIONE — quante testate DISTINTE raccontano la stessa
//      cosa. Un fatto ripreso da sei fonti pesa piu di uno solo.
//   2. AUTOREVOLEZZA   — quante di quelle testate stanno nel DIRETTORIO
//      della verticale giusta (nautica, finanza, tech...). Una notizia
//      di vela da una rivista di vela conta piu che da un generalista.
//   3. PERTINENZA      — quanto il titolo combacia con la domanda.
//   4. FRESCHEZZA      — a parita di tutto, la piu recente sopra.
//
// Ogni card esce con `punteggio` e `perche` (i segnali che l'hanno
// spinta su): cosi l'interfaccia puo MOSTRARE perche un risultato sta
// dove sta, invece di un riordino opaco.
// ═══════════════════════════════════════════════════════════════

// ── DIRETTORIO FONTI PER VERTICALE ──
// Non e una lista di "fonti buone in assoluto": e chi, in QUELLA
// materia, e una testata specializzata. Si allarga nel tempo; per ora
// copre le verticali chieste (nautica, finanza) piu le piu frequenti.
export const VERTICALI = {
  nautica: {
    chiavi: ['barca', 'barche', 'vela', 'nautica', 'yacht', 'regata', 'porto', 'porti', 'sailing', 'boat', 'marina', 'nave', 'navi', 'crociera', 'gommone', 'diporto'],
    fonti: ['boatinternational.com', 'yachtingworld.com', 'sailingworld.com', 'pressmare.it', 'nauticareport.it', 'ybw.com', 'sailingscuttlebutt.com', 'giornaledellavela.com'],
  },
  finanza: {
    chiavi: ['borsa', 'azioni', 'mercati', 'mercato', 'finanza', 'economia', 'trading', 'investimento', 'investimenti', 'stock', 'nasdaq', 'wall', 'crypto', 'bitcoin', 'inflazione', 'tassi', 'spread', 'btp'],
    fonti: ['bloomberg.com', 'ft.com', 'wsj.com', 'reuters.com', 'ilsole24ore.com', 'marketwatch.com', 'cnbc.com', 'milanofinanza.it', 'investing.com'],
  },
  tecnologia: {
    chiavi: ['tech', 'ai', 'intelligenza', 'artificiale', 'software', 'startup', 'app', 'smartphone', 'chip', 'computer', 'robot', 'algoritmo'],
    fonti: ['techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com', 'ilpost.it', 'engadget.com'],
  },
  sport: {
    chiavi: ['calcio', 'partita', 'gol', 'goal', 'formula', 'f1', 'tennis', 'nba', 'sport', 'campionato', 'scudetto', 'motogp', 'basket'],
    fonti: ['gazzetta.it', 'skysports.com', 'espn.com', 'corrieredellosport.it', 'tuttosport.com', 'motorsport.com'],
  },
  scienza: {
    chiavi: ['scienza', 'ricerca', 'studio', 'spazio', 'nasa', 'clima', 'medicina', 'salute', 'fisica', 'biologia'],
    fonti: ['nature.com', 'science.org', 'scientificamerican.com', 'lescienze.it', 'newscientist.com'],
  },
};

/** Toglie www./m. e il percorso: resta il dominio nudo, minuscolo. */
export function dominioNudo(d) {
  if (!d) return '';
  return String(d).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^m\./, '').split('/')[0].trim();
}

/**
 * Indovina la verticale dalla domanda. Nessun match = null (nessun
 * bonus di autorevolezza: si giudica solo su corroborazione e data).
 */
export function verticaleDi(query) {
  const q = (query || '').toLowerCase();
  const parole = q.split(/\s+/).filter(Boolean);
  let migliore = null, punti = 0;
  for (const [nome, v] of Object.entries(VERTICALI)) {
    let n = 0;
    for (const c of v.chiavi) if (parole.includes(c) || q.includes(c)) n++;
    if (n > punti) { punti = n; migliore = nome; }
  }
  return migliore;
}

const VUOTE_Q = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is',
  'il', 'lo', 'la', 'le', 'di', 'da', 'che', 'del', 'della', 'e', 'un', 'una', 'con', 'per', 'su']);

function paroleUtili(testo) {
  return new Set((testo || '').toLowerCase()
    .replace(/[«»"'''""!?,.;:()\[\]|–—-]/g, ' ')
    .split(/\s+/).filter(p => p.length > 2 && !VUOTE_Q.has(p)));
}

/**
 * Il punteggio di UNA card. Ritorna { punteggio, perche } dove `perche`
 * elenca i segnali che pesano (per l'interfaccia). Puro: stessi input,
 * stesso output.
 *
 * @param nowMs — l'istante di riferimento, passato da fuori (niente
 *   Date.now() qui: cosi il test e deterministico).
 */
export function punteggioCard(card, { paroleQuery = new Set(), verticale = null, nowMs = 0 } = {}) {
  const fonti = Array.isArray(card?.fonti) ? card.fonti : [];
  const domini = new Set(fonti.map(f => dominioNudo(f.dominio)).filter(Boolean));

  // 1. CORROBORAZIONE — satura a 5 testate distinte (0..1).
  const corroborazione = Math.min(domini.size, 5) / 5;

  // 2. AUTOREVOLEZZA — quota di domini nel direttorio della verticale (0..1).
  let autorevolezza = 0;
  const dirette = [];
  if (verticale && VERTICALI[verticale]) {
    const dir = new Set(VERTICALI[verticale].fonti);
    let dentro = 0;
    for (const d of domini) if (dir.has(d)) { dentro++; dirette.push(d); }
    autorevolezza = domini.size ? dentro / domini.size : 0;
  }

  // 3. PERTINENZA — overlap fra le parole della domanda e del titolo (0..1).
  let pertinenza = 0;
  if (paroleQuery.size) {
    const t = paroleUtili(card?.titolo);
    let comuni = 0;
    for (const w of paroleQuery) if (t.has(w)) comuni++;
    pertinenza = comuni / paroleQuery.size;
  }

  // 4. FRESCHEZZA — decadimento dolce: 1 appena uscita, ~0.5 a 24h (0..1).
  let freschezza = 0;
  if (card?.pubblicato && nowMs) {
    const ore = Math.max(0, (nowMs - card.pubblicato) / 3600000);
    freschezza = 1 / (1 + ore / 24);
  }

  // Un'enciclopedia (Wikipedia) e per definizione corroborata e
  // autorevole sul FATTO: le si riconosce una base, non la si penalizza
  // perche ha una sola "fonte".
  const baseFatto = card?.tipo === 'enciclopedia' ? 0.35 : 0;

  const punteggio =
    0.42 * Math.max(corroborazione, baseFatto) +
    0.28 * Math.max(autorevolezza, baseFatto ? 0.3 : 0) +
    0.20 * pertinenza +
    0.10 * freschezza;

  const perche = [];
  if (domini.size >= 3) perche.push('corroborata');
  if (dirette.length) perche.push('fonte di settore');
  if (pertinenza >= 0.5) perche.push('in tema');
  if (card?.tipo === 'enciclopedia') perche.push('enciclopedia');

  return { punteggio, perche };
}

/**
 * Riordina le card della ricerca approfondita. Non le filtra: le
 * ORDINA e attacca a ognuna `punteggio` e `perche`. La domanda decide
 * la verticale; `nowMs` e passato da fuori.
 */
export function riordina(cards, { query = '', nowMs = 0 } = {}) {
  if (!Array.isArray(cards) || cards.length < 2) return cards || [];
  const verticale = verticaleDi(query);
  const paroleQuery = paroleUtili(query);
  const conPunti = cards.map((c, i) => {
    const { punteggio, perche } = punteggioCard(c, { paroleQuery, verticale, nowMs });
    return { ...c, punteggio, perche, _i: i };
  });
  conPunti.sort((a, b) => (b.punteggio - a.punteggio) || (a._i - b._i));
  return conPunti.map(({ _i, ...c }) => c);
}
