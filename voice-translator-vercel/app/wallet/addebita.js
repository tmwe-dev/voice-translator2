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
import { costoConversazione, costoElevenLabsCaratteri, costoMessaggioTesto, costoRiassunto } from './consumo.js';
import { costoProviderCent, CARATTERI_PER_SECONDO } from './provider-costi.js';

/**
 * Il credito è finito? (da chiamare PRIMA di lavorare: se sì → 402)
 * Se non c'è un utente da addebitare (chiave propria) → false.
 */
export async function creditoFinito(utente) {
  if (!utente) return false;
  try {
    return (await saldo(utente)) <= 0;
  } catch (e) {
    console.error('[wallet] saldo non leggibile, non blocco:', e.message);
    return false;
  }
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
 * Un messaggio tradotto (testo scritto o voce riconosciuta nel browser).
 * Costo: i caratteri diventano secondi (~17 car = 1s), minimo 5 secondi.
 * @returns {'ok'|'esaurito'|'saltato'}
 */
export async function addebitaTesto(utente, caratteri) {
  if (!utente || !caratteri) return 'saltato';
  const secondiParlato = Math.ceil(caratteri / CARATTERI_PER_SECONDO);
  const costo = Math.max(costoMessaggioTesto(), secondiParlato);
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
