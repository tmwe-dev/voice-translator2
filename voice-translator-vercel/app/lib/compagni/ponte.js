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

import OpenAI, { toFile } from 'openai';
import { resolveAuth } from '../apiAuth.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { preventivoTesto } from '../../wallet/addebita.js';
import { COSTO_AVATAR_SECONDI } from '../../wallet/tariffe.js';
import { callLLMWithFallback } from '../llmCaller.js';
import { cercaArgomenti } from '../topics/servizio.js';
import { createLogger } from '../logger.js';

const log = createLogger('compagni-ponte');

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
 * @returns {Promise<{ok:true, testo:string, caratteri:number, provider:string, modello:string, ripiego:boolean}
 *   | {ok:false, motivo:string, status?:number}>}
 */
export async function generaTesto({
  system = '', prompt = '', provider = 'openai', modello = 'gpt-4o-mini',
  userToken = null, roomId = null, roomSessionToken = null,
  maxTokens = 400,
  // b.231 — la barra "libertà" ora cambia davvero il comportamento: chi
  // chiama passa la temperatura (temperaturaLiberta). Difetto 0.7 come prima.
  temperature = 0.7,
  // ── INIZIO b.205 — i contenuti di Life si troncavano a metà ──
  // callLLMWithFallback, senza terzo argomento, usava il timeout di
  // DIFETTO di 10s, tarato sulla TRADUZIONE (una frase, ~1-2s). Ma una
  // lezione (900 token), un quiz o un syllabus con gpt-4o-mini superano
  // spesso i 10s: scattava il timeout, fallivano primary+fallback
  // ("All LLM providers failed") e il circuit breaker apriva, facendo poi
  // fallire a raffica anche le chiamate corte. Il Podcast si salvava solo
  // perché ogni turno è di 1-2 frasi. Ora la generazione lunga di Life ha
  // il suo tetto ampio; la traduzione resta sul suo percorso a 10s.
  timeoutMs = 45000,
  // ── FINE b.205 ──
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
    // b.363 — chi usa una chiave PROPRIA non paga il contatore, quindi non
    // gli si puo far scrivere il testo dalle chiavi di piattaforma: se la
    // sua chiave cade, il ripiego generava in silenzio a spese nostre e con
    // un fornitore che lui non aveva scelto. Con chiave propria si fallisce
    // e lo si dice.
    const fallbacks = [];
    if (!isOwnKey) {
      if (provider !== 'openai' && process.env.OPENAI_API_KEY) {
        fallbacks.push({ provider: 'openai', model: 'gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY });
      }
      if (provider !== 'anthropic' && process.env.ANTHROPIC_API_KEY) {
        fallbacks.push({ provider: 'anthropic', model: 'claude-3-haiku-20240307', apiKey: process.env.ANTHROPIC_API_KEY });
      }
    }

    const messaggi = componiMessaggi(system, prompt);
    // b.363 — si legge anche CHI ha risposto davvero: prima si dichiarava
    // sempre il fornitore richiesto, e un testo scritto dal ripiego veniva
    // attribuito a un modello che non l'aveva mai visto.
    const { translated, provider: fornitoreVero, model: modelloVero, wasFallback } = await callLLMWithFallback(
      { provider, model: modello, apiKey, messages: messaggi, systemPrompt: system, text: prompt, maxTokens, temperature },
      fallbacks,
      timeoutMs, // b.205 — tetto ampio per i contenuti lunghi di Life
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
    return { ok: true, testo, caratteri: testo.length, provider: fornitoreVero || provider, modello: modelloVero || modello, ripiego: !!wasFallback };
  } catch (e) {
    if (riservaId) await release(riservaId, 'errore-generazione').catch(() => {});
    return { ok: false, motivo: 'errore-generazione: ' + (e?.message || 'ignoto') };
  }
}

/**
 * Cerca fonti/argomenti col motore Topics/Cobra (già protetto SSRF).
 *
 * ── INIZIO b.247 — "non ho trovato niente" e "sono guasto" erano la STESSA COSA ──
 * Prima questa funzione faceva try/catch e nel catch ritornava `[]`. Chi
 * chiamava vedeva un array vuoto e NON aveva alcun modo di distinguere una
 * ricerca riuscita senza risultati da una ricerca esplosa (rete giù, RSS
 * irraggiungibile — vedi cercaNotizie: se anche la riserva Google fallisce,
 * `scaricaRss` lancia e l'eccezione arriva fin qui). Il guasto veniva
 * inghiottito in silenzio.
 *
 * È pericoloso per il Dossier e soprattutto per le materie CERTIFICATE
 * (medicina, psicologia, nutrizione, benessere): la lezione veniva generata
 * senza una sola fonte, ma con l'aria di essere fondata su fonti, e il
 * modello riempiva il vuoto INVENTANDO — esattamente ciò che il progetto
 * vieta. Nessuno se ne accorgeva, perché il difetto è muto.
 *
 * Ora l'esito è esplicito:
 *   { ok:true,  risultati:[...] } → ricerca riuscita (anche con 0 risultati)
 *   { ok:false, risultati:[], errore:'...' } → motore guasto
 *
 * Anche una risposta MALFORMATA (senza `argomenti` array) è un guasto, non
 * uno zero risultati: se non si capisce cosa ha risposto il motore non si
 * può giurare che la ricerca sia andata bene.
 *
 * Retrocompatibilità: i chiamanti normalizzano ancora un ARRAY nudo (vecchio
 * contratto) leggendolo come ricerca riuscita, così un doppio di prova che
 * ritorna un array non viene scambiato per un guasto.
 * ── FINE b.247 ──
 */
export async function cerca(query, { lingua = 'it', profonda = false, fonti = 6 } = {}) {
  // Query vuota: non c'è niente da cercare. Non è un guasto del motore.
  if (!query) return { ok: true, risultati: [] };
  try {
    const r = await cercaArgomenti(query, lingua, { profonda, fonti });
    if (!r || !Array.isArray(r.argomenti)) {
      log.warn('ricerca: risposta illeggibile dal motore Topics', { query: String(query).slice(0, 120) });
      return { ok: false, risultati: [], errore: 'esito-illeggibile' };
    }
    return { ok: true, risultati: r.argomenti };
  } catch (e) {
    // b.247 — il guasto si REGISTRA sempre: prima spariva nel catch vuoto.
    log.warn('ricerca guasta', { query: String(query).slice(0, 120), errore: e?.message || 'ignoto' });
    return { ok: false, risultati: [], errore: e?.message || 'ricerca-guasta' };
  }
}

// ═══════════════════════════════════════════════════════════════
// b.221 — genera l'IMMAGINE dell'avatar (OpenAI gpt-image-1).
//
// Meccanica ripresa da Funnemail (edge funnemail-openai): il modello crea
// un'immagine da un PROMPT; se si passa un RIFERIMENTO, il volto/identità
// arriva da lì e il prompt lo riadatta (stile/scena) — "il prompt è la scena,
// il personaggio dal riferimento". Qui la generazione vive lato server (route
// nostra + questa cerniera), non nel client. Addebito dal wallet come il testo.
// La chiave OpenAI passa da resolveAuth (piattaforma o chiave dell'utente).
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// b.333 — LEGGI IMMAGINE (visione): la foto degli appunti diventa testo.
// Serve ai Materiali dei Compiti: l'utente fotografa la pagina, l'AI la
// trascrive fedelmente e la struttura. E il gradino A PAGAMENTO della
// cascata (frazioni di centesimo, wallet dell'utente): il gradino gratis
// e incollare il testo. Stessa disciplina di generaTesto: riserva →
// chiamata → commit al costo vero; niente output = rilascio.
// ═══════════════════════════════════════════════════════════════
export async function leggiImmagine({ immagineDataUrl = '', istruzione = '', userToken = null, maxTokens = 1500 } = {}) {
  if (!immagineDataUrl || !immagineDataUrl.startsWith('data:image/')) {
    return { ok: false, motivo: 'immagine-mancante' };
  }
  let auth;
  try { auth = await resolveAuth({ userToken, provider: 'openai' }); }
  catch { return { ok: false, motivo: 'non-autorizzato', status: 401 }; }
  const { apiKey, isOwnKey, billingEmail } = auth;

  let riservaId = null;
  const paga = billingEmail && !isOwnKey;
  if (paga) {
    const caratteriStima = maxTokens * CARATTERI_PER_TOKEN_STIMA;
    const r = await riserva(billingEmail, preventivoTesto(caratteriStima), { tipo: 'compagno', caratteri: caratteriStima });
    if (!r.ok) return { ok: false, motivo: 'credito-insufficiente', status: 402 };
    riservaId = r.riservaId;
  }
  try {
    const openai = new OpenAI({ apiKey });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      temperature: 0.1, // trascrizione fedele, non creativa
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: istruzione || 'Trascrivi fedelmente tutto il testo leggibile in questa immagine.' },
          { type: 'image_url', image_url: { url: immagineDataUrl, detail: 'high' } },
        ],
      }],
    });
    const testo = (resp?.choices?.[0]?.message?.content || '').trim();
    if (!testo) {
      if (riservaId) await release(riservaId, 'nessun-output').catch(() => {});
      return { ok: false, motivo: 'nessun-output' };
    }
    if (riservaId) await commit(riservaId, preventivoTesto(testo.length), { tipo: 'compagno', caratteri: testo.length }).catch(() => {});
    return { ok: true, testo };
  } catch (e) {
    if (riservaId) await release(riservaId, 'errore-visione').catch(() => {});
    log.error('leggiImmagine fallita:', e?.message || e);
    return { ok: false, motivo: 'visione-fallita', status: 502 };
  }
}

