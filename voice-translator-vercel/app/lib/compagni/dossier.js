// ═══════════════════════════════════════════════════════════════
// DOSSIER — dall'argomento al documento (Luca)
//
// Il flusso "job" di Cobra (raccolta → documento → revisione), ricostruito
// leggero sui pezzi che BarTalk ha già:
//   1. RICERCA   → ponte.cerca (Topics/Cobra, SSRF-safe)
//   2. BRIEFING  → ponte.generaTesto: un articolo neutro da discutere,
//                  fondato sulle fonti (mini-RAG) + punti + domande aperte
//   3. DISCUSSIONE → l'orchestratore podcast (rotta a parte)
//   4. REPORT    → ponte.generaTesto: il documento finale dalla discussione
//
// Tutto passa dalla cerniera → wallet. I costruttori di prompt sono puri e
// testabili; i generatori sono involucri sottili.
// ═══════════════════════════════════════════════════════════════

import { generaTesto, cerca } from './ponte.js';
import { estraiJSON } from './corsi/generatore.js';
import { createLogger } from '../logger.js';

const log = createLogger('compagni-dossier-lib');

// ── INIZIO b.247 — "nessuna fonte" e "ricerca guasta" vanno separati ──
// `ponte.cerca` ritornava `[]` in tutti e due i casi: il briefing nasceva
// senza fonti e con l'aria di averle cercate, e il modello colmava il vuoto
// inventando. Ora l'esito è { ok, risultati, errore }; l'ARRAY nudo del
// vecchio contratto resta accettato come ricerca riuscita (retrocompatibilità),
// mentre una forma sconosciuta vale guasto, perché non si può giurare il contrario.
function leggiEsitoRicerca(x) {
  if (Array.isArray(x)) return { ok: true, risultati: x };
  if (x && typeof x === 'object' && typeof x.ok === 'boolean') {
    return { ok: x.ok, risultati: Array.isArray(x.risultati) ? x.risultati : [], errore: x.errore };
  }
  return { ok: false, risultati: [], errore: 'esito-ricerca-sconosciuto' };
}
// ── FINE b.247 ──

// ── PROMPT: briefing (l'articolo da discutere) ──
export function promptBriefing({ argomento, fonti = [], lingua = 'it', ricercaGuasta = false } = {}) {
  const system = `Sei un redattore neutrale. Scrivi in lingua: ${lingua}. Riporti i fatti con equilibrio, senza prendere posizione.`;
  const bloccoFonti = (fonti && fonti.length)
    ? `\n\nFONTI (fondaci sopra i fatti):\n${fonti.slice(0, 6).map((f, i) => `${i + 1}. ${f.titolo || ''} — ${(f.sintesi || '').slice(0, 300)}`).join('\n')}`
    : '';
  // b.247 — qui le fonti sono un di più, non un requisito: il dossier si fa
  // lo stesso. Ma senza fonti va DETTO al modello, altrimenti scrive lo stesso
  // con l'aplomb di chi ha letto le carte e cita fatti che non ha.
  const bloccoSenzaFonti = (fonti && fonti.length)
    ? ''
    : `\n\nNON hai fonti: la ricerca ${ricercaGuasta ? 'è FALLITA (motore di ricerca guasto)' : 'non ha restituito documenti'}. Non citare fonti, non attribuire dichiarazioni a nessuno, non inventare dati, numeri o date: resta sui termini generali del tema e segnala che i fatti vanno ancora verificati.`;
  const prompt =
`Prepara un briefing su "${argomento}" da usare come base per una discussione.
Rispondi SOLO con JSON valido:
{ "articolo": "2-3 paragrafi neutri sul tema", "punti": ["punto chiave", "..."], "domande": ["domanda aperta per il dibattito", "..."] }
Da 3 a 5 punti, da 2 a 3 domande.${bloccoFonti}${bloccoSenzaFonti}`;
  return { system, prompt };
}

// ── PROMPT: report finale (il documento) ──
export function promptReport({ argomento, briefing = '', discussione = '', lingua = 'it' } = {}) {
  const system = `Sei un analista. Scrivi un documento finale chiaro e utile, adatto a chi non ha seguito la discussione. Scrivi in lingua: ${lingua}.`;
  const prompt =
`Argomento: "${argomento}".
${briefing ? `Contesto di partenza:\n${briefing}\n\n` : ''}Discussione fra gli esperti:
${discussione}

Scrivi il REPORT finale con queste sezioni, in testo semplice (niente tabelle):
- Sintesi (3-4 righe)
- Posizioni emerse
- Punti di accordo
- Punti di disaccordo
- Conclusione
- Domande ancora aperte`;
  return { system, prompt };
}

/**
 * Prepara il briefing: cerca le fonti, poi sintetizza l'articolo da
 * discutere. Ritorna { ok, articolo, punti, domande, fonti }.
 */
export async function preparaBriefing({ argomento, lingua = 'it', userToken = null } = {}) {
  if (!argomento || !argomento.trim()) return { ok: false, motivo: 'argomento-mancante' };
  // b.247 — il guasto della ricerca non si genera più in silenzio: si REGISTRA
  // (log.warn) e si porta fuori (`fontiGuaste`), così chi legge il dossier sa
  // che l'articolo non poggia su niente. Qui non si rifiuta — a differenza
  // delle materie certificate — perché il briefing serve ad aprire una
  // discussione, non a certificare fatti.
  const esito = leggiEsitoRicerca(await cerca(argomento, { lingua, profonda: true, fonti: 6 }));
  if (!esito.ok) {
    log.warn('briefing senza fonti: ricerca guasta', {
      argomento: String(argomento).slice(0, 120), errore: esito.errore || 'ignoto',
    });
  }
  const fonti = esito.risultati.slice(0, 6).map(a => ({ titolo: a.titolo, sintesi: a.sintesi, url: a.url }));
  const { system, prompt } = promptBriefing({ argomento, fonti, lingua, ricercaGuasta: !esito.ok });
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 800 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  const d = estraiJSON(r.testo) || {};
  return {
    ok: true,
    articolo: String(d.articolo || r.testo).slice(0, 4000),
    punti: Array.isArray(d.punti) ? d.punti.slice(0, 6).map(String) : [],
    domande: Array.isArray(d.domande) ? d.domande.slice(0, 4).map(String) : [],
    fonti,
    // b.247 — vero solo se il motore era GUASTO (non se semplicemente non ha
    // trovato niente): sono due cose diverse e vanno raccontate diverse.
    fontiGuaste: !esito.ok,
  };
}

/**
 * Il report finale dalla discussione. `discussione` è il testo dei turni.
 * Ritorna { ok, report }.
 */
export async function sintetizzaReport({ argomento, briefing = '', discussione = '', lingua = 'it', userToken = null } = {}) {
  if (!discussione || !discussione.trim()) return { ok: false, motivo: 'discussione-mancante' };
  const { system, prompt } = promptReport({ argomento, briefing, discussione, lingua });
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 1100 });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  return { ok: true, report: r.testo };
}
