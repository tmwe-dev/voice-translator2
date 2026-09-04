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

import { spendibile, scalaSeDisponibile } from './contabilita.js';
// b.627 — restano i tre conti che servono ancora: gli altri quattro
// (costoConversazione, costoAzioneChat, costoProviderCent,
// COSTO_CLONAZIONE_SECONDI) entravano solo per le funzioni tolte.
import { costoElevenLabsCaratteri, costoMessaggioTesto, costoRiassunto } from './consumo.js';
import { CARATTERI_PER_SECONDO } from './provider-costi.js';
import { createLogger } from '../lib/logger.js';
const log = createLogger('addebita');   // b.604 — niente console.* sparsi: tutto dal logger

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
    // b.364 — il pavimento non e piu zero: e meno la tolleranza.
    return (await spendibile(utente)) <= 0;
  } catch (e) {
    log.error('[wallet] saldo non leggibile:', e.message);
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
    // b.364 — vedi creditoFinito.
    return (await spendibile(utente)) < costoPrevisto;
  } catch (e) {
    log.error('[wallet] saldo non leggibile:', e.message);
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
 * Riassunto AI di fine conversazione (costo fisso).
 * @returns {'ok'|'esaurito'|'saltato'}
 */
export async function addebitaRiassunto(utente) {
  if (!utente) return 'saltato';
  return scala(utente, costoRiassunto(), { tipo: 'riassunto', costo_cent: 0.05 });
}

// ═══════════════════════════════════════════════════════════════
// b.627 — SOLO RIMOZIONE: qui vivevano ancora SEI funzioni del vecchio
// modo di far pagare — addebitaVoce, addebitaVocePremium,
// addebitaTesto, addebitaAzioneChat, creditoInsufficientePerClonazione,
// addebitaClonazione. Addebitavano DOPO aver chiamato il fornitore, e
// per questo sono state sostituite dal giro riserva → commit/release
// nelle b.161, b.161-bis e b.164: l'addebito dopo lasciava aperta una
// finestra di corsa fra due richieste dello stesso utente, e il
// servizio poteva restare non pagato.
//
// Verificate con le tre lenti prima di toglierle:
// · nessuna rotta le chiamava piu: in tutto app/ i loro nomi comparivano
//   soltanto dentro i commenti che spiegano perche non si usano
//   (tts/route.js, voice-clone/route.js);
// · nessuna prova le eseguiva: le nove prove che le nominano verificano
//   l'OPPOSTO — che le rotte non le chiamino piu
//   (`expect(src).not.toContain('await addebitaClonazione(')`);
// · il motivo per cui erano nate e scritto nel diario ed e superato.
//
// Restavano quindi due modi di far pagare la stessa cosa, uno vivo e uno
// morto ma ancora importabile: bastava che qualcuno, domani, chiamasse
// addebitaVoce invece di riserva per saltare la riserva senza
// accorgersene. Su un sistema che tocca il denaro, due formule per lo
// stesso importo non sono uno spreco: sono un incidente in attesa.
//
// Restano vive, e non si toccano, le funzioni che il giro nuovo usa
// davvero: creditoFinito, creditoInsufficiente, preventivoTesto,
// preventivoVocePremium, addebitaRiassunto.
// ═══════════════════════════════════════════════════════════════

// ── Unica scrittura: prova a scalare, non far mai cadere la chiamata ──
async function scala(utente, secondi, dettaglio) {
  try {
    const riuscito = await scalaSeDisponibile(utente, secondi, dettaglio);
    return riuscito ? 'ok' : 'esaurito';
  } catch (e) {
    log.error('[wallet] addebito fallito, non blocco:', e.message);
    return 'saltato';
  }
}
