import { NextResponse } from 'next/server';
import { redis } from '../../lib/redis.js';
import { getClientIP } from '../../lib/validate.js';
import { createLogger } from '../../lib/logger.js';
import { withApiGuard } from '../../lib/apiGuard.js';
import { normalizzaTipoStanza, vaInVetrina, richiedeApprovazione, normalizzaCapienza, puoModerare } from '../../lib/decisioni.js';
import { verifyRoomSession, getRoom } from '../../lib/store.js';
import { leggiRegole } from '../../lib/moderazione.js';

const log = createLogger('mondo');

const MONDO_KEY = 'mondo:rooms';
const MONDO_TTL = 3600; // 1 hour

// b.139-bis — l'elenco dei tipi stava qui E in CreateRoomSheet.js, e le
// due copie non si conoscevano. Ora sta in decisioni.js: vedi TIPI_STANZA.

/**
 * GET /api/mondo — List public rooms
 * Returns: { rooms: [{ roomId, host, description, mode, lang, members, createdAt }] }
 */
async function handleGet(req) {
  try {
    // b.118 — il limite di frequenza scritto a mano e stato tolto: ora
    // lo mette la guardia comune (in fondo al file). Tenerne due
    // significa contare due volte la stessa richiesta, e ritrovarsi con
    // meta del limite dichiarato — un difetto che avevamo gia corretto
    // altrove e che si era ricreato qui.

    const raw = await redis('LRANGE', MONDO_KEY, 0, 29); // Max 30 rooms
    const rooms = (raw || []).map(s => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);

    // Filter out expired rooms (older than 1 hour)
    const now = Date.now();
    const active = rooms.filter(r => (now - r.createdAt) < MONDO_TTL * 1000);

    return NextResponse.json({ rooms: active });
  } catch (e) {
    log.error('GET error:', e);
    return NextResponse.json({ rooms: [] });
  }
}

/**
 * POST /api/mondo — Publish a room as public
 * Body: { roomId, host, description, mode, lang, members }
 */
