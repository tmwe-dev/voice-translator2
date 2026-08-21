import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { getSession } from '../../../lib/users.js';
import { creaCheckout } from '../../../wallet/stripe.js';
import { APP_URL } from '../../../lib/constants.js';
// b.363 — questo file non aveva alcun registro: ogni suo guasto usciva
// dalla porta senza lasciare una riga da nessuna parte.
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('walletRicarica');

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

    // b.363 — il nome del pacchetto arrivava dal client e veniva passato
    // cosi com'era alla creazione del pagamento Stripe: nessun controllo
    // di tipo ne di lunghezza. Un valore che non e una parola faceva
    // fallire la chiamata a Stripe con un errore nostro (500) invece che
    // con un rifiuto pulito, e ogni tentativo era comunque una chiamata
    // vera verso l'esterno. I nomi dei pacchetti sono corti.
    const corpo = await req.json();
    const pacchetto = corpo?.pacchetto;
    if (!pacchetto || typeof pacchetto !== 'string' || pacchetto.length > 60) {
      return NextResponse.json({ error: 'pacchetto mancante' }, { status: 400 });
    }

    const url = await creaCheckout(sessione.email.toLowerCase(), pacchetto, APP_URL);
    return NextResponse.json({ url });
  } catch (e) {
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. Un pagamento che non parte e la cosa piu importante da sapere subito.
    log.error('Ricarica: apertura pagamento Stripe non riuscita', { err: e?.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'wallet-ricarica' });
