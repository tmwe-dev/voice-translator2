// ═══════════════════════════════════════════════════════════════
// PROFILI — il secondo asse del comportamento (Luca, b.237)
//
// La barra "libertà" (contratto.js) dice QUANTO il Compagno può spaziare.
// Il PROFILO dice COME si comporta in questa situazione: da amico, da
// docente, da interlocutore di dibattito, da assistente operativo.
//
// Un solo Archimede, non quattro: l'identità (catalogo/persistenza) resta
// stabile, il profilo cambia con la superficie — Amico → conversazionale,
// Impara → didattico, Tavolo/Podcast → dibattimentale — e domani l'utente
// potrà cambiarlo dal Deep Setting.
//
// PURO e testabile: nessuna rete, nessuno stato. Si compone con
// involucroCompagno({ profilo }) in contratto.js.
// ═══════════════════════════════════════════════════════════════

import { promptVocazione, vocazioneDiProfilo } from './vocazione.js';

/** @typedef {'conversazionale'|'didattico'|'dibattimentale'|'operativo'} Profilo */

// b.238 — i profili restano il REGISTRO (quale rapporto vale su quale
// superficie, cosa può cambiare l'utente); il TESTO però non è più un
// elenco di regole di condotta: è la VOCAZIONE (vocazione.js), cioè chi
// sei rispetto alla persona e di cosa ti senti responsabile. Da lì il
// comportamento si deduce, invece di essere prescritto riga per riga.
// Nessuna duplicazione: un profilo → una vocazione, un solo testo.
export const PROFILI = {
  conversazionale: {
    etichetta: 'Conversazionale',
    obiettivo: 'accompagnare la persona: una conversazione naturale, utile, mai un questionario.',
  },
  didattico: {
    etichetta: 'Didattico',
    obiettivo: 'portare la persona da uno stato di conoscenza A a uno stato B, al suo passo.',
  },
  dibattimentale: {
    etichetta: 'Dibattimentale',
    obiettivo: 'sviluppare e mettere alla prova le idee con un confronto argomentato che converge.',
  },
  operativo: {
    etichetta: 'Operativo',
    obiettivo: 'ottenere un risultato concreto, verificabile, nel minor numero di passi.',
  },
};

const PROFILO_DEF = 'conversazionale';

/** Il blocco di prompt del profilo: la vocazione che gli corrisponde. */
export function promptProfilo(profilo) {
  const p = PROFILI[profilo] ? profilo : PROFILO_DEF;
  return promptVocazione(vocazioneDiProfilo(p));
}

/** Il profilo giusto per ogni superficie dell'app. L'utente potrà cambiarlo (Deep Setting). */
export function profiloPerSuperficie(superficie) {
  switch (superficie) {
    case 'amico': return 'conversazionale';
    case 'impara': case 'corso': return 'didattico';
    case 'tavolo': case 'podcast': return 'dibattimentale';
    case 'dossier': return 'operativo';
    default: return PROFILO_DEF;
  }
}

// ── Per il form del Deep Setting (M2) ──
export const PROFILI_ELENCO = Object.entries(PROFILI).map(([id, p]) => ({ id, etichetta: p.etichetta, obiettivo: p.obiettivo }));

// Le superfici che ammettono un override nel Deep Setting del Compagno.
export const SUPERFICI_PROFILO = ['amico', 'impara', 'tavolo', 'podcast'];

/**
 * Pulisce l'oggetto `profili` in arrivo dal client PRIMA di salvarlo:
 * solo superfici note, solo profili esistenti. Ritorna null se non resta
 * nulla (così in DB si salva null, non {}).
 */
export function pulisciProfili(grezzo) {
  if (!grezzo || typeof grezzo !== 'object') return null;
  const puliti = {};
  for (const s of SUPERFICI_PROFILO) {
    const v = grezzo[s];
    if (typeof v === 'string' && PROFILI[v]) puliti[s] = v;
  }
  return Object.keys(puliti).length ? puliti : null;
}

/**
 * Il profilo EFFETTIVO di un Compagno su una superficie: l'override del
 * Deep Setting se c'è, altrimenti il default della superficie.
 */
export function profiloEffettivo(compagno, superficie) {
  const scelto = compagno && compagno.profili && compagno.profili[superficie];
  return (scelto && PROFILI[scelto]) ? scelto : profiloPerSuperficie(superficie);
}