async function handlePost(req) {
  try {
    // b.118 — il limite di frequenza scritto a mano e stato tolto: ora
    // lo mette la guardia comune (in fondo al file). Tenerne due
    // significa contare due volte la stessa richiesta, e ritrovarsi con
    // meta del limite dichiarato — un difetto che avevamo gia corretto
    // altrove e che si era ricreato qui.

    const {
      roomId, host, nome, description, mode, lang, members,
      roomType, categoria, maxPartecipanti, hostLang,
      roomSessionToken, userToken, hot,
    } = await req.json();
    if (!roomId || !host) return NextResponse.json({ error: 'roomId and host required' }, { status: 400 });

    // b.166 — CONFERMATO (caccia al tesoro): qui si controllava solo che
    // UN token qualsiasi fosse presente (anche una stringa inventata,
    // vuota fa eccezione ma non validata) — mai che risolvesse a
    // un'identita vera, ne che quell'identita fosse davvero l'host di
    // roomId. Con un roomId reale (indovinabile: e il codice condiviso
    // per entrare) chiunque poteva pubblicare la stanza in vetrina con
    // host/description a piacere, E — piu grave — riscrivere le regole
    // di moderazione (hot, suApprovazione, maxPartecipanti) di una
    // stanza altrui tramite la funzione che sincronizza la politica
    // pubblica sulla stanza, piu sotto. Stesso schema gia usato in
    // /api/moderazione (soloHost): serve un
    // roomSessionToken valido, per QUESTA stanza, la cui identita
    // puoModerare() riconosce come host.
    const stanzaEsistente = await getRoom(roomId);
    if (!stanzaEsistente) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const io = await verifyRoomSession(roomSessionToken);
    if (!io || !roomId || io.roomId?.toUpperCase() !== roomId.toUpperCase()) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }
    const regoleEsistenti = await leggiRegole(roomId);
    if (!puoModerare({ identita: io, stanza: stanzaEsistente, regole: regoleEsistenti })) {
      return NextResponse.json({ error: 'Solo chi ospita puo pubblicare questa stanza' }, { status: 403 });
    }

    // Il nome e obbligatorio: nell'elenco e la prima cosa che si legge.
    const nomePulito = (nome || '').trim().slice(0, 60);
    if (nomePulito.length < 3) {
      return NextResponse.json({ error: 'Serve un nome di almeno tre lettere' }, { status: 400 });
    }

    // Una stanza privata si raggiunge solo con l'invito: non va in vetrina.
    // Il predicato e quello di decisioni.js, lo stesso che consulta page.js
    // prima di chiamare: la porta e qui, ma la regola e una sola.
    const tipo = normalizzaTipoStanza(roomType);
    if (!vaInVetrina(tipo)) {
      return NextResponse.json({ ok: true, pubblicata: false, motivo: 'stanza privata' });
    }

    const entry = {
      roomId,
      host,
      nome: nomePulito,
      description: (description || '').slice(0, 100),
      mode: mode || 'conversation',
      categoria: categoria || mode || 'conversation',
      lang: lang || 'en',
      // La lingua dell'host regge la bandiera nell'elenco; se manca, quella
      // della stanza e comunque piu informativa di niente.
      hostLang: hostLang || lang || 'en',
      roomType: tipo,
      // 'protected' = si bussa e l'host apre. L'elenco lo deve dire prima
      // che uno tocchi, altrimenti sembra che la stanza non risponda.
      suApprovazione: richiedeApprovazione(tipo),
      // b.111 — stanza a litigio libero. Nell'elenco si DEVE vedere
      // prima di entrare: e il motivo per cui uno sceglie di entrarci,
      // o di stare alla larga.
      hot: !!hot,
      maxPartecipanti: normalizzaCapienza(maxPartecipanti),
      memberCount: members?.length || 1,
      createdAt: Date.now(),
    };

    // Remove existing entry for this room (prevent duplicates)
    const existing = await redis('LRANGE', MONDO_KEY, 0, -1);
    if (existing) {
      for (const raw of existing) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.roomId === roomId) {
            await redis('LREM', MONDO_KEY, 1, raw);
          }
        } catch (e) { log.warn('JSON parse error:', e?.message); }
      }
    }

    // Le regole vivono accanto alla stanza, non solo nella vetrina: le legge
    // handleJoin per decidere se aprire, e la vetrina puo scomparire prima.
    try {
      const { salvaRegole } = await import('../../lib/moderazione.js');
      await salvaRegole(roomId, { suApprovazione: entry.suApprovazione, hostNome: host, hot: entry.hot });
    } catch (e) {
      log.warn('regole non salvate:', e?.message);
    }

    // ── b.125 · e anche SULLA STANZA, che e cio che la chat legge ──
    //
    // La casella "litigio libero" finiva qui nella vetrina e nelle
    // regole di moderazione, ma non sulla stanza. E MessageList decide
    // se velare le parole pesanti leggendo `roomInfo.hot`, dove
    // `roomInfo` E la stanza: leggeva sempre `undefined`.
    //
    // Quindi la casella si poteva spuntare, il campo si salvava in due
    // posti, la vetrina mostrava il contrassegno — e dentro la stanza
    // non cambiava niente. Tre sistemi che descrivono la stessa cosa e
    // quello che l'utente guarda non parla con quello che ha scelto.
    try {
      const { aggiornaPoliticaPubblica } = await import('../../lib/store.js');
      await aggiornaPoliticaPubblica(roomId, {
        hot: entry.hot,
        roomType: entry.roomType,
        maxPartecipanti: entry.maxPartecipanti,
        suApprovazione: entry.suApprovazione,
      });
    } catch (e) {
      // Non blocca la pubblicazione: la stanza esiste comunque e resta
      // usabile, solo con la politica predefinita. Ma va detto, perche
      // e esattamente il disallineamento che stiamo togliendo.
      log.warn('politica pubblica non applicata alla stanza:', e?.message);
    }

    // Add to front
    await redis('LPUSH', MONDO_KEY, JSON.stringify(entry));
    await redis('LTRIM', MONDO_KEY, 0, 29); // Keep max 30
    await redis('EXPIRE', MONDO_KEY, MONDO_TTL);

    return NextResponse.json({ ok: true });
  } catch (e) {
    log.error('POST error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── b.118 · anche questa passa dalla guardia comune ──
// La caccia al tesoro l'ha trovata scoperta: rispondeva 500 a un corpo
// malformato, e non aveva il limite di frequenza condiviso. Aveva un
// limite suo, scritto a mano — che e proprio il modo in cui una rotta
// si dimentica per strada le protezioni aggiunte a tutte le altre.
export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'mondo' });
export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'mondo', skipBodyCheck: true });
