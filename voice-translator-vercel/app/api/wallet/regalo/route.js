import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { getSession } from '../../../lib/users.js';
import { inviaRegalo, riscattaRegalo } from '../../../wallet/regali.js';
import { formattaDurata } from '../../../wallet/tariffe.js';
// b.363 — questo file non aveva alcun registro: ogni suo guasto usciva
// dalla porta senza lasciare una riga da nessuna parte.
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('walletRegalo');

// ═══════════════════════════════════════════════════════════════
// REGALO MINUTI — il ponte che mancava.
//
// La logica (wallet/regali.js) e il database (tabella gifts + le due
// funzioni SQL) esistevano già da settimane, ma nessuna rotta li
// chiamava: la funzione era scritta e irraggiungibile.
//
// POST { azione: 'invia', minuti, messaggio } → { ok, codice, link }
// POST { azione: 'riscatta', codice }        → { ok, testo }
//
// L'identità arriva SEMPRE dalla sessione (Bearer token), mai dal
// corpo della richiesta: nessuno può regalare i minuti di un altro.
// ═══════════════════════════════════════════════════════════════

const MINUTI_MIN = 1;
const MINUTI_MAX = 600; // 10 ore per regalo: argine agli errori di battitura

async function utenteDellaSessione(req) {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const sessione = await getSession(token);
  return sessione?.email ? sessione.email.toLowerCase() : null;
}

async function handlePost(req) {
  try {
    const utente = await utenteDellaSessione(req);
    if (!utente) return NextResponse.json({ error: 'sessione non valida' }, { status: 401 });

    const corpo = await req.json();
    const azione = corpo?.azione;

    if (azione === 'invia') {
      const minuti = Math.floor(Number(corpo.minuti));
      if (!Number.isFinite(minuti) || minuti < MINUTI_MIN || minuti > MINUTI_MAX) {
        return NextResponse.json({ ok: false, motivo: `Da ${MINUTI_MIN} a ${MINUTI_MAX} minuti` }, { status: 422 });
      }
      const messaggio = String(corpo.messaggio || '').slice(0, 200);
      const esito = await inviaRegalo(utente, minuti * 60, messaggio);
      if (!esito.ok) return NextResponse.json(esito, { status: 422 });

      // Il link porta direttamente all'app con il codice già pronto.
      const origine = req.headers.get('origin') || '';
      return NextResponse.json({
        ok: true,
        codice: esito.codice,
        link: origine ? `${origine}/?regalo=${esito.codice}` : '',
        testo: formattaDurata(minuti * 60),
      });
    }

    if (azione === 'riscatta') {
      const codice = String(corpo.codice || '').trim().toUpperCase();
      if (!codice) return NextResponse.json({ ok: false, motivo: 'Codice mancante' }, { status: 400 });
      const esito = await riscattaRegalo(utente, codice);
      if (!esito.ok) return NextResponse.json(esito, { status: 422 });
      return NextResponse.json({ ok: true, testo: '+' + formattaDurata(esito.secondi) });
    }

    return NextResponse.json({ error: 'azione sconosciuta' }, { status: 400 });
  } catch (e) {
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. Un trasferimento di credito fallito spariva senza lasciare niente.
    log.error('Regalo minuti: errore imprevisto', { err: e?.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'wallet-regalo' });
