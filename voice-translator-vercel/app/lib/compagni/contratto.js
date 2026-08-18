// ═══════════════════════════════════════════════════════════════
// CONTRATTO — l'involucro comune dei Compagni (Luca)
//
// Ispirato al voice-agent maturo di COBRA/Robin (letto dalla KB ElevenLabs):
//  - GERARCHIA DI PRIORITÀ: in caso di conflitto, un ordine chiaro
//    (sicurezza > lingua > anti-invenzione > flusso > tono);
//  - CAPACITÀ dichiarate: l'agente sa cosa può DAVVERO fare ora (così Omar
//    non inventa fonti e Yuki verifica solo quando ha di che verificare);
//  - REGOLE EPISTEMICHE: distinguere fatto / inferenza / opinione / non so;
//  - la barra LIBERTÀ che finalmente CAMBIA il comportamento: sia il testo
//    del prompt, sia la temperatura del modello.
//
// Tutto PURO e testabile: nessuna rete, nessuno stato. Si compone con la
// personalità del Compagno appendendo `involucroCompagno(...)` al system.
// ═══════════════════════════════════════════════════════════════

import { promptProfilo } from './profili.js';

export const GERARCHIA_PRIORITA =
`GERARCHIA DI PRIORITÀ (se due indicazioni confliggono, vince quella più in alto):
1) Sicurezza e rispetto della persona.
2) La lingua richiesta.
3) Non inventare (anti-invenzione).
4) Lo scopo e il flusso della conversazione.
5) Tono e stile.`;

export const REGOLE_EPISTEMICHE =
`ONESTÀ INTELLETTUALE: distingui ciò che è un FATTO da un'INFERENZA, un'OPINIONE o un "non lo so". Non inventare dati, nomi, numeri, citazioni o fonti. Se non sei sicuro, dillo con naturalezza invece di riempire il vuoto.`;

// I quattro modi della barra "libertà": testo + temperatura del modello.
const LIB = {
  strict: { t: 0.3, testo: 'MODO FEDELE: resta rigorosamente nel tuo ruolo e nei fatti; poca inferenza, nessuna divagazione.' },
  balanced: { t: 0.6, testo: 'MODO EQUILIBRATO: ruolo stabile, ma puoi esplorare e collegare idee quando aiuta la persona.' },
  creative: { t: 0.85, testo: 'MODO CREATIVO: associazioni e ipotesi sono consentite; segnalale come tali ("ipotesi:", "immagino che…").' },
  autonomous: { t: 0.95, testo: 'MODO AUTONOMO: puoi proporre direzioni nuove e prendere iniziativa, restando trasparente su cosa è certo e cosa no.' },
};
const LIB_DEF = 'balanced';

/** Temperatura del modello a partire dalla barra libertà. */
export function temperaturaLiberta(liberta) {
  return (LIB[liberta] || LIB[LIB_DEF]).t;
}

/** Riga di comportamento a partire dalla barra libertà. */
export function promptLiberta(liberta) {
  return (LIB[liberta] || LIB[LIB_DEF]).testo;
}

/**
 * Blocco CAPACITÀ: dice all'agente cosa può DAVVERO fare in QUESTO momento.
 * @param ricerca  ha accesso a ricerca web in tempo reale?
 * @param fonti    gli sono state fornite fonti verificate (es. da Dossier/corso)?
 * @param memoria  ha memoria di questa persona?
 */
export function bloccoCapacita({ ricerca = false, fonti = false, memoria = false } = {}) {
  const righe = [
    `- ricerca web in tempo reale: ${ricerca ? 'sì' : 'no'}`,
    `- fonti verificate fornite: ${fonti ? 'sì' : 'no'}`,
    `- memoria di questa persona: ${memoria ? 'sì' : 'no'}`,
  ].join('\n');
  const regola = (!ricerca && !fonti)
    ? '\nNON hai accesso a fonti esterne: NON citare link, studi, articoli o riferimenti come se li avessi verificati. Ragiona sulle tue conoscenze e, quando serve una verifica reale, proponi di aprire il Dossier o la Ricerca.'
    : '';
  return `LE TUE CAPACITÀ ORA:\n${righe}${regola}`;
}

/**
 * Involucro comune da APPENDERE al system del Compagno (dopo la personalità).
 * Ritorna un blocco che parte con due a-capo, pronto per la concatenazione.
 *
 * b.237 — secondo asse: `profilo` ('conversazionale'|'didattico'|
 * 'dibattimentale'|'operativo', vedi profili.js). La libertà dice QUANTO
 * spaziare, il profilo dice COME comportarsi in questa superficie. Se non
 * viene passato, l'involucro resta identico a prima (retrocompatibile).
 */
export function involucroCompagno({ liberta = LIB_DEF, capacita = {}, antiRipetizione = false, profilo = null } = {}) {
  const parti = [
    GERARCHIA_PRIORITA,
    bloccoCapacita(capacita),
    REGOLE_EPISTEMICHE,
    promptLiberta(liberta),
  ];
  if (profilo) parti.push(promptProfilo(profilo));
  if (antiRipetizione) {
    parti.push('Non ripeterti: se hai già detto una cosa in questa conversazione, aggiungi un punto NUOVO invece di riformularla.');
  }
  return '\n\n' + parti.join('\n\n');
}