export async function generaAvatar({ prompt = '', userToken = null, riferimentoDataUrl = null, dimensione = '1024x1024', qualita = 'low' } = {}) {
  if (!prompt) return { ok: false, motivo: 'prompt-mancante' };

  let auth;
  try {
    auth = await resolveAuth({ userToken, provider: 'openai' });
  } catch {
    return { ok: false, motivo: 'non-autorizzato', status: 401 };
  }
  const { apiKey, isOwnKey, billingEmail } = auth;

  // Riserva a costo fisso (un'immagine). Solo se paga la piattaforma.
  let riservaId = null;
  const paga = billingEmail && !isOwnKey;
  if (paga) {
    const r = await riserva(billingEmail, COSTO_AVATAR_SECONDI, { tipo: 'avatar' });
    if (!r.ok) return { ok: false, motivo: 'credito-insufficiente', status: 402 };
    riservaId = r.riservaId;
  }

  try {
    const openai = new OpenAI({ apiKey });
    // b.225 — SFONDO TRASPARENTE: l'avatar deve stare bene sia su tema scuro
    // sia chiaro. gpt-image-1 con background:'transparent' + PNG dà l'alpha.
    const comuni = { model: 'gpt-image-1', size: dimensione, quality: qualita, n: 1, background: 'transparent', output_format: 'png' };
    let resp;
    if (riferimentoDataUrl) {
      // Reference-based: il volto arriva dal riferimento, il prompt lo riadatta.
      const b64 = String(riferimentoDataUrl).replace(/^data:image\/\w+;base64,/, '');
      const file = await toFile(Buffer.from(b64, 'base64'), 'riferimento.png', { type: 'image/png' });
      resp = await openai.images.edit({ ...comuni, image: file, prompt });
    } else {
      resp = await openai.images.generate({ ...comuni, prompt });
    }
    const out = resp?.data?.[0]?.b64_json;
    if (!out) {
      if (riservaId) await release(riservaId, 'nessuna-immagine').catch(() => {});
      return { ok: false, motivo: 'nessuna-immagine' };
    }
    if (riservaId) await commit(riservaId, COSTO_AVATAR_SECONDI, { tipo: 'avatar' });
    return { ok: true, dataUrl: `data:image/png;base64,${out}` };
  } catch (e) {
    if (riservaId) await release(riservaId, 'errore-immagine').catch(() => {});
    // gpt-image-1 può rifiutare (es. volto di persona reale): lo diciamo pulito.
    const rifiuto = e?.status === 400 || /safety|moderation|rejected/i.test(e?.message || '');
    return { ok: false, motivo: rifiuto ? 'rifiutata' : 'errore-immagine: ' + (e?.message || 'ignoto'), status: e?.status };
  }
}
