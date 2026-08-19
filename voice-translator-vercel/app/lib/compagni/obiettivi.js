// ═══════════════════════════════════════════════════════════════
import { memGet, memSet } from '../memoria.js';
// OBIETTIVI DI VITA — il "tutor che ti accompagna" (Luca)
//
// Modellato sugli LTObjective del Life Tutor di RadioChat (titolo,
// descrizione, categoria, stato, priorità, progresso, traguardi), qui in
// versione snella. Gli obiettivi vivono SUL DISPOSITIVO (localStorage): sono
// dati personali e non serve un server per tenerli. Quando parli con un
// Compagno, gli obiettivi ATTIVI vengono passati alla rotta e finiscono nel
// suo prompt: così il Compagno LI CONOSCE e ti accompagna a raggiungerli.
//
// `formattaObiettivi` è PURA (niente localStorage): la importa anche il server
// per costruire il blocco di prompt. L'accesso a localStorage è sempre
// guardato, così il modulo è sicuro anche lato server.
// ═══════════════════════════════════════════════════════════════

const CHIAVE = 'vt-obiettivi';

export const CATEGORIE_OBIETTIVO = [
  { id: 'studio', etichetta: 'Studio', icona: '📚' },
  { id: 'lavoro', etichetta: 'Lavoro', icona: '💼' },
  { id: 'salute', etichetta: 'Salute', icona: '🧘' },
  { id: 'relazioni', etichetta: 'Relazioni', icona: '❤️' },
  { id: 'hobby', etichetta: 'Hobby', icona: '🎨' },
  { id: 'crescita', etichetta: 'Crescita personale', icona: '🌱' },
  { id: 'finanza', etichetta: 'Finanza', icona: '💰' },
  { id: 'creativita', etichetta: 'Creatività', icona: '✨' },
  { id: 'altro', etichetta: 'Altro', icona: '🎯' },
];
const CAT_VALIDE = CATEGORIE_OBIETTIVO.map((c) => c.id);
export const STATI_OBIETTIVO = ['attivo', 'raggiunto', 'pausa'];

function leggiGrezzo() {
  if (typeof window === 'undefined') return [];
  try { const s = memGet(CHIAVE); const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function scrivi(lista) {
  if (typeof window === 'undefined') return;
  try { memSet(CHIAVE, JSON.stringify(lista)); } catch { /* quota/privato: si perde solo la persistenza */ }
}

/** Normalizza un obiettivo (dal client o dal corpo di una richiesta). */
export function normalizzaObiettivo(o = {}) {
  return {
    id: String(o.id || ('ob_' + Math.random().toString(36).slice(2))),
    titolo: String(o.titolo || '').slice(0, 120).trim(),
    descrizione: String(o.descrizione || '').slice(0, 500).trim(),
    categoria: CAT_VALIDE.includes(o.categoria) ? o.categoria : 'altro',
    stato: STATI_OBIETTIVO.includes(o.stato) ? o.stato : 'attivo',
    priorita: Math.max(1, Math.min(3, Number(o.priorita) || 2)),
    progresso: Math.max(0, Math.min(100, Math.round(Number(o.progresso) || 0))),
  };
}

/** Tutti gli obiettivi salvati (sul dispositivo). */
export function elencoObiettivi() {
  return leggiGrezzo().map(normalizzaObiettivo);
}

/** Crea o aggiorna un obiettivo (per id). Ritorna la lista aggiornata. */
export function salvaObiettivo(o) {
  const norm = normalizzaObiettivo(o);
  const lista = elencoObiettivi();
  const i = lista.findIndex((x) => x.id === norm.id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  scrivi(lista);
  return lista;
}

/** Rimuove un obiettivo. Ritorna la lista aggiornata. */
export function rimuoviObiettivo(id) {
  const lista = elencoObiettivi().filter((x) => x.id !== id);
  scrivi(lista);
  return lista;
}

/** Solo gli obiettivi ATTIVI (quelli che il Compagno deve tenere presenti). */
export function obiettiviAttivi(lista = null) {
  return (lista || elencoObiettivi()).filter((o) => o.stato === 'attivo' && o.titolo);
}

const ETICHETTA_CAT = Object.fromEntries(CATEGORIE_OBIETTIVO.map((c) => [c.id, c.etichetta]));

/**
 * PURA — blocco di prompt con gli obiettivi attivi, da mettere nel system del
 * Compagno. Sicura lato server. Ritorna '' se non ci sono obiettivi.
 */
export function formattaObiettivi(obiettivi = []) {
  const attivi = (Array.isArray(obiettivi) ? obiettivi : [])
    .map(normalizzaObiettivo)
    .filter((o) => o.stato === 'attivo' && o.titolo)
    .sort((a, b) => b.priorita - a.priorita)
    .slice(0, 8);
  if (!attivi.length) return '';
  const righe = attivi.map((o) => {
    const cat = ETICHETTA_CAT[o.categoria] || 'Altro';
    const prog = o.progresso ? ` — avanzamento ${o.progresso}%` : '';
    const desc = o.descrizione ? ` (${o.descrizione})` : '';
    return `- [${cat}] ${o.titolo}${desc}${prog}`;
  }).join('\n');
  return `\n\nOBIETTIVI DI VITA DELLA PERSONA (tienili presenti e aiutala concretamente a raggiungerli; quando è utile, chiedi come procede e proponi un piccolo passo avanti, senza forzare):\n${righe}`;
}
