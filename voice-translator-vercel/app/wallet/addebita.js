// ═══════════════════════════════════════════════════════════════
// ADDEBITA — L'UNICO ponte tra le API e il portafoglio.
//
// Le API di traduzione non parlano mai direttamente col database
// dei crediti: chiamano queste 4 funzioni e basta.
//
// Chi paga? Lo decide resolveAuth (billingEmail):
//   - userToken  → paga chi parla (regola stanze Community)
//   - roomId     → paga chi ha aperto la conversazione (regola inviti)
// Quindi qui riceviamo solo "utente" e non dobbiamo decidere niente.
//
// Regola di sicurezza: se il database dei crediti non risponde,
// la conversazione NON si interrompe (ritorniamo 'saltato' e lo
// scriviamo nei log). Meglio un uso non fatturato che un servizio rotto.
// ═══════════════════════════════════════════════════════════════

import { saldo, scalaSeDisponibile } from './contabilita.js';
import { costoConversazione, costoElevenLabsCaratteri, costoMessaggioTesto, costoRiassunto, costoAzioneChat } from './consumo.js';
import { costoProviderCent, CARATTERI_PER_SECONDO } from './provider-costi.js';
import { COSTO_CLONAZIONE_SECONDI } from './tariffe.js';

/**
 * Il credito è finito? (da chiamare PRIMA di lavorare: se sì → 402)
 * Se non c'è un utente da addebitare (chiave propria) → false.
 *
 * @param {string} utente
 * @param {{failClosed?: boolean}} opzioni - b.157: se il saldo non si
 *   legge (Supabase giù), la regola di sempre e "meglio un uso non
 *   fatturato che un servizio rotto" — si procede. Ma per il fornitore
 *   PIÙ CARO (voce premium ElevenLabs), lo stesso guasto che ci
 *   impedisce di leggere il saldo ci impedisce anche di sapere quanto
 *   staremo regalando: un'interruzione Supabase diventerebbe voce
 *   premium illimitata e gratis per chiunque, finché dura. Con
 *   failClosed:true si blocca invece di procedere, SOLO per chi lo
 *   chiede esplicitamente (oggi solo tts-elevenlabs).
 */
export async function creditoFinito(utente, opzioni = {}) {
  if (!utente) return false;
  try {
    return (await saldo(utente)) <= 0;
  } catch (e) {
    console.error('[wallet] saldo non leggibile:', e.message);
    return !!opzioni.failClosed;
  }
}

/**
 * Il credito basta per quello che sto per fare?
 *
 * b.111 — `creditoFinito` chiede solo "il saldo e a zero?". Bastava un
 * secondo di credito residuo per passare, e poi si sintetizzava una
 * frase da novanta: il lavoro veniva fatto, l'addebito falliva, e il
 * servizio piu caro che abbiamo era regalato. Un solo secondo di
 * credito apriva un rubinetto senza fondo, perche il costo della voce
 * premium dipende da quanto e lungo il testo e il testo lo sceglie chi
 * chiede.
 *
 * Questa domanda va fatta PRIMA di chiamare il fornitore, con il costo
 * gia calcolato. Se il portafoglio non risponde non si blocca nessuno:
 * meglio un uso non fatturato che un servizio rotto — ma l'addebito
 * vero dopo resta comunque il controllo definitivo.
 *
 * b.157 — stessa eccezione di creditoFinito: con {failClosed:true} un
 * guasto nella lettura del saldo blocca invece di procedere. Usato
 * solo dalla voce premium ElevenLabs, il fornitore piu caro.
 *
 * @returns {boolean} vero se NON si puo procedere
 */
export async function creditoInsufficiente(utente, costoPrevisto, opzioni = {}) {
  if (!utente) return false;
  if (!Number.isFinite(costoPrevisto) || costoPrevisto <= 0) return false;
  try {
    return (await saldo(utente)) < costoPrevisto;
  } catch (e) {
    console.error('[wallet] saldo non leggibile:', e.message);
    return !!opzioni.failClosed;
  }
}

/**
 * Quanto costera una sintesi premium di questo testo? Serve a chiedere
 * il permesso prima di spendere, con lo STESSO conto che si usera dopo.
 */
export function preventivoVocePremium(caratteri) {
  return costoElevenLabsCaratteri(caratteri || 0);
}

/**
 * Un pezzo di conversazione vocale standard (STT + traduzione + voce base).
 * @returns {'ok'|'esaurito'|'saltato'}
 */
export async function addebitaVoce(utente, secondi) {
  if (!utente || !secondi) return 'saltato';
  const costo = costoConversazione(secondi, false);
  return scala(utente, costo, {
    tipo: 'voce',
    secondi_audio: Math.ceil(secondi),
    costo_cent: costoProviderCent(secondi, 'gpt-5.4-mini', 'edge-tts'),
  });
}

/**
 * Sintesi vocale premium ElevenLabs (fattura a caratteri, moltiplicatore 3x).
 * @returns {'ok'|'esaurito'|'saltato'}
 */
