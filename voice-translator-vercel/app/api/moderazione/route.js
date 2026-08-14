import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { sanitizeRoomId, sanitizeName } from '../../lib/validate.js';
import { verifyRoomSession } from '../../lib/store.js';
import { createLogger } from '../../lib/logger.js';
import {
  blocca, sblocca, elencoBloccati,
  richiediIngresso, richiesteInAttesa, decidi, statoIngresso,
  segnala, contaSegnalazioni, leggiRegole,
} from '../../lib/moderazione.js';
import { puoModerare } from '../../lib/decisioni.js';
import { getRoom } from '../../lib/store.js';

const log = createLogger('moderazione');

// ═══════════════════════════════════════════════════════════════
// /api/moderazione — chi entra, chi esce, chi si comporta male
//
// REGOLA DI FONDO: le azioni che pesano su un altro (ammettere, rifiutare,
// bloccare) le puo fare SOLO l'host, e solo dimostrando di esserlo con il
// token di sessione della stanza. Il nome scritto nel corpo della richiesta
// non vale niente: chiunque potrebbe scriverci "Luca".
// ═══════════════════════════════════════════════════════════════

async function chiSei(roomSessionToken, roomId) {
  if (!roomSessionToken) return null;
  const sessione = await verifyRoomSession(roomSessionToken);
  if (!sessione) return null;
  // createRoomSession salva roomId in maiuscolo: confronto senza distinzione.
  if (sessione.roomId && roomId
    && sessione.roomId.toUpperCase() !== roomId.toUpperCase()) return null;
  return sessione;
}

async function soloHost(roomSessionToken, roomId) {
  const io = await chiSei(roomSessionToken, roomId);
  if (!io) return { errore: NextResponse.json({ error: 'Sessione non valida' }, { status: 401 }) };
  // b.139 — qui la somma delle due regole era scritta a mano
  // (`io.role === 'host' || await eHost(...)`), ed era l'unico punto in cui
  // le due mezze verita si tenevano su a vicenda: `eHost()` da solo non
  // riconosce l'host di una stanza non pubblicata in vetrina, e il ruolo da
  // solo non riconosce chi ospita una stanza di vetrina entrandoci di nuovo.
  // Ora la somma sta in `puoModerare()`, e la fa anche chi non se ne ricorda.
  const [regole, stanza] = await Promise.all([leggiRegole(roomId), getRoom(roomId)]);
  if (!puoModerare({ identita: io, stanza, regole })) {
    return { errore: NextResponse.json({ error: 'Solo chi ospita puo farlo' }, { status: 403 }) };
  }
  return { io };
}

async function handlePost(req) {
  try {
    const corpo = await req.json();
    const azione = typeof corpo.azione === 'string' ? corpo.azione : '';
    const roomId = sanitizeRoomId(corpo.roomId || '');
    const nome = sanitizeName(corpo.nome || '');
    const token = typeof corpo.roomSessionToken === 'string' ? corpo.roomSessionToken : '';

    if (!roomId) return NextResponse.json({ error: 'roomId richiesto' }, { status: 400 });

    switch (azione) {

      // ── Chi arriva bussa. Non serve essere nessuno per bussare. ──
      case 'bussa': {
        if (!nome) return NextResponse.json({ error: 'nome richiesto' }, { status: 400 });
        const stato = await richiediIngresso(roomId, nome);
        return NextResponse.json({ ok: true, stato });
      }

      // ── E poi controlla se gli hanno aperto. ──
      case 'stato': {
        if (!nome) return NextResponse.json({ error: 'nome richiesto' }, { status: 400 });
        const [stato, regole] = await Promise.all([
          statoIngresso(roomId, nome),
          leggiRegole(roomId),
        ]);
        return NextResponse.json({ ok: true, stato, suApprovazione: regole.suApprovazione });
      }

      // ── Da qui in giu: solo l'host. ──

      case 'richieste': {
        const { errore } = await soloHost(token, roomId);
        if (errore) return errore;
        const [inAttesa, bloccati] = await Promise.all([
          richiesteInAttesa(roomId),
          elencoBloccati(roomId),
        ]);
        return NextResponse.json({ ok: true, inAttesa, bloccati });
      }

      case 'ammetti':
      case 'rifiuta': {
        const { errore } = await soloHost(token, roomId);
        if (errore) return errore;
        if (!nome) return NextResponse.json({ error: 'nome richiesto' }, { status: 400 });
        await decidi(roomId, nome, azione === 'ammetti');
        return NextResponse.json({ ok: true, stato: azione === 'ammetti' ? 'ammesso' : 'rifiutato' });
      }

      case 'blocca': {
        const { io, errore } = await soloHost(token, roomId);
        if (errore) return errore;
        if (!nome) return NextResponse.json({ error: 'nome richiesto' }, { status: 400 });
        // Bloccare se stessi chiuderebbe la stanza a chi la ospita.
        if (io.name && io.name.toLowerCase() === nome.toLowerCase()) {
          return NextResponse.json({ error: 'Non puoi bloccare te stesso' }, { status: 400 });
        }
        await blocca(roomId, nome);
        return NextResponse.json({ ok: true, bloccati: await elencoBloccati(roomId) });
      }

      case 'sblocca': {
        const { errore } = await soloHost(token, roomId);
        if (errore) return errore;
        if (!nome) return NextResponse.json({ error: 'nome richiesto' }, { status: 400 });
        await sblocca(roomId, nome);
        return NextResponse.json({ ok: true, bloccati: await elencoBloccati(roomId) });
      }

      // ── Segnalare puo chiunque sia DENTRO la stanza, non il mondo. ──
      case 'segnala': {
        const io = await chiSei(token, roomId);
        if (!io) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
        if (!nome) return NextResponse.json({ error: 'nome richiesto' }, { status: 400 });
        const esito = await segnala(nome, io.name);
        if (!esito.ok) return NextResponse.json({ ok: false, motivo: esito.motivo });
        return NextResponse.json({ ok: true, totale: esito.totale });
      }

      case 'reputazione': {
        const { errore } = await soloHost(token, roomId);
        if (errore) return errore;
        if (!nome) return NextResponse.json({ error: 'nome richiesto' }, { status: 400 });
        return NextResponse.json({ ok: true, segnalazioni: await contaSegnalazioni(nome) });
      }

      default:
        return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
    }
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'moderazione' });
