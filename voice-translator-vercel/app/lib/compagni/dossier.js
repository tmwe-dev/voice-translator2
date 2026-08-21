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
import { estraiJSON, leggiEsitoRicerca } from './corsi/generatore.js';
import { createLogger } from '../logger.js';

const log = createLogger('compagni-dossier-lib');

// b.362 — una sola copia: la stessa funzione vive nel generatore dei corsi.

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
  const system = `Sei un analista che scrive un documento UTILE e CONCRETO, non un verbale della discussione. Chi lo legge vuole SAPERE e SAPER FARE, non sapere "chi ha detto cosa". Scrivi in lingua: ${lingua}. Vietato riempitivo, frasi vaghe ("e importante considerare", "gioca un ruolo cruciale") e conclusioni che non concludono.`;
  const prompt =
`Tema: "${argomento}".
${briefing ? `Fatti di partenza (dalle fonti):\n${briefing}\n\n` : ''}Confronto fra gli esperti (usalo come MATERIA PRIMA, non da riassumere nome per nome):
${discussione}

Scrivi il DOCUMENTO finale, in testo semplice, con SOSTANZA in ogni riga:
- In due righe: la risposta o il punto centrale, subito.
- I FATTI che contano: cosa e vero, cosa e stabilito, i numeri/dati se ci sono.
- COME SI FA / cosa fare in pratica: passi concreti, in ordine.
- Gli errori o le trappole da evitare.
- I nodi davvero aperti (solo quelli reali, non "servono ulteriori studi").
NON impostarlo come verbale del dibattito (chi ha detto cosa, chi concordava): quello non serve al lettore. Se un dato non c'e, dillo in tre parole invece di girarci intorno.`;
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
  // b.308 — 800 era stretto: articolo + punti + domande in JSON si troncavano
  // prima dei 4000 char del taglio finale. Ora c'e respiro.
  // b.363 — qui si pretende JSON valido: a temperatura alta usciva storto
  // e il ripiego consegnava il JSON grezzo come se fosse l'articolo.
  const r = await generaTesto({ system, prompt, userToken, maxTokens: 1500, temperature: 0.3 });
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
  // b.308 — il report della DISCUSSIONE INTERA aveva un tetto fisso di 1100:
  // su un dibattito lungo usciva mozzato. Ora lo spazio SEGUE la mole della
  // discussione (piu turni -> report piu ampio), con un soffitto generoso.
  const maxTokens = Math.min(3000, 1400 + Math.floor((discussione?.length || 0) / 60));
  const r = await generaTesto({ system, prompt, userToken, maxTokens });
  if (!r.ok) return { ok: false, motivo: r.motivo, status: r.status };
  return { ok: true, report: r.testo };
}
