import { NextResponse } from 'next/server';
import { creaCheckout } from '../../../wallet/stripe.js';
import { APP_URL } from '../../../lib/constants.js';

// POST { utente, pacchetto } → { url } della pagina di pagamento Stripe.
export async function POST(req) {
  try {
    const { utente, pacchetto } = await req.json();
    if (!utente || !pacchetto) return NextResponse.json({ error: 'dati mancanti' }, { status: 400 });

    const url = await creaCheckout(utente, pacchetto, APP_URL);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
