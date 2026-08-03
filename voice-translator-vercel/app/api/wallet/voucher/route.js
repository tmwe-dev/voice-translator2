import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { getSession } from '../../../lib/users.js';
import { riscattaVoucher } from '../../../wallet/voucher.js';
import { formattaDurata } from '../../../wallet/tariffe.js';

// POST { codice } → { ok, testo } oppure { ok: false, motivo }
// Il voucher va all'utente della SESSIONE (Bearer token).
async function handlePost(req) {
  try {
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'token mancante' }, { status: 401 });
    const sessione = await getSession(token);
    if (!sessione?.email) return NextResponse.json({ error: 'sessione non valida' }, { status: 401 });

    const { codice } = await req.json();
    if (!codice) return NextResponse.json({ error: 'codice mancante' }, { status: 400 });

    const esito = await riscattaVoucher(sessione.email.toLowerCase(), codice);
    if (!esito.ok) return NextResponse.json(esito, { status: 422 });
    return NextResponse.json({ ok: true, testo: '+' + formattaDurata(esito.secondi) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'wallet-voucher' });
