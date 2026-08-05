import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { sanitizeRoomId } from '../../lib/validate.js';
import { verifyRoomSession } from '../../lib/store.js';
import { createLogger } from '../../lib/logger.js';
import { leggiRegole } from '../../lib/moderazione.js';
import {
  reagisci, leggiConte, leggiMie, contaRisposte, salvaMessaggio, storico, TIPI,
} from '../../lib/reazioni.js';

const log = createLogger('reazioni');

// ═══════════════════════════════════════════════════════════════
// /api/reazioni
//
// Reagire si puo SEMPRE, anche nelle chat cifrate: una reazione e un
// contatore appeso a un identificativo, il server non vede il testo.
//
// Conservare i messaggi NO: vale solo per le stanze Community, dove la
// regola e scritta ed e diversa da quella delle chat private.
// ═══════════════════════════════════════════════════════════════

async function chiSei(token, roomId) {
  if (!token) return null;
  const s = await verifyRoomSession(token);
  if (!s) return null;
  if (s.roomId && roomId && s.roomId.toUpperCase() !== roomId.toUpperCase()) return null;
  return s;
}

// Una stanza e "Community" se e stata pubblicata in vetrina: e li che si
// e accettato di rinunciare alla cifratura in cambio dello storico.
// Le regole esistono solo per le stanze passate da /api/mondo. Una chat
// privata non ne ha, e quindi non conserva niente: e il discrimine.
async function eCommunity(roomId) {
  const regole = await leggiRegole(roomId);
  return !!regole?.hostNome;
}

async function handlePost(req) {
  try {
    const corpo = await req.json();
    const azione = typeof corpo.azione === 'string' ? corpo.azione : '';
    const roomId = sanitizeRoomId(corpo.roomId || '');
    const token = typeof corpo.roomSessionToken === 'string' ? corpo.roomSessionToken : '';
    const msgId = typeof corpo.msgId === 'string' ? corpo.msgId.slice(0, 64) : '';

    if (!roomId) return NextResponse.json({ error: 'roomId richiesto' }, { status: 400 });

    switch (azione) {

      // ── Un pollice, un cuore. Serve essere nella stanza. ──
      case 'reagisci': {
        const io = await chiSei(token, roomId);
        if (!io) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
        if (!msgId) return NextResponse.json({ error: 'msgId richiesto' }, { status: 400 });
        if (!TIPI.includes(corpo.tipo)) {
          return NextResponse.json({ error: 'Reazione sconosciuta' }, { status: 400 });
        }
        const esito = await reagisci(roomId, msgId, corpo.tipo, io.name);
        if (!esito) return NextResponse.json({ error: 'Non riuscita' }, { status: 400 });
        return NextResponse.json({ ok: true, ...esito });
      }

      // ── I conteggi di piu messaggi in un colpo solo. ──
      case 'leggi': {
        const io = await chiSei(token, roomId);
        const elenco = Array.isArray(corpo.msgIds) ? corpo.msgIds.slice(0, 60) : [];
        const conte = {};
        const mie = {};
        await Promise.all(elenco.map(async id => {
          const pulito = String(id).slice(0, 64);
          conte[pulito] = await leggiConte(roomId, pulito);
          conte[pulito].risposte = await contaRisposte(roomId, pulito);
          if (io) mie[pulito] = await leggiMie(roomId, pulito, io.name);
        }));
        return NextResponse.json({ ok: true, conte, mie });
      }

      // ── Conservare un messaggio: SOLO nelle stanze Community. ──
      case 'salva': {
        const io = await chiSei(token, roomId);
        if (!io) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
        if (!await eCommunity(roomId)) {
          // Non e un errore da nascondere: e la promessa di riservatezza
          // delle chat private, e va rispettata in silenzio.
          return NextResponse.json({ ok: true, conservato: false, motivo: 'chat privata' });
        }
        await salvaMessaggio(roomId, {
          id: msgId,
          nome: io.name,
          testo: corpo.testo,
          lang: corpo.lang,
          rispostaA: corpo.rispostaA,
        });
        return NextResponse.json({ ok: true, conservato: true });
      }

      // ── Cosa vede chi entra adesso. ──
      case 'storico': {
        if (!await eCommunity(roomId)) {
          return NextResponse.json({ ok: true, recenti: [], rilevanti: [], conservazione: false });
        }
        const d = await storico(roomId);
        return NextResponse.json({ ok: true, ...d, conservazione: true });
      }

      default:
        return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
    }
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 120, prefix: 'reazioni' });
