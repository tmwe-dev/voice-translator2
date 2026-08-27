// ═══════════════════════════════════════════════════════════════
// SEZIONI — la KB personale di RadioChat (Prompt Sections), b.533.
//
// Tre tipi, come nell'originale (promptSections.ts):
//   regole    — sempre attive
//   argomento — attive solo se il messaggio tocca uno dei tag
//   contesto  — sfondo sempre attivo
// Con priorita (1 = prima) e interruttore. PURO e testabile: la
// persistenza sta nelle preferenze dell'utente (prefs.sezioniPrompt),
// il client le manda, le rotte le iniettano nel system.
// ═══════════════════════════════════════════════════════════════

export const TIPI_SEZIONE = ['regole', 'argomento', 'contesto'];

/** Pulisce una sezione arrivata dal client: mai fidarsi della forma. */
export function sanaSezione(s) {
  if (!s || typeof s !== 'object') return null;
  const tipo = TIPI_SEZIONE.includes(s.tipo) ? s.tipo : 'regole';
  const titolo = String(s.titolo || '').slice(0, 80).trim();
  const testo = String(s.testo || '').slice(0, 800).trim();
  if (!testo) return null;
  const tag = Array.isArray(s.tag) ? s.tag.map(t => String(t).slice(0, 30).toLowerCase().trim()).filter(Boolean).slice(0, 8) : [];
  const priorita = Math.min(10, Math.max(1, Number(s.priorita) || 5));
  return { tipo, titolo, testo, tag, priorita, attiva: s.attiva !== false };
}

/**
 * Le sezioni ATTIVE per questo messaggio, gia ordinate per priorita.
 * `argomento` si accende solo se un tag compare nel testo guida.
 */
export function risolviSezioni(sezioni, testoGuida = '') {
  const guida = String(testoGuida || '').toLowerCase();
  return (Array.isArray(sezioni) ? sezioni : [])
    .map(sanaSezione)
    .filter(Boolean)
    .filter(s => s.attiva)
    .filter(s => s.tipo !== 'argomento' || s.tag.some(t => guida.includes(t)))
    .sort((a, b) => a.priorita - b.priorita)
    .slice(0, 12);
}

/** Il blocco pronto per il system prompt ('' se non c'e niente). */
export function bloccoSezioni(sezioni, testoGuida = '') {
  const attive = risolviSezioni(sezioni, testoGuida);
  if (!attive.length) return '';
  const righe = attive.map(s => `${s.titolo ? s.titolo + ': ' : ''}${s.testo}`);
  return `\n\nREGOLE PERSONALI DI CHI TI ASCOLTA (valgono su questa conversazione):\n- ${righe.join('\n- ')}`;
}
