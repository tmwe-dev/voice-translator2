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
import { addebitaRiassunto } from '../../../wallet/addebita.js';

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

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
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

  const testo = (completion.choices?.[0]?.message?.content || '').trim();
  if (!testo) return NextResponse.json({ error: 'sintesi vuota' }, { status: 502 });

  // Contabilita DOPO il lavoro riuscito, come da ordine verificato.
  const costEurCents = usdToEurCents(calcGptCost(completion.usage));
  if (billingEmail && !isOwnKey) {
    try {
      const charge = Math.max(MIN_CHARGE.SUMMARY, costEurCents);
      await trackDailySpend(billingEmail, charge);
    } catch (e) { log.error('tracking sintesi fallito:', e); }
  }
  // ── Wallet: addebito vero, stesso conto fisso di /api/summary ──
  await addebitaRiassunto(isOwnKey ? null : billingEmail);

  try { await redis('SET', k, testo, 'EX', TTL_SINTESI); } catch { /* senza cache si vive */ }
  return NextResponse.json({ sintesi: testo, daCache: false });
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'topics-sintesi' });
