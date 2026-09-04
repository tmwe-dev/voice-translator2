import { NextResponse } from 'next/server';
import { leggiWebhook, estraiPagamento } from '../../../wallet/stripe.js';
import { registraAcquistoStripe } from '../../../wallet/contabilita.js';
import { createLogger } from '../../../lib/logger.js';
import { segnaVisita } from '../../../lib/registroRotte.js';   // b.630

const log = createLogger('wallet-webhook');

// Stripe chiama questa route quando un pagamento va a buon fine.
// 1. Verifichiamo la firma (e' davvero Stripe?)
// 2. Se e' un pagamento completato E pagato → accreditiamo i secondi
//
// b.154 — PRIMA questa route chiamava registraMovimento() (insert
// semplice, senza controllo di duplicati) ogni volta che arrivava
// l'evento: Stripe documenta esplicitamente che un webhook può
// essere consegnato più di una volta (retry automatici, resend
// manuale dalla dashboard), e senza un vincolo l'utente veniva
// accreditato due volte per lo stesso pagamento. Ora si usa
// registraAcquistoStripe(), che si appoggia all'indice unico sul
// database (idx_ledger_stripe_session, migration 007): un secondo
// invio dello stesso evento non ri-accredita, e la route risponde
// comunque 200 — cosi Stripe smette di ritentare un evento che in
// realtà è già stato processato correttamente.
export async function POST(req) {
// b.630 — IL REGISTRO NON VEDEVA QUESTA ROTTA. Il conteggio delle
// visite (b.628) e agganciato a withApiGuard, e questa rotta non ci
// passa: al 3 dicembre avrebbe letto zero visite su una rotta viva.
// Trovato dal secondo revisore: le rotte fuori dalla guardia sono otto,
// non una. Qui si segna a mano, con lo stesso strumento.
  segnaVisita('/api/wallet/webhook');

  try {
    const corpo = await req.text(); // testo grezzo: serve per la firma
    const firma = req.headers.get('stripe-signature');
    const evento = await leggiWebhook(corpo, firma);

    const pagamento = estraiPagamento(evento);
    if (pagamento) {
      const esito = await registraAcquistoStripe(pagamento.utenteId, pagamento.secondi, {
        pacchetto: pagamento.pacchettoId,
        stripe: pagamento.stripeSessionId,
        euro: pagamento.euro, // incasso reale, letto dalle viste admin
      });
      if (esito.duplicato) {
        log.warn('Webhook duplicato ignorato, sessione già accreditata:', pagamento.stripeSessionId);
      }
    }
    return NextResponse.json({ ricevuto: true });
  } catch (e) {
    // Firma non valida o errore: 400 cosi' Stripe ritenta
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
