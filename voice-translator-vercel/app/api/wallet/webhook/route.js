import { NextResponse } from 'next/server';
import { leggiWebhook, estraiPagamento } from '../../../wallet/stripe.js';
import { registraMovimento } from '../../../wallet/contabilita.js';

// Stripe chiama questa route quando un pagamento va a buon fine.
// 1. Verifichiamo la firma (e' davvero Stripe?)
// 2. Se e' un pagamento completato → accreditiamo i secondi nel registro
export async function POST(req) {
  try {
    const corpo = await req.text(); // testo grezzo: serve per la firma
    const firma = req.headers.get('stripe-signature');
    const evento = await leggiWebhook(corpo, firma);

    const pagamento = estraiPagamento(evento);
    if (pagamento) {
      await registraMovimento(pagamento.utenteId, 'acquisto', pagamento.secondi, {
        pacchetto: pagamento.pacchettoId,
        stripe: pagamento.stripeSessionId,
      });
    }
    return NextResponse.json({ ricevuto: true });
  } catch (e) {
    // Firma non valida o errore: 400 cosi' Stripe ritenta
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