export async function addebitaVocePremium(utente, caratteri) {
  if (!utente || !caratteri) return 'saltato';
  const costo = costoElevenLabsCaratteri(caratteri);
  const secondiParlato = Math.ceil(caratteri / CARATTERI_PER_SECONDO);
  return scala(utente, costo, {
    tipo: 'voce_premium',
    caratteri,
    costo_cent: costoProviderCent(secondiParlato, 'gpt-5.4-mini', 'elevenlabs-flash'),
  });
}

/**
 * Quanto costera (in secondi di credito) un messaggio di testo di N
 * caratteri? STESSA formula di addebitaTesto, cosi il preventivo non
 * puo mai disallinearsi dall'addebito vero.
 *
 * b.161 — CONFERMATO (quarto audit esterno, punto 1 dell'ordine di
 * intervento): resolveAuth controllava solo `creditoFinito` (saldo>0)
 * prima di chiamare translate/tts, mai il costo vero. La RPC
 * wallet_usa (migrazione 006) e atomica ma NON parziale: un saldo
 * positivo ma sotto il costo viene rifiutato lasciando il saldo
 * INTATTO — quindi non scende mai sotto la soglia che lo bloccherebbe,
 * e il servizio (gia consegnato dal fornitore quando l'addebito
 * scatta, DOPO la risposta) resta gratis, ripetibile all'infinito.
 * Questo preventivo permette di chiedere PRIMA di chiamare il
 * fornitore, come gia faceva la voce premium ElevenLabs.
 */
export function preventivoTesto(caratteri) {
  const secondiParlato = Math.ceil((caratteri || 0) / CARATTERI_PER_SECONDO);
  return Math.max(costoMessaggioTesto(), secondiParlato);
}

/**
 * Un messaggio tradotto (testo scritto o voce riconosciuta nel browser).
 * Costo: i caratteri diventano secondi (~17 car = 1s), minimo 5 secondi.
 * @returns {'ok'|'esaurito'|'saltato'}
 */
export async function addebitaTesto(utente, caratteri) {
  if (!utente || !caratteri) return 'saltato';
  const secondiParlato = Math.ceil(caratteri / CARATTERI_PER_SECONDO);
  const costo = preventivoTesto(caratteri);
  return scala(utente, costo, {
    tipo: 'testo',
    caratteri,
    costo_cent: costoProviderCent(secondiParlato, 'gpt-5.4-mini', 'edge-tts'),
  });
}

/**
 * Riassunto AI di fine conversazione (costo fisso).
 * @returns {'ok'|'esaurito'|'saltato'}
 */
export async function addebitaRiassunto(utente) {
  if (!utente) return 'saltato';
  return scala(utente, costoRiassunto(), { tipo: 'riassunto', costo_cent: 0.05 });
}

/**
 * b.159 — Azione chat AI (riassunto/report/analisi/consiglio/vocabolario
 * generati da /api/chat-action, fino a 2000 token di risposta). Prima
 * NON esisteva nessun addebito per questa rotta: costo fisso, come per
 * addebitaRiassunto.
 * @returns {'ok'|'esaurito'|'saltato'}
 */
export async function addebitaAzioneChat(utente) {
  if (!utente) return 'saltato';
  return scala(utente, costoAzioneChat(), { tipo: 'azione_chat', costo_cent: 0.12 });
}

/**
 * Il credito basta per clonare una voce (costo fisso, €5,00)?
 * Da chiamare PRIMA di parlare con ElevenLabs, come per la voce premium.
 *
 * b.160 — CONFERMATO (secondo audit esterno, punto 7): chiamava
 * creditoInsufficiente SENZA {failClosed:true}. La clonazione con
 * chiave di piattaforma e' esattamente lo stesso caso della voce
 * premium ElevenLabs (nessun percorso "chiave propria" per chi non ne
 * ha una — qui la propria chiave, quando c'e, salta questo controllo
 * a monte, vedi voice-clone/route.js): un guasto Supabase diventava
 * "credito sempre sufficiente", ElevenLabs veniva chiamato (costo
 * reale, €5 equivalenti), e l'addebito successivo poteva fallire in
 * silenzio ('saltato'). Ora fail-closed, come tts-elevenlabs.
 */
export async function creditoInsufficientePerClonazione(utente) {
  return creditoInsufficiente(utente, COSTO_CLONAZIONE_SECONDI, { failClosed: true });
}

/**
 * Clonazione voce ElevenLabs (costo fisso, una tantum, €5,00).
 * @returns {'ok'|'esaurito'|'saltato'}
 */
export async function addebitaClonazione(utente) {
  if (!utente) return 'saltato';
  return scala(utente, COSTO_CLONAZIONE_SECONDI, { tipo: 'clonazione_voce', costo_cent: 500 });
}

// ── Unica scrittura: prova a scalare, non far mai cadere la chiamata ──
async function scala(utente, secondi, dettaglio) {
  try {
    const riuscito = await scalaSeDisponibile(utente, secondi, dettaglio);
    return riuscito ? 'ok' : 'esaurito';
  } catch (e) {
    console.error('[wallet] addebito fallito, non blocco:', e.message);
    return 'saltato';
  }
}
