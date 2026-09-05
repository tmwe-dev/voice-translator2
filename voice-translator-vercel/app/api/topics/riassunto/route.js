// ═══════════════════════════════════════════════════════════════
// POST /api/topics/riassunto — la Sintesi di BarTalk (b.153)
//
// Il punto 18 del piano: l'articolo NON si copia; quello che si puo
// leggere dentro l'app e un RIASSUNTO ORIGINALE, scritto da noi, dai
// soli dati che gia mostriamo (titoli e descrizioni delle fonti del
// cluster). Il prompt vieta di inventare: se un fatto non e nei dati,
// non va nella sintesi.
//
// SOLDI — stesso ordine di /api/summary: autorizzazione (sessione) ->
// fornitore (OpenAI) -> esecuzione -> contabilita (wallet +
// trackDailySpend). E la cache CONDIVISA per topic+lingua (24h): la
// sintesi la paga il primo che la chiede, gli altri la leggono gratis.
//
// b.157 — audit pagamenti: CONFERMATO, prima l'unico addebito qui era
// sul vecchio user.credits (Redis), che l'autorizzazione non legge
// piu da tempo (vedi apiAuth.js — "l'UNICA verita e il wallet"). Ogni
// utente con sessione valida generava sintesi con costo OpenAI reale
// per la piattaforma e ZERO addebito sul wallet, per sempre. Ora usa
// addebitaRiassunto, lo stesso conto gia in uso da /api/summary.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { redis } from '../../../lib/redis.js';
import { getSession, getUser } from '../../../lib/users.js';
import { MIN_CHARGE, ERRORS, calcGptCost, usdToEurCents } from '../../../lib/config.js';
import { trackDailySpend } from '../../../lib/apiAuth.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { normalizzaQuery } from '../../../lib/topics/servizio.js';
// b.631 — via il vecchio giro (creditoFinito + creditoInsufficiente +
// addebitaRiassunto DOPO il fornitore): adesso riserva → commit/release,
// come /api/summary e come le altre sette rotte che pagano.
import { riserva, commit, release } from '../../../wallet/riserva.js';
import { costoRiassunto } from '../../../wallet/consumo.js';

const log = createLogger('topics-riassunto');

const LINGUE = { it: 'italiano', en: 'English', es: 'español', fr: 'français', de: 'Deutsch', pt: 'português', zh: '中文', ja: '日本語', ko: '한국어', th: 'ไทย', ar: 'العربية', hi: 'हिन्दी', ru: 'русский', tr: 'Türkçe', vi: 'Tiếng Việt' };

const TTL_SINTESI = 24 * 3600;

function chiave(titolo, lang) {
  return `topics:sintesi:${lang}:${normalizzaQuery(titolo).slice(0, 100)}`;
}

