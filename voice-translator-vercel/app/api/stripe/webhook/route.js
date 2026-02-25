import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits, addPaymentRecord } from '../../../lib/users.js';

// POST /api/stripe/webhook - Stripe webhook handler
export async function POST(req) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event;
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      try {
        event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      // In test mode without webhook secret, parse directly
      event = JSON.parse(body);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.metadata?.email || session.customer_email;
      const credits = parseInt(session.metadata?.credits || '0');
      const packageId = session.metadata?.packageId;

      if (email && credits > 0) {
        // Add credits to user
        await addCredits(email, credits);

        // Record payment
        await addPaymentRecord(email, {
          type: 'stripe',
          packageId,
          credits,
          amount: session.amount_total, // in cents
          currency: session.currency,
          stripeSessionId: session.id,
          paymentIntent: session.payment_intent,
        });

        console.log(`[Webhook] Added ${credits} credits to ${email}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Note: In Next.js App Router, body is automatically handled as raw text
// when we call req.text() above. No config needed.
