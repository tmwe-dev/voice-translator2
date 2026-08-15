import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { sanitizeRoomId } from '../../lib/validate.js';
import { verifyRoomSession, getRoom, eAncoraMembroStanza } from '../../lib/store.js';
import { createLogger } from '../../lib/logger.js';
import { leggiRegole } from '../../lib/moderazione.js';
import {
  reagisci, leggiConte, leggiMie, contaRisposte, salvaMessaggio, storico, TIPI,
} from '../../lib/reazioni.js';
import { assertElaborazioneConsentita, DirectModeError } from '../../lib/sessionGuard.js';
import { siConservanoIMessaggi } from '../../lib/decisioni.js';

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
  // b.170 — vedi stanza-video e resolveRoomIdentity in store.js: un
  // gettone valido non basta, serve essere ancora membro (non espulso).
  if (!(await eAncoraMembroStanza(roomId, s.name))) return null;
  return s;
}

// ── b.139 · QUI STAVA LA SECONDA COPIA DELLA REGOLA, E DAVA UN'ALTRA
//            RISPOSTA ──
//
// C'era una `eCommunity(roomId)` che guardava soltanto se la stanza fosse
// pubblicata in vetrina, e NON guardava `diretta` per niente. Quindi:
//
//   stanza Diretta + tipo "Pubblico" (che e il valore predefinito nel
//   modulo di creazione, e page.js pubblica in vetrina tutto cio che non
//   e privato)
//     → il client dice: non si conserva, /api/reazioni e vietata
//     → questo file diceva: si conserva, e una stanza Community
//
// Due risposte opposte alla stessa domanda, sullo stesso caso, sulla cosa
// piu delicata che questo programma promette. A tenerle d'accordo era
// solo l'intestazione `x-session-mode`, che manda il client: la promessa
// di riservatezza poggiava sul buon comportamento di chi la richiede.
//
// Ora la domanda si fa una volta sola, a `siConservanoIMessaggi`, e le si
// danno i due dati del SERVER: le regole della stanza e la stanza.
async function siConserva(roomId) {
  const [regole, stanza] = await Promise.all([leggiRegole(roomId), getRoom(roomId)]);
  return siConservanoIMessaggi({ regole, stanza });
}

async function handlePost(req) {
  // b.111 — la guardia mancava proprio qui. Vedi lib/modalitaSessione.js:
  // l'intestazione che la fa scattare non la mandava nessuno, quindi
  // anche dove c'era non e mai servita. Ora arriva davvero.
  // b.139 — la guardia leggeva SOLO l'intestazione, cioe si fidava del
  // client. Ora, appena si sa di che stanza si parla, si chiede alla
  // stanza. Il corpo va letto prima per avere il roomId: si legge una
  // volta sola e si passa avanti.
  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corpo non valido' }, { status: 400 });
  }

  try {
    await assertElaborazioneConsentita(req, {
      roomId: sanitizeRoomId(corpo?.roomId || ''),
      roomSessionToken: typeof corpo?.roomSessionToken === 'string' ? corpo.roomSessionToken : '',
    });
  } catch (e) {
    if (e instanceof DirectModeError) {
      return NextResponse.json({ error: e.message, direct: true }, { status: 403 });
    }
    throw e;
  }

  try {
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
        if (!await siConserva(roomId)) {
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
        if (!await siConserva(roomId)) {
          return NextResponse.json({ ok: true, recenti: [], rilevanti: [], conservazione: false });
        }
        const d = await storico(roomId);
        return NextResponse.json({ ok: true, ...d, conservazione: true });
      }

      default:
        return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
    }
  } catch (e) {
    // b.166 — CONFERMATO (caccia al tesoro): quando il circuit breaker su
    // Redis e aperto, i comandi hash usati qui (HINCRBY/HGETALL/DEL) non
    // hanno un fallback fail-open in redis.js (a differenza di GET/SET/
    // INCR/EXPIRE/TTL) e l'errore strutturato (err.code='CIRCUIT_OPEN',
    // err.retryAfterSec) arrivava fin qui per essere buttato via in un
    // generico 500 "Internal error" — reazione persa, nessun segnale al
    // client che dovrebbe riprovare a breve. Ora si distingue: 503 +
    // Retry-After, cosi il client sa che non e un bug ma un "riprova fra
    // poco". (L'estensione del fallback fail-open ad altri comandi Redis
    // e una decisione architetturale piu ampia, non fatta qui — vedi
    // riepilogo caccia al tesoro.)
    if (e?.code === 'CIRCUIT_OPEN') {
      const retryAfter = Math.max(1, e.retryAfterSec || 30);
      return NextResponse.json(
        { error: 'Servizio reazioni temporaneamente non disponibile, riprova a breve', retryAfterSec: retryAfter },
        { status: 503, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 120, prefix: 'reazioni' });
