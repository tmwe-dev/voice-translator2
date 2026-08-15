// ═══════════════════════════════════════════════════════════════
// STRIPE — Solo pagamenti. Niente altro.
//
// Due funzioni:
//   1. creaCheckout(utente, pacchetto) → link di pagamento
//   2. leggiWebhook(request) → evento verificato da Stripe
//
// Questo file NON scrive crediti. Quando Stripe conferma il
// pagamento, è l'API webhook che chiama la contabilità.
// ═══════════════════════════════════════════════════════════════

import Stripe from 'stripe';
import { PACCHETTI } from './tariffe.js';

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * Crea la pagina di pagamento Stripe per un pacchetto.
 * Ritorna l'URL dove mandare l'utente.
 */
export async function creaCheckout(utenteId, pacchettoId, urlBase) {
  const pacchetto = PACCHETTI.find(p => p.id === pacchettoId);
  if (!pacchetto) throw new Error('Pacchetto sconosciuto: ' + pacchettoId);

  const sessione = await stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(pacchetto.euro * 100), // Stripe vuole centesimi
        product_data: { name: `BarTalk ${pacchetto.nome} — ${Math.round(pacchetto.secondi / 3600)} ore` },
      },
      quantity: 1,
    }],
    // Questi dati tornano indietro nel webhook: servono per accreditare
    metadata: { utente_id: utenteId, pacchetto_id: pacchetto.id, secondi: String(pacchetto.secondi) },
    success_url: `${urlBase}/?ricarica=ok`,
    cancel_url: `${urlBase}/?ricarica=annullata`,
  });

  return sessione.url;
}

/**
 * Verifica che il webhook arrivi davvero da Stripe e ritorna l'evento.
 * Se la firma non è valida, lancia un errore (e il chiamante risponde 400).
 */
export async function leggiWebhook(corpoGrezzo, firmaHeader) {
  return stripe().webhooks.constructEvent(
    corpoGrezzo,
    firmaHeader,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

/**
 * Da un evento webhook, estrae i dati che servono per accreditare.
 * Ritorna null se l'evento non è un pagamento completato e pagato.
 */
export function estraiPagamento(evento) {
  // b.158 — CONFERMATO, secondo difetto nello stesso punto (b.154 ne
  // aveva corretto solo meta'). Prima si accettava SOLO
  // 'checkout.session.completed'. Ma per i metodi di pagamento
  // differiti (es. SEPA) quell'evento arriva con payment_status
  // 'unpaid' — e veniva correttamente scartato dal controllo sotto.
  // Il problema e' che il pagamento POI va a buon fine con un evento
  // SEPARATO, 'checkout.session.async_payment_succeeded', che questa
  // funzione non ammetteva nemmeno in cima: quell'evento veniva
  // scartato subito, PRIMA di arrivare al controllo su
  // payment_status. Risultato pratico: chi pagava con un metodo
  // differito pagava per davvero e non riceveva MAI i secondi — un
  // furto involontario ai danni del cliente, non della piattaforma.
  // 'checkout.session.async_payment_failed' resta correttamente
  // ignorato (non e' nell'elenco sotto): il pagamento non e' andato a
  // buon fine, non c'e' niente da accreditare.
  const tipiPagamentoConfermato = [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
  ];
  if (!tipiPagamentoConfermato.includes(evento.type)) return null;

  // b.154 — CONFERMATO: mancava questo controllo. Stripe distingue
  // 'paid' da 'unpaid'/'no_payment_required' dentro payment_status.
  // Accreditare su "completed" da solo, senza guardare
  // payment_status, rischia di pagare un acquisto mai andato a buon
  // fine con un metodo differito.
  //
  // b.158 — CONFERMATO, difetto residuo nella stessa riga: il
  // controllo era `if (payment_status && payment_status !== 'paid')`
  // — se il campo era ASSENTE (falsy), l'intero controllo veniva
  // saltato e si accreditava comunque, senza nessuna verifica.
  // Il campo non e' documentato come sempre presente da Stripe per
  // ogni tipo di evento: un evento senza quel campo doveva bloccare,
  // non passare in silenzio. Ora si richiede la stringa esatta
  // 'paid': assente, o qualunque altro valore, blocca l'accredito.
  if (evento.data.object.payment_status !== 'paid') return null;
  const m = evento.data.object.metadata || {};
  if (!m.utente_id || !m.secondi) return null;
  return {
    utenteId: m.utente_id,
    pacchettoId: m.pacchetto_id,
    secondi: parseInt(m.secondi, 10),
    stripeSessionId: evento.data.object.id,
    // Quanto ha pagato DAVVERO (Stripe lo dice in centesimi).
    // Serve alla contabilità per calcolare gli incassi.
    euro: (evento.data.object.amount_total || 0) / 100,
  };
}
