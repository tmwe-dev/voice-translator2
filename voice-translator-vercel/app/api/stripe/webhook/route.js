import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits, addPaymentRecord } from '../../../lib/users.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('stripeWebhook');

// ═══════════════════════════════════════════════
// Stripe Webhook Handler
//
// Eventi trattati:
//   checkout.session.completed — acquisto di crediti (accredito su Redis)
//
// ═══════════════════════════════════════════════════════════════
// b.422 — META' DI QUESTO GESTORE SCRIVEVA IN TABELLE CHE NON ESISTONO.
//
// C'erano quattro eventi. Tre di essi — invoice.payment_succeeded,
// customer.subscription.updated, customer.subscription.deleted —
// facevano una cosa sola: cercare la persona con
// `sb.from('profiles').eq('stripe_customer_id', ...)` e poi aggiornare
// `profiles`, accreditare via `add_credits` (che scrive
// `profiles.credits`), registrare in `payments` e in `audit_logs`.
// Verificato sul database vivo di produzione: `profiles`, `payments` e
// `audit_logs` NON ESISTONO nello schema `public`.
//
// Quindi la `.single()` iniziale falliva sempre, `profile` restava
// vuoto e il corpo dei tre gestori non e mai stato eseguito: sono stati
// tolti per intero. Nel quarto evento e stata tolta allo stesso modo la
// coda «Also save to Supabase if available» e il ramo `mode ===
// 'subscription'`, che scriveva soltanto li dentro.
//
// RESTA, INTATTO, L'UNICO PEZZO CHE FUNZIONAVA DAVVERO: l'acquisto di
// crediti una tantum, che accredita su Redis con `addCredits` e
// registra la ricevuta con `addPaymentRecord`. Non tocca Supabase, non
// e mai stato rotto, e non si tocca.
//
// ── DA SAPERE, NON DECISO QUI ──
// Il gemello /api/stripe (creazione dell'addebito) e disattivato dalla
// b.158 e risponde 410, quindi da allora non nascono piu sessioni di
// pagamento da questa parte: il ramo qui sotto serve solo se Stripe
// consegnasse ancora un evento vecchio. Spegnere anche questo e una
// decisione di prodotto, non una pulizia di codice morto: si annota.
// ═══════════════════════════════════════════════════════════════

// Lazy stripe init
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export async function POST(req) {
  try {
    const stripe = getStripe();
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event;
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      log.error('STRIPE_WEBHOOK_SECRET not configured — rejecting all webhooks');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    if (!sig) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      log.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // ── Idempotency: skip already-processed events (Stripe can retry) ──
    const idempotencyKey = `stripe_evt:${event.id}`;
    try {
      const already = await redis('GET', idempotencyKey);
      if (already) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Mark as processing (TTL 48h — Stripe retries for up to 72h)
      await redis('SET', idempotencyKey, '1', 'EX', 172800);
    } catch (e) {
      // If Redis is down, proceed anyway (better to double-process than miss)
      log.warn('Idempotency check failed:', e.message);
    }

    // ── Checkout completed: acquisto di crediti una tantum ──
    if (event.type === 'checkout.session.completed' && event.data.object.mode !== 'subscription') {
      const session = event.data.object;
      const email = session.metadata?.email || session.customer_email;
      const credits = parseInt(session.metadata?.credits || '0');
      const packageId = session.metadata?.packageId;

      if (email && credits > 0) {
        await addCredits(email, credits);
        await addPaymentRecord(email, {
          type: 'stripe',
          packageId,
          credits,
          amount: session.amount_total,
          currency: session.currency,
          stripeSessionId: session.id,
          paymentIntent: session.payment_intent,
        });

        log.info(`Added ${credits} credits to ${email}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    log.error('Webhook error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'stripe-webhook' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