async function handlePost(req) {
  const { titolo, sintesi, fonti, lang, userToken } = await req.json();
  const lingua = LINGUE[lang] ? lang : 'en';
  if (!titolo || typeof titolo !== 'string') {
    return NextResponse.json({ error: 'titolo mancante' }, { status: 400 });
  }

  // Cache condivisa PRIMA dell'autenticazione: leggere una sintesi gia
  // pagata e gratis per tutti, anche per l'ospite senza account.
  const k = chiave(titolo, lingua);
  try {
    const salvata = await redis('GET', k);
    if (salvata) return NextResponse.json({ sintesi: salvata, daCache: true });
  } catch { /* cache assente: si genera */ }

  // ═══ b.617 — «NON CE L'HO IN CACHE» NON E' «NON SEI AUTORIZZATO» ═══
  // Il lettore dell'articolo BUSSA due volte a questa porta: la prima per
  // chiedere se la sintesi esiste gia (sondaggio, SENZA gettone: la cache
  // e condivisa apposta), la seconda per generarla (col gettone). Alla
  // prima, se la cache era vuota, si rispondeva 401 — e nei registri di
  // produzione, e nel conto degli errori di ogni audit, restava un
  // «non autorizzato» che non e mai stato vero. Dal vivo (collaudo
  // 03/09, «Apri e traduci»): quattro 401 di fila con l'utente collegato.
  // Adesso il sondaggio ha la sua risposta onesta; il 401 resta per chi
  // chiede DI GENERARE con un gettone che non vale.
  if (!userToken) {
    return NextResponse.json({ sintesi: '', daCache: false, serveAccount: true });
  }
  // GENERARE invece costa: serve la sessione, come per /api/summary.
  const session = await getSession(userToken);
  if (!session) {
    return NextResponse.json({ error: ERRORS.INVALID_SESSION }, { status: 401 });
  }
  const billingEmail = session.email;
  let apiKey = process.env.OPENAI_API_KEY;
  let isOwnKey = false;
  const user = await getUser(billingEmail);
  if (user?.useOwnKeys && user.apiKeys?.openai) {
    apiKey = user.apiKeys.openai;
    isOwnKey = true;
  }

  const materiale = [
    `TITOLO: ${String(titolo).slice(0, 200)}`,
    sintesi ? `DESCRIZIONE: ${String(sintesi).slice(0, 500)}` : '',
    ...(Array.isArray(fonti) ? fonti.slice(0, 6).map(f =>
      `FONTE ${String(f.fonte || '').slice(0, 60)}: ${String(f.titolo || '').slice(0, 200)}`) : []),
  ].filter(Boolean).join('\n');

  // b.159 — CONFERMATO (audit b.158, punto 7): stesso buco di
  // /api/summary, stessa correzione — gate prima della chiamata,
  // niente sintesi gratis quando il wallet e a zero.
  //
  // ═══ b.631 — QUEL GATE NON BASTAVA, E LO SAPEVAMO GIA DA b.171 ═══
  // Trovato dal secondo revisore della bonifica, e verificato: qui era
  // rimasto il VECCHIO giro — si leggeva il saldo (creditoFinito +
  // creditoInsufficiente), si chiamava OpenAI, e si addebitava DOPO con
  // addebitaRiassunto, per giunta ignorandone l'esito.
  //
  // Leggere il saldo non lo blocca: due richieste dello stesso utente
  // con un solo secondo di credito passavano ENTRAMBE il controllo,
  // chiamavano ENTRAMBE il fornitore, e una sola pagava. E la stessa
  // finestra di corsa che b.171 aveva chiuso su /api/summary — che fa
  // esattamente questo lavoro, allo stesso prezzo — e che b.161-bis
  // aveva chiuso su transcribe, translate, tts, tts-elevenlabs.
  // Restavano cosi due modi di incassare lo stesso importo: qui il
  // vecchio, li il nuovo.
  //
  // Adesso il costo fisso si blocca SUBITO e atomicamente, prima di
  // chiamare OpenAI: commit dopo il successo, release se qualcosa va
  // storto. Con chiave propria non si riserva niente, come prima.
  let riservaId = null;
  const costoR = costoRiassunto();
  if (billingEmail && !isOwnKey) {
    const r = await riserva(billingEmail, costoR, { tipo: 'riassunto', topic: String(titolo).slice(0, 80) });
    if (!r.ok) {
      return NextResponse.json({ error: 'Credito insufficiente' }, { status: 402 });
    }
    riservaId = r.riservaId;
  }

  const openai = new OpenAI({ apiKey });
  // b.232 — la chiamata al fornitore era senza try/catch: un rate-limit o un
  // timeout risaliva ad apiGuard come 500 (e finiva su Sentry come guasto
  // interno). Ora un fallimento transitorio è un 502 pulito, non un allarme.
  let completion;
  try {
  completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Sei un giornalista. Scrivi una sintesi ORIGINALE di 5-6 righe in ${LINGUE[lingua]} sul fatto descritto dai dati forniti.
REGOLE INVIOLABILI:
- Usa SOLO le informazioni presenti nei dati. Se un dettaglio non c'e, non lo inventi e non lo deduci.
- Niente opinioni, niente aggettivi di colore: fatti.
- Non copiare frasi intere dai titoli: riscrivi con parole tue.
- Output: solo il testo della sintesi, senza titoli, senza premesse.`,
      },
      { role: 'user', content: materiale },
    ],
    temperature: 0.3,
    max_tokens: 400,
  });
  } catch (e) {
    // b.631 — il fornitore non ha consegnato: il credito torna intero.
    // Non e un uso, non si paga.
    if (riservaId) { await release(riservaId, 'fornitore_non_disponibile').catch(() => {}); riservaId = null; }
    log.error('sintesi: fornitore non disponibile:', e);
    return NextResponse.json({ error: 'Servizio non disponibile, riprova tra poco' }, { status: 502 });
  }

  const testo = (completion.choices?.[0]?.message?.content || '').trim();
  if (!testo) {
    // b.631 — sintesi vuota: OpenAI ha risposto ma non ha consegnato
    // niente di leggibile. Nemmeno questo si fa pagare.
    if (riservaId) { await release(riservaId, 'sintesi_vuota').catch(() => {}); riservaId = null; }
    return NextResponse.json({ error: 'sintesi vuota' }, { status: 502 });
  }

  // b.631 — RETE DI SICUREZZA. Da qui al commit non dovrebbe poter
  // fallire niente, ma «non dovrebbe» non basta quando in mezzo c'e una
  // riserva aperta: un conto che esplode o un imprevisto lascerebbero
  // bloccato il credito di chi ha appena letto la sua sintesi. Se
  // succede, il credito torna e la sintesi si consegna lo stesso — il
  // lavoro e stato fatto, e non e colpa sua.
  try {
  // Contabilita DOPO il lavoro riuscito, come da ordine verificato.
  const costEurCents = usdToEurCents(calcGptCost(completion.usage));
  if (billingEmail && !isOwnKey) {
    // b.594 — MODULO 3 (piano qualita): stesso motivo di /api/summary —
    // fuoco-e-dimentica, non piu await, cosi un timeout Redis non
    // allunga la risposta all'utente. trackDailySpend cattura gia i
    // suoi errori (apiAuth.js).
    const charge = Math.max(MIN_CHARGE.SUMMARY, costEurCents);
    trackDailySpend(billingEmail, charge).catch((e) => log.error('tracking sintesi fallito:', e));
  }
  // ── Wallet: conferma la riserva presa prima di OpenAI ──
  // b.631 — costo fisso, quindi commit allo stesso importo riservato:
  // il numero chiesto prima e il numero pagato dopo, sempre. Con chiave
  // propria la riserva non c'era e il wallet non si tocca.
  if (riservaId) {
    await commit(riservaId, costoR, { tipo: 'riassunto' });
    riservaId = null;
  }
  } catch (e) {
    if (riservaId) { await release(riservaId, 'errore_imprevisto').catch(() => {}); riservaId = null; }
    log.error('sintesi: contabilita fallita, credito restituito:', e?.message);
  }

  try { await redis('SET', k, testo, 'EX', TTL_SINTESI); } catch { /* senza cache si vive */ }
  return NextResponse.json({ sintesi: testo, daCache: false });
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'topics-sintesi' });
