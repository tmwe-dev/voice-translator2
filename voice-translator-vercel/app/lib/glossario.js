// ═══════════════════════════════════════════════════════════════
import { memGet, memSet } from './memoria.js';
// GLOSSARIO — le parole che contano per te.
//
// Fino a b.94 esisteva una pagina che raccoglieva i termini e li
// salvava sul telefono... e finiva lì. Nessuna traduzione li usava.
// Era la funzione più promettente dell'app e non serviva a niente.
//
// Qui c'è un posto solo dove leggerli e trasformarli in un'istruzione
// per il traduttore. Chi lavora in un settore ha venti parole che
// pesano più di tutte le altre: questo file le fa arrivare all'IA.
// ═══════════════════════════════════════════════════════════════

const CHIAVE = 'vt-glossario';
const MAX_TERMINI = 40;     // oltre, il prompt si gonfia senza guadagno
const MAX_LUNGHEZZA = 60;   // un termine, non una frase

/** Legge i termini salvati sul telefono. Mai lancia. */
export function leggiGlossario() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const grezzo = JSON.parse(memGet(CHIAVE) || '[]');
    if (!Array.isArray(grezzo)) return [];
    return grezzo
      .filter(t => t && typeof t.from === 'string' && typeof t.to === 'string')
      .filter(t => t.from.trim() && t.to.trim())
      .map(t => ({
        from: t.from.trim().slice(0, MAX_LUNGHEZZA),
        to: t.to.trim().slice(0, MAX_LUNGHEZZA),
        note: typeof t.note === 'string' ? t.note.trim().slice(0, MAX_LUNGHEZZA) : '',
      }))
      .slice(0, MAX_TERMINI);
  } catch { return []; }
}

/** Salva i termini. Ritorna l'elenco ripulito. */
export function salvaGlossario(termini) {
  const puliti = (Array.isArray(termini) ? termini : []).slice(0, MAX_TERMINI);
  try { memSet(CHIAVE, JSON.stringify(puliti)); } catch { /* pieno o privato */ }
  return puliti;
}

/**
 * Solo i termini che compaiono DAVVERO nel testo da tradurre.
 * Mandarli tutti a ogni frase costerebbe e distrarrebbe il modello.
 */
export function terminiPertinenti(testo, glossario = leggiGlossario()) {
  if (!testo || !glossario.length) return [];
  const minuscolo = testo.toLowerCase();
  return glossario.filter(t => minuscolo.includes(t.from.toLowerCase()));
}

/**
 * L'istruzione da appendere al prompt. Vuota se non serve niente:
 * così una conversazione senza termini non paga nessun costo.
 */
export function istruzioneGlossario(termini) {
  if (!termini || !termini.length) return '';
  const righe = termini.map(t => t.note
    ? `"${t.from}" → "${t.to}" (${t.note})`
    : `"${t.from}" → "${t.to}"`);
  return `\n\nGLOSSARY — the user's own terminology. These translations are MANDATORY, `
    + `even if another wording would sound more natural:\n${righe.join('\n')}`;
}

/** Scorciatoia per chi chiama l'API: dal testo direttamente ai termini. */
export function glossarioPerTesto(testo) {
  return terminiPertinenti(testo);
}
