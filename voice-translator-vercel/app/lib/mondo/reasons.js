// CANTIERE — collegato alla FASE 5 del documento di Mondo (b.576).
// Finche' quella fase non arriva questo file esiste e non lo chiama
// ancora nessuno: e' voluto, il documento dice «nessun cambio UI».
// Quando verra collegato, questa riga se ne va con la fase.
// ═══════════════════════════════════════════════════════════════
// PERCHE' LO VEDI (b.576, FASE 3)
//
// Documento di Luca, capitolo 24: «ogni contenuto deve avere almeno una
// reason». E capitolo 25: dalla reason si deve poter AGIRE —
// «mostramene di piu», «non seguire argomento», «nascondi fonte».
//
// E' la parte che rende il sistema onesto. Un feed che non sa dire
// perche' ti mostra una cosa non e' misterioso: e' un feed che non lo
// sa nemmeno lui. E se il motivo si puo dire in una riga, allora si
// puo anche contestare — che e' l'unico modo che una persona ha per
// correggere una macchina che la sta profilando male.
//
// I motivi sono DATI, non frasi: `{ type, value }`. La frase la scrive
// la schermata, nella lingua di chi guarda (capitolo 6: nessuna stringa
// di interfaccia deve comandare il motore).
// ═══════════════════════════════════════════════════════════════

export const TIPI_MOTIVO = [
  'explicit_query',     // l'hai chiesto tu adesso
  'followed_topic',     // segui questo argomento
  'declared_interest',  // l'hai messo fra i tuoi interessi
  'followed_source',    // segui questa fonte
  'learned_affinity',   // apri spesso roba cosi
  'recent_search',      // l'hai cercato di recente
  'breaking',           // sta succedendo adesso
  'popular_here',       // va forte nel tuo Paese
  'discovery',          // fuori dai tuoi interessi, di proposito
  'fresh',              // e' appena uscito
];

export function motivo(type, value = '') {
  return TIPI_MOTIVO.includes(type) ? { type, value: String(value || '') } : null;
}

/** Il motivo piu forte per primo: e' quello che la scheda mostra. */
export const FORZA = TIPI_MOTIVO.reduce((m, t, i) => ({ ...m, [t]: TIPI_MOTIVO.length - i }), {});

export function ordinaMotivi(motivi) {
  return (Array.isArray(motivi) ? motivi : [])
    .filter(Boolean)
    .sort((a, b) => (FORZA[b.type] || 0) - (FORZA[a.type] || 0));
}

/**
 * Le azioni che una persona puo fare da un motivo (capitolo 25).
 * Anche queste sono dati: il pulsante lo disegna la schermata.
 */
export function azioniPer(m) {
  switch (m?.type) {
    case 'followed_topic':
      return [{ action: 'unfollow_topic', topic: m.value }, { action: 'more_like_this', topic: m.value }];
    case 'declared_interest':
      return [{ action: 'less_like_this', topic: m.value }, { action: 'more_like_this', topic: m.value }];
    case 'learned_affinity':
      return [{ action: 'less_like_this', topic: m.value }, { action: 'follow_topic', topic: m.value }];
    case 'followed_source':
    case 'popular_here':
      return [{ action: 'block_source', source: m.value }];
    case 'discovery':
      return [{ action: 'more_like_this', topic: m.value }, { action: 'less_like_this', topic: m.value }];
    default:
      return [];
  }
}
