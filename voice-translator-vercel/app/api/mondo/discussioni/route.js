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
import { segnala, impostaVisibilita, autoreDi, puoModerareContenuto, tipoValido, SOGLIA_NASCONDI, impronaPerTipo } from '../../../lib/moderazioneMondo.js';

// b.363 — IL MEDIA ARRIVAVA DAL CLIENT E FINIVA IN PIAZZA COSI COM'ERA:
// nessun controllo di protocollo, forma o lunghezza. Poi veniva reso a
// tutti come link e come immagine: bastava un url `javascript:` o `data:`
// per piazzare una trappola in una pagina pubblica. Qui si tiene SOLO
// cio che si riconosce, e solo se e davvero un indirizzo web.
function urlWeb(v, max = 2000) {
  if (typeof v !== 'string' || v.length > max) return null;
  try {
    const u = new URL(v.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch { return null; }
}
function mediaSicuro(grezzo) {
  if (!grezzo || typeof grezzo !== 'object' || Array.isArray(grezzo)) return {};
  const pulito = {};
  const url = urlWeb(grezzo.url);
  if (url) pulito.url = url;
  const thumb = urlWeb(grezzo.thumb);
  if (thumb) pulito.thumb = thumb;
  if (typeof grezzo.source === 'string') pulito.source = grezzo.source.slice(0, 120);
  if (typeof grezzo.tipo === 'string') pulito.tipo = grezzo.tipo.slice(0, 40);
  return pulito;
}

import {
  elencoDiscussioni, getDiscussione, contaVista, commenti, mieiMiPiace, mieiSeguiti,
  creaDiscussione, commenta, mettiMiPiace, segui, smettiSeguire, archiviaInattive,
  profiloPersona, idPubblico,
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
    // b.236 — stessa cura di /api/mondo: un guasto non si traveste da feed
    // vuoto. Il client su !ok mantiene l'ultimo feed valido, non si rompe.
    return NextResponse.json({ error: 'feed non disponibile' }, { status: 503 });
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
  // id opaco).
  // b.236 — il ripiego su session.name e stato TOLTO: era la promessa
  // disattesa di questa stessa premessa. Senza nickname l'autore resta
  // senza nome (il client mostra gia '' senza rompersi), non col nome vero.
  const nick = (body.nick || '').toString().trim().replace(/[<>]/g, '').slice(0, 40);
  const authorName = nick;

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
          media: mediaSicuro(body.media),
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
      // b.363 — COSA HO GIA FATTO QUI: quali cuori ho messo, chi seguo.
      // Prima se lo ricordava solo il telefono: bastava ricaricare la pagina
      // e tutte le etichette ripartivano a zero dicendo il falso (e
      // ritoccando il cuore si contava uno che il database non registrava).
      // Va in POST, non in GET, perche il gettone di sessione non deve MAI
      // finire in un indirizzo: gli indirizzi si scrivono nei registri.
      case 'miei': {
        const idCommenti = Array.isArray(body.commentIds) ? body.commentIds.filter((x) => typeof x === 'string').slice(0, 300) : [];
        const idAutori = Array.isArray(body.authorIds) ? body.authorIds.filter((x) => typeof x === 'string').slice(0, 300) : [];
        const [cuori, seguiti] = await Promise.all([
          mieiMiPiace({ email: authorEmail, commentIds: idCommenti }),
          mieiSeguiti({ email: authorEmail, publicIds: idAutori }),
        ]);
        return NextResponse.json({ ok: true, cuori, seguiti });
      }
      case 'like': {
        if (!body.commentId) return NextResponse.json({ error: 'commentId mancante' }, { status: 400 });
        const esitoLike = await mettiMiPiace({ commentId: body.commentId, email: authorEmail });
        return NextResponse.json({ ok: true, ...esitoLike });
      }
      // b.244 — SEGNALA: chiunque abbia un account, una volta sola per
      // contenuto. A SOGLIA_NASCONDI segnalazioni sparisce da solo.
      case 'segnala': {
        const tipo = body.tipo;
        if (!tipoValido(tipo) || !body.contenuto) return NextResponse.json({ error: 'segnalazione non valida' }, { status: 400 });
        const r = await segnala({ tipo, contenuto: body.contenuto, segnalante: idPubblico(authorEmail), motivo: body.motivo || '' });
        if (!r.ok) return NextResponse.json({ error: 'segnalazione non riuscita' }, { status: 500 });
        return NextResponse.json({ ok: true, segnalazioni: r.segnalazioni, nascosto: r.nascosto, soglia: SOGLIA_NASCONDI });
      }

      // b.244 — MODERA a mano: solo l'amministratore o chi ha aperto la
      // discussione. Nascondere non cancella: si puo sempre riaprire.
      case 'modera': {
        const tipo = body.tipo;
        if (!tipoValido(tipo) || !body.contenuto) return NextResponse.json({ error: 'richiesta non valida' }, { status: 400 });
        const idAutore = await autoreDi({ tipo, contenuto: body.contenuto });
        const permesso = puoModerareContenuto({
          // b.363 — l'impronta giusta per il tipo (i corsi ne usano un'altra)
          idUtente: impronaPerTipo(tipo, authorEmail),
          idAutore,
          emailUtente: authorEmail,
          emailAdmin: process.env.ADMIN_EMAIL,
        });
        if (!permesso) return NextResponse.json({ error: 'Solo chi ha aperto la discussione, o l\'amministratore' }, { status: 403 });
        const fatto = await impostaVisibilita({ tipo, contenuto: body.contenuto, nascondi: body.nascondi !== false });
        return NextResponse.json({ ok: fatto, nascosto: body.nascondi !== false });
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
