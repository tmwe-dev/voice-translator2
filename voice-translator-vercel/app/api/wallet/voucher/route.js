import { NextResponse } from 'next/server';
import { riscattaVoucher } from '../../../wallet/voucher.js';
import { formattaDurata } from '../../../wallet/tariffe.js';

// POST { utente, codice } → { ok, testo } oppure { ok: false, motivo }
export async function POST(req) {
  try {
    const { utente, codice } = await req.json();
    if (!utente || !codice) return NextResponse.json({ error: 'dati mancanti' }, { status: 400 });

    const esito = await riscattaVoucher(utente, codice);
    if (!esito.ok) return NextResponse.json(esito, { status: 422 });
    return NextResponse.json({ ok: true, testo: '+' + formattaDurata(esito.secondi) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
