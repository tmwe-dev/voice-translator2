// ═══════════════════════════════════════════════════════════════
// /api/mondo/discussioni — le discussioni pubbliche persistenti (Fase 1)
//
// LETTURE (GET) — pubbliche, niente token:
//   ?disc=ID            una discussione + i suoi commenti (e +1 vista)
//   (senza disc)        il feed caldo, filtri &topic= &country= &lang=
//
// SCRITTURE (POST) — servono un account (userToken -> email di sessione):
//   { azione:'crea',     title, titleLang, topic, country, lang, media, roomId }
//   { azione:'commenta', discussionId, text, lang, parentId }
//   { azione:'like',     commentId }
//   { azione:'segui'|'smetti', followedPublicId }
//
// Il PRIVATO non si tocca: questa rotta e solo la piazza pubblica.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { getSession } from '../../../lib/users.js';
import { createLogger } from '../../../lib/logger.js';
import { redis } from '../../../lib/redis.js';
import {
  elencoDiscussioni, getDiscussione, contaVista, commenti,
  creaDiscussione, commenta, mettiMiPiace, segui, smettiSeguire, archiviaInattive,
  profiloPersona,
} from '../../../lib/mondoDB.js';

const log = createLogger('mondo-disc');

// b.187 — RETENTION senza cron esterno: quando si legge il feed, una
// volta all'ora si archiviano le discussioni ferme da oltre 15 giorni
// (restano leggibili, escono dal caldo). Un flag su Redis fa da throttle,
// e il tutto e a prova di errore: la manutenzione non rompe mai la lettura.
async function archiviaThrottled() {
  try {
    const last = await redis('GET', 'mondo:archive:last');
    if (last && Date.now() - Number(last) < 3600_000) return;
    await redis('SET', 'mondo:archive:last', String(Date.now()));
    const n = await archiviaInattive();
    if (n) log.info('discussioni archiviate', { n });
  } catch { /* la manutenzione non deve mai far fallire una lettura */ }
}

async function handleGet(req) {
  const url = new URL(req.url);
  const disc = url.searchParams.get('disc');
  const persona = url.searchParams.get('persona');
  try {
    if (persona) {
      const profilo = await profiloPersona(persona);
      return NextResponse.json({ profilo });
    }
    if (disc) {
      const discussione = await getDiscussione(disc);
      if (!discussione) return NextResponse.json({ error: 'non trovata' }, { status: 404 });
      const lista = await commenti(disc);
      contaVista(disc).catch(() => {}); // vista non bloccante
      return NextResponse.json({ discussione, commenti: lista });
    }
    archiviaThrottled().catch(() => {}); // manutenzione pigra, non bloccante
    const topic = url.searchParams.get('topic') || null;
    const country = url.searchParams.get('country') || null;
    const lang = url.searchParams.get('lang') || null;
    const discussioni = await elencoDiscussioni({ topic, country, lang });
    return NextResponse.json({ discussioni });
  } catch (e) {
    log.error('GET:', e.message);
    return NextResponse.json({ discussioni: [] }, { status: 200 });
  }
}

async function handlePost(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'body non valido' }, { status: 400 }); }
  const { azione, userToken } = body || {};

  // Ogni scrittura richiede un account: l'autore e la sua email di sessione.
  const session = userToken ? await getSession(userToken) : null;
  if (!session?.email) return NextResponse.json({ error: 'serve un account' }, { status: 401 });
  const authorEmail = session.email;
  // b.190 — NICKNAME: in una piazza pubblica non si mostra il nome vero.
  // Il client manda il nickname pubblico scelto dall'utente; se c'e, e
  // quello il nome mostrato. L'email non compare mai (l'autore resta un
  // id opaco), e senza nickname si ripiega sul nome dell'account.
  const nick = (body.nick || '').toString().trim().replace(/[<>]/g, '').slice(0, 40);
  const authorName = nick || session.name || '';

  try {
    switch (azione) {
      case 'crea': {
        // b.232 — come per 'commenta', un titolo vuoto va rifiutato: prima si
        // potevano creare discussioni con titolo '' (mostrate come "—").
        const titoloCrea = (body.title || '').trim();
        if (!titoloCrea) return NextResponse.json({ error: 'titolo mancante' }, { status: 400 });
        const id = await creaDiscussione({
          authorEmail, authorName,
          title: titoloCrea.slice(0, 300),
          titleLang: body.titleLang || null,
          topic: body.topic || null,
          country: body.country || null,
          lang: body.lang || null,
          media: body.media || {},
          roomId: body.roomId || null,
        });
        return NextResponse.json({ id });
      }
      case 'commenta': {
        if (!body.discussionId) return NextResponse.json({ error: 'discussionId mancante' }, { status: 400 });
        const id = await commenta({
          discussionId: body.discussionId, authorEmail, authorName,
          text: body.text || '', lang: body.lang || null, parentId: body.parentId || null,
        });
        return NextResponse.json({ id });
      }
      case 'like': {
        if (!body.commentId) return NextResponse.json({ error: 'commentId mancante' }, { status: 400 });
        await mettiMiPiace({ commentId: body.commentId, email: authorEmail });
        return NextResponse.json({ ok: true });
      }
      case 'segui':
        await segui(authorEmail, body.followedPublicId);
        return NextResponse.json({ ok: true });
      case 'smetti':
        await smettiSeguire(authorEmail, body.followedPublicId);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: 'azione sconosciuta' }, { status: 400 });
    }
  } catch (e) {
    log.error('POST', azione, ':', e.message);
    return NextResponse.json({ error: 'operazione fallita' }, { status: 500 });
  }
}

export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'mondo-disc-get', skipBodyCheck: true });
export const POST = withApiGuard(handlePost, { maxRequests: 20, prefix: 'mondo-disc-post' });
