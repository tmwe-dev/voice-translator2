// ═══════════════════════════════════════════════════════════════
// COSTI FORNITORI — quanto ci costa DAVVERO ciascuno (Luca, b.246)
//
// Il controllo costi che avevamo era zoppo su tre gambe:
//
//  1. `wallet_economics` dà il totale del giorno, ma non dice CHI l'ha
//     speso: se un fornitore raddoppia il prezzo, il totale sale e non si
//     sa dove guardare.
//  2. `provider_snapshots` interroga i fornitori, ma di fatto conteneva
//     solo ElevenLabs: gli altri fallivano e venivano saltati in silenzio,
//     dando l'impressione che non avessero consumi.
//  3. `translations` — lo storico per traduzione — non esisteva proprio:
//     ogni insert falliva dentro un `.catch(() => {})`.
//
// Qui si costruisce il quadro dai NOSTRI conti, non da quelli altrui: il
// costo lo calcoliamo già a ogni chiamata, quindi non dipendiamo dal fatto
// che un fornitore esponga o meno un endpoint di consumo. Le fotografie dei
// fornitori restano utili per il confronto, ma non sono più l'unica fonte.
// ═══════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '../lib/supabase.js';
import { COSTI_TRADUZIONE, COSTI_TTS, COSTI_STT } from './provider-costi.js';

/**
 * Quanto ha speso ogni fornitore, e per cosa, negli ultimi `giorni`.
 * @returns {{fornitori:object[], coppie:object[], totaleUsd:number, giorni:number}}
 */
export async function costiPerFornitore({ giorni = 30 } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb) return { fornitori: [], coppie: [], totaleUsd: 0, giorni };
  const da = new Date(Date.now() - giorni * 86400000).toISOString();

  const { data, error } = await sb.from('translations')
    .select('provider, ai_model, cost_usd, tokens_in, tokens_out, source_lang, target_lang, duration_ms')
    .gte('created_at', da);
  if (error || !data) return { fornitori: [], coppie: [], totaleUsd: 0, giorni, errore: error?.message };

  const perFornitore = new Map();
  const perCoppia = new Map();
  let totaleUsd = 0;

  for (const r of data) {
    const costo = Number(r.cost_usd) || 0;
    totaleUsd += costo;

    const kf = `${r.provider || 'sconosciuto'}|${r.ai_model || '—'}`;
    const f = perFornitore.get(kf) || { provider: r.provider || 'sconosciuto', modello: r.ai_model || '—', chiamate: 0, costoUsd: 0, tokenIn: 0, tokenOut: 0, msTotali: 0 };
    f.chiamate++; f.costoUsd += costo;
    f.tokenIn += Number(r.tokens_in) || 0;
    f.tokenOut += Number(r.tokens_out) || 0;
    f.msTotali += Number(r.duration_ms) || 0;
    perFornitore.set(kf, f);

    const kc = `${r.source_lang || '?'}→${r.target_lang || '?'}`;
    const c = perCoppia.get(kc) || { coppia: kc, chiamate: 0, costoUsd: 0 };
    c.chiamate++; c.costoUsd += costo;
    perCoppia.set(kc, c);
  }

  const fornitori = [...perFornitore.values()]
    .map(f => ({ ...f, costoUsd: +f.costoUsd.toFixed(6), msMedi: f.chiamate ? Math.round(f.msTotali / f.chiamate) : 0 }))
    .sort((a, b) => b.costoUsd - a.costoUsd);
  const coppie = [...perCoppia.values()]
    .map(c => ({ ...c, costoUsd: +c.costoUsd.toFixed(6) }))
    .sort((a, b) => b.chiamate - a.chiamate);

  return { fornitori, coppie, totaleUsd: +totaleUsd.toFixed(6), giorni, chiamate: data.length };
}

/**
 * Il listino che stiamo usando per i conti, tutto in un posto: serve a
 * verificare che i prezzi scritti nel codice siano ancora quelli veri.
 * Un listino che invecchia in silenzio falsa OGNI stima a valle.
 */
export function listinoAttuale() {
  return {
    traduzione: Object.entries(COSTI_TRADUZIONE).map(([id, v]) => ({ id, unita: 'usd/1M caratteri', ...v })),
    tts: Object.entries(COSTI_TTS).map(([id, v]) => ({ id, unita: 'usd/1M caratteri', ...v })),
    stt: Object.entries(COSTI_STT).map(([id, v]) => ({ id, unita: 'usd/minuto', ...v })),
  };
}

/**
 * Quali fornitori NON riusciamo a leggere dall'esterno. È l'informazione
 * che mancava: un fornitore assente dalle fotografie sembrava "senza
 * consumi", mentre era solo cieco.
 */
export async function fornitoriCiechi({ ore = 26 } = {}) {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const da = new Date(Date.now() - ore * 3600000).toISOString();
  const { data } = await sb.from('provider_snapshots').select('provider, dati, created_at').gte('created_at', da);
  const stato = new Map();
  for (const r of (data || [])) {
    const errore = r.dati?.errore || null;
    const prec = stato.get(r.provider);
    // Conta l'ultima lettura di ciascun fornitore.
    if (!prec || new Date(r.created_at) > new Date(prec.quando)) {
      stato.set(r.provider, { provider: r.provider, quando: r.created_at, leggibile: !errore, errore });
    }
  }
  return [...stato.values()];
}
