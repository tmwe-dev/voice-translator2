import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { getSession } from '../../../lib/users.js';
import { riscattaVoucher } from '../../../wallet/voucher.js';
import { formattaDurata } from '../../../wallet/tariffe.js';
// b.363 — questo file non aveva alcun registro: ogni suo guasto usciva
// dalla porta senza lasciare una riga da nessuna parte.
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('walletVoucher');

// POST { codice } → { ok, testo } oppure { ok: false, motivo }
// Il voucher va all'utente della SESSIONE (Bearer token).
async function handlePost(req) {
  try {
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'token mancante' }, { status: 401 });
    const sessione = await getSession(token);
    if (!sessione?.email) return NextResponse.json({ error: 'sessione non valida' }, { status: 401 });

    // b.363 — il codice del voucher andava dritto nella ricerca sul
    // database senza alcun controllo: non si guardava se fosse una parola
    // ne quanto fosse lungo. Un codice voucher e fatto di lettere, cifre e
    // trattini e non supera i sessanta caratteri: tutto il resto e
    // qualcuno che sta provando qualcos'altro.
    const corpo = await req.json();
    const codice = corpo?.codice;
    if (!codice || typeof codice !== 'string' || codice.length > 60 || !/^[A-Za-z0-9_-]+$/.test(codice)) {
      return NextResponse.json({ error: 'codice mancante' }, { status: 400 });
    }

    const esito = await riscattaVoucher(sessione.email.toLowerCase(), codice);
    if (!esito.ok) return NextResponse.json(esito, { status: 422 });
    return NextResponse.json({ ok: true, testo: '+' + formattaDurata(esito.secondi) });
  } catch (e) {
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. Un voucher che non si riscatta e credito che l'utente non riceve.
    log.error('Riscatto voucher non riuscito', { err: e?.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'wallet-voucher' });
