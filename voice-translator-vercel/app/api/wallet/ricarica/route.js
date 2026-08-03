import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { getSession } from '../../../lib/users.js';
import { creaCheckout } from '../../../wallet/stripe.js';
import { APP_URL } from '../../../lib/constants.js';

// POST { pacchetto } → { url } della pagina di pagamento Stripe.
// Chi paga è l'utente della SESSIONE (Bearer token): nessuno può
// aprire un checkout intestato all'email di un altro.
async function handlePost(req) {
  try {
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'token mancante' }, { status: 401 });
    const sessione = await getSession(token);
    if (!sessione?.email) return NextResponse.json({ error: 'sessione non valida' }, { status: 401 });

    const { pacchetto } = await req.json();
    if (!pacchetto) return NextResponse.json({ error: 'pacchetto mancante' }, { status: 400 });

    const url = await creaCheckout(sessione.email.toLowerCase(), pacchetto, APP_URL);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'wallet-ricarica' });
