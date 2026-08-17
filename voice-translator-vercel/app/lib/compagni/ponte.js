// ═══════════════════════════════════════════════════════════════
// PONTE — la cerniera UNICA fra Life e BarTalk (Luca)
//
// REGOLA DI ARCHITETTURA: nessun file di Life importa funzioni interne di
// BarTalk. Le importa SOLO questo file, che espone pochi verbi e nasconde
// il resto. Se domani BarTalk cambia dentro, cambia solo qui.
//
// Verbi:
//   generaTesto(...) → callLLM, MA passando dal wallet (riserva/commit),
//                      così Life non genera mai token fuori dal conto.
//   traduci(...)     → una specializzazione di generaTesto.
//   cerca(...)       → il motore Topics/Cobra (già SSRF-safe).
//
// La VOCE (TTS) resta sul percorso client esistente (/api/tts-elevenlabs):
// la rotta del podcast restituisce testo + voceId per ogni turno, e il
// client li fa parlare. Qui non si tocca l'audio.
//
// Addebito (verificato su /api/translate, regola §8):
//   unità wallet = SECONDI (17 caratteri ≈ 1s). preventivoTesto(caratteri)
//   dà i secondi. Si RISERVA su una stima (il tetto di output), si genera,
//   si fa COMMIT al costo vero (l'eccesso torna). Solo se billingEmail e
//   NON è chiave propria dell'utente. Sull'errore, release().
// ═══════════════════════════════════════════════════════════════

import { resolveAuth } from '../apiAuth.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { preventivoTesto } from '../../wallet/addebita.js';
import { callLLMWithFallback } from '../llmCaller.js';
import { cercaArgomenti } from '../topics/servizio.js';

// Fattore prudente: 1 token ≈ 4 caratteri; riserviamo su ×5 così il costo
// vero (commit sui caratteri reali) è sempre ≤ della riserva e l'eccesso
// torna nel wallet. Mai il contrario.
const CARATTERI_PER_TOKEN_STIMA = 5;

/** Costruisce i messaggi in modo che vadano bene per tutti i provider. */
function componiMessaggi(system, prompt) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];
}

/**
 * Genera testo con la personalità di un Compagno, passando dal wallet.
 *
 * @returns {Promise<{ok:true, testo:string, caratteri:number, provider:string}
 *   | {ok:false, motivo:string, status?:number}>}
 */
export async function generaTesto({
  system = '', prompt = '', provider = 'openai', modello = 'gpt-4o-mini',
  userToken = null, roomId = null, roomSessionToken = null,
  maxTokens = 400,
} = {}) {
  if (!prompt) return { ok: false, motivo: 'prompt-mancante' };

  // 1. Autorizzazione + chiave (throw = non autorizzato).
  let auth;
  try {
    auth = await resolveAuth({ userToken, roomId, roomSessionToken, provider });
  } catch {
    return { ok: false, motivo: 'non-autorizzato', status: 401 };
  }
  const { apiKey, isOwnKey, billingEmail } = auth;

  // 2. Riserva (solo se paga la piattaforma). Stima prudente sul tetto output.
  let riservaId = null;
  const paga = billingEmail && !isOwnKey;
  if (paga) {
    const caratteriStima = maxTokens * CARATTERI_PER_TOKEN_STIMA;
    const r = await riserva(billingEmail, preventivoTesto(caratteriStima), {
      tipo: 'compagno', caratteri: caratteriStima,
    });
    if (!r.ok) return { ok: false, motivo: 'credito-insufficiente', status: 402 };
    riservaId = r.riservaId;
  }

  // 3. Generazione, con catena di ripiego sui provider di piattaforma.
  try {
    const fallbacks = [];
    if (provider !== 'openai' && process.env.OPENAI_API_KEY) {
      fallbacks.push({ provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY });
    }
    if (provider !== 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      fallbacks.push({ provider: 'anthropic', model: 'claude-3-haiku-20240307', apiKey: process.env.ANTHROPIC_API_KEY });
    }

    const messaggi = componiMessaggi(system, prompt);
    const { translated } = await callLLMWithFallback(
      { provider, model: modello, apiKey, messages: messaggi, systemPrompt: system, text: prompt, maxTokens, temperature: 0.7 },
      fallbacks,
    );

    const testo = (translated || '').trim();
    if (!testo) {
      if (riservaId) await release(riservaId, 'nessun-output').catch(() => {});
      return { ok: false, motivo: 'nessun-output' };
    }

    // 4. Commit al costo VERO (caratteri generati). L'eccesso torna nel wallet.
    if (riservaId) {
      await commit(riservaId, preventivoTesto(testo.length), { tipo: 'compagno', caratteri: testo.length });
    }
    return { ok: true, testo, caratteri: testo.length, provider };
  } catch (e) {
    if (riservaId) await release(riservaId, 'errore-generazione').catch(() => {});
    return { ok: false, motivo: 'errore-generazione: ' + (e?.message || 'ignoto') };
  }
}

/**
 * Traduce un testo in una lingua, passando dallo stesso percorso fatturato.
 * v1: usa generaTesto con un'istruzione di traduzione. (In futuro potrà
 * puntare a /api/translate per il percorso ottimizzato con glossario.)
 */
export async function traduci(testo, lingua, opts = {}) {
  if (!testo || !lingua) return { ok: false, motivo: 'parametri-mancanti' };
  return generaTesto({
    system: `Sei un traduttore. Traduci fedelmente nella lingua "${lingua}". Rispondi SOLO con la traduzione, senza commenti.`,
    prompt: testo,
    maxTokens: Math.min(1200, Math.max(200, Math.ceil(testo.length / 2))),
    ...opts,
  });
}

/**
 * Cerca fonti/argomenti col motore Topics/Cobra (già protetto SSRF).
 * Ritorna gli argomenti trovati (o [] se niente).
 */
export async function cerca(query, { lingua = 'it', profonda = false, fonti = 6 } = {}) {
  if (!query) return [];
  try {
    const r = await cercaArgomenti(query, lingua, { profonda, fonti });
    return (r && r.argomenti) || [];
  } catch {
    return [];
  }
}
