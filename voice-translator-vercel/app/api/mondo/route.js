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

    let raw;
    try {
      raw = await redis('LRANGE', MONDO_KEY, 0, 29); // Max 30 rooms
    } catch (e) {
      // b.297 — TROVATO IN PRODUZIONE: la vetrina rispondeva 503 a ogni
      // richiesta mentre il resto di Redis funzionava (le stanze si
      // creavano). Il colpevole tipico e la chiave col TIPO sbagliato
      // (WRONGTYPE): qualcosa ha scritto mondo:rooms come valore
      // semplice, e da allora ogni lettura della lista esplode — vetrina
      // morta PER SEMPRE finche qualcuno non pulisce a mano. Ora, se il
      // tipo e sbagliato, la chiave corrotta si butta e la piazza
      // riparte vuota ma VIVA: pubblicabile di nuovo, non piu rotta.
      if (/WRONGTYPE/i.test(String(e?.message || e))) {
        log.error('mondo:rooms aveva il tipo sbagliato: chiave corrotta eliminata, piazza ripartita vuota');
        await redis('DEL', MONDO_KEY);
        raw = [];
      } else throw e;
    }
    const rooms = (raw || []).map(s => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);

    // Filter out expired rooms (older than 1 hour)
    const now = Date.now();
    const active = rooms.filter(r => (now - r.createdAt) < MONDO_TTL * 1000);

    // b.397 — QUANTE PERSONE CI SONO DAVVERO, NON QUANTE CE N'ERANO ALLA
    // NASCITA. Questa voce e una fotografia scattata quando la stanza e
    // stata pubblicata, e il numero dentro nasceva sempre 1 — chi
    // pubblica e solo, e nessuno lo ha mai riscritto dopo. Cosi ogni
    // stanza diceva «1 dentro» per tutta la sua ora di vita, e sommando
    // per Paese si otteneva il numero delle STANZE travestito da numero
    // di persone. Il documento di Luca su questo e netto: mai mostrare un
    // numero che non e vero.
    //
    // La verita e a due passi: la stanza vera vive in `room:{codice}` e
    // porta l'elenco dei presenti, gia potato da chi non da segno di
    // vita. Si legge in un colpo solo per tutte, e se la lettura non
    // riesce si tiene la fotografia invece di far sparire il numero.
    const chiavi = active.map(r => `room:${String(r.roomId || '').toUpperCase()}`).filter(k => k !== 'room:');
    if (chiavi.length) {
      try {
        const vive = await redis('MGET', ...chiavi);
        if (Array.isArray(vive)) {
          for (let i = 0; i < active.length; i++) {
            const grezzo = vive[i];
            if (!grezzo) { active[i].chiusa = true; continue; }
            try {
              const stanza = JSON.parse(grezzo);
              if (Array.isArray(stanza.members)) active[i].memberCount = stanza.members.length;
            } catch { /* una voce illeggibile non deve rovinare le altre: resta la fotografia */ }
          }
        }
      } catch (e) {
        // La vetrina si vede lo stesso, coi numeri della nascita: e meglio
        // di una piazza vuota. Ma si registra, perche un numero vecchio
        // che sembra nuovo e proprio la cosa da non lasciar passare zitti.
        log.warn('conteggio vivo non riuscito, restano i numeri della nascita', { errore: e?.message || 'ignoto' });
      }
    }
    // ═══ b.537 — DI COSA SI PARLA ADESSO ═══
    // Ragionamento con Luca sulla logica di Stanze: «la card ti dice
    // tutto tranne la cosa che conta». Vero: diceva lingua, modalita,
    // eta, host, numero — sette informazioni per una decisione sola, e
    // NESSUNA era il motivo per cui un essere umano entra in una stanza,
    // che e sapere di che si sta parlando.
    // La risposta era gia in casa: i messaggi vivono in `msgs:{codice}`
    // e portano con se le traduzioni. Si prende l'ULTIMO di ogni stanza
    // in un colpo solo (una LINDEX per stanza, in parallelo), e si manda
    // fuori il testo: chi guarda lo legge nella sua lingua se la
    // traduzione c'e gia, altrimenti nell'originale — senza chiedere
    // niente a nessun modello e senza spendere un centesimo.
    // Se la lettura non riesce, la stanza esce senza argomento: si vede
    // il nome, come prima. Mai un errore in faccia per un di piu.
    const daMostrare = active.filter(r => !r.chiusa);
    try {
      const ultimi = await Promise.all(daMostrare.map((r) =>
        redis('LINDEX', `msgs:${String(r.roomId || '').toUpperCase()}`, -1)
          .catch(() => null)));
      for (let i = 0; i < daMostrare.length; i++) {
        if (!ultimi[i]) continue;
        try {
          const m = JSON.parse(ultimi[i]);
          const testo = String(m.original || '').trim();
          if (!testo) continue;
          daMostrare[i].ultimo = {
            testo: testo.slice(0, 160),
            // le traduzioni gia fatte viaggiano com'erano: il client
            // sceglie la sua lingua senza chiedere niente al server.
            traduzioni: m.translations && typeof m.translations === 'object' ? m.translations : null,
            lingua: m.sourceLang || m.lang || '',
            chi: String(m.sender || '').slice(0, 40),
            quando: m.timestamp || 0,
          };
        } catch { /* un messaggio illeggibile non toglie la stanza dall'elenco */ }
      }
    } catch (e) {
      log.warn('argomento vivo non letto: le stanze escono col solo nome', { errore: e?.message || 'ignoto' });
    }

    return NextResponse.json({ rooms: daMostrare });
  } catch (e) {
    log.error('GET error:', e);
    // b.236 — prima un guasto Redis diventava 200 + rooms:[]: piazza vuota e
    // piazza ROTTA erano indistinguibili, per il client e per il monitoraggio.
    // Il client ha gia il suo ramo d'errore per !res.ok (b.232): lo si usa.
    return NextResponse.json({ error: 'vetrina non disponibile' }, { status: 503 });
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
      roomSessionToken, userToken, hot, paese,
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
      // b.397 — IL LUOGO, quando chi apre la stanza ce l'ha. Due lettere,
      // maiuscole, o niente: non si accetta altro e non si inventa nulla.
      // Le stanze nate prima di oggi non ce l'hanno, ed e giusto cosi —
      // chi legge sa distinguere «non lo so» da un posto sbagliato.
      paese: /^[A-Za-z]{2}$/.test(String(paese || '')) ? String(paese).toUpperCase() : '',
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
