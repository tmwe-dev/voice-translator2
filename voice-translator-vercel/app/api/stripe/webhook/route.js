import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addCredits, addPaymentRecord } from '../../../lib/users.js';
import { getSupabaseAdmin } from '../../../lib/supabase.js';
import { addCreditsDB, savePayment as savePaymentDB, logAudit } from '../../../lib/supabaseAPI.js';
import { redis } from '../../../lib/redis.js';

// ═══════════════════════════════════════════════
// Stripe Webhook Handler
//
// Events handled:
//   checkout.session.completed  — credit purchase or new subscription
//   invoice.payment_succeeded   — recurring subscription payment
//   customer.subscription.updated — plan change, cancellation
//   customer.subscription.deleted — subscription ended
// ═══════════════════════════════════════════════

// Lazy stripe init
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Plan → credits mapping for monthly bonuses
const PLAN_CREDITS = { pro: 500, business: 3000 };

export async function POST(req) {
  try {
    const stripe = getStripe();
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event;
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting all webhooks');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    if (!sig) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
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
      console.warn('[Webhook] Idempotency check failed:', e.message);
    }

    const sb = getSupabaseAdmin();

    // ── Checkout completed (one-time credits OR new subscription) ──
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.metadata?.email || session.customer_email;
      const userId = session.metadata?.userId;

      if (session.mode === 'subscription') {
        // New subscription created
        const plan = session.metadata?.plan || 'pro';
        const subscriptionId = session.subscription;

        if (sb && userId) {
          await sb.from('profiles').update({
            subscription_plan: plan,
            subscription_status: 'active',
            stripe_subscription_id: subscriptionId,
            tier: plan,
            updated_at: new Date().toISOString(),
          }).eq('id', userId);

          // Add monthly bonus credits
          const bonusCredits = PLAN_CREDITS[plan] || 0;
          if (bonusCredits > 0) {
            await addCreditsDB(userId, bonusCredits);
          }

          // Save payment record
          await savePaymentDB({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_payment_intent: session.payment_intent,
            type: 'subscription',
            amount_eur_cents: session.amount_total || 0,
            credits_added: bonusCredits,
            plan,
            status: 'completed',
          });

          await logAudit(userId, 'subscription_created', 'subscription', { plan, subscriptionId });
        }

        console.log(`[Webhook] Subscription ${plan} created for ${email || userId}`);
      } else {
        // One-time credit purchase (existing flow)
        const credits = parseInt(session.metadata?.credits || '0');
        const packageId = session.metadata?.packageId;

        if (email && credits > 0) {
          // Add to Redis (existing system)
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

          // Also save to Supabase if available
          if (sb && userId) {
            await addCreditsDB(userId, credits);
            await savePaymentDB({
              user_id: userId,
              stripe_session_id: session.id,
              stripe_payment_intent: session.payment_intent,
              type: 'credits',
              amount_eur_cents: session.amount_total || 0,
              credits_added: credits,
              status: 'completed',
              metadata: { packageId },
            });
            await logAudit(userId, 'credits_purchased', 'payment', { credits, packageId });
          }

          console.log(`[Webhook] Added ${credits} credits to ${email}`);
        }
      }
    }

    // ── Recurring subscription payment ──
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      if (invoice.billing_reason === 'subscription_cycle') {
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;

        if (sb) {
          // Find user by Stripe customer ID
          const { data: profile } = await sb.from('profiles')
            .select('id, subscription_plan')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profile) {
            const plan = profile.subscription_plan || 'pro';
            const bonusCredits = PLAN_CREDITS[plan] || 0;

            if (bonusCredits > 0) {
              await addCreditsDB(profile.id, bonusCredits);
            }

            await savePaymentDB({
              user_id: profile.id,
              stripe_payment_intent: invoice.payment_intent,
              type: 'subscription',
              amount_eur_cents: invoice.amount_paid || 0,
              credits_added: bonusCredits,
              plan,
              status: 'completed',
              metadata: { billing_reason: 'subscription_cycle' },
            });

            // Update subscription period end
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              await sb.from('profiles').update({
                subscription_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              }).eq('id', profile.id);
            } catch (e) { console.error('Subscription retrieve error:', e.message); }

            await logAudit(profile.id, 'subscription_renewed', 'subscription', { plan, bonusCredits });
            console.log(`[Webhook] Subscription renewed for ${profile.id}: +${bonusCredits} credits`);
          }
        }
      }
    }

    // ── Subscription updated (plan change, cancellation scheduled) ──
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      if (sb) {
        const { data: profile } = await sb.from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          const updates = {
            subscription_status: subscription.cancel_at_period_end ? 'canceled' : subscription.status,
            subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          };

          // If plan changed
          const plan = subscription.metadata?.plan;
          if (plan) {
            updates.subscription_plan = plan;
            updates.tier = plan;
          }

          await sb.from('profiles').update(updates).eq('id', profile.id);
          await logAudit(profile.id, 'subscription_updated', 'subscription', {
            status: updates.subscription_status,
            cancel_at_period_end: subscription.cancel_at_period_end,
          });
        }
      }
    }

    // ── Subscription deleted (ended) ──
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      if (sb) {
        const { data: profile } = await sb.from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await sb.from('profiles').update({
            subscription_plan: 'free',
            subscription_status: 'none',
            tier: 'free',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          }).eq('id', profile.id);

          await logAudit(profile.id, 'subscription_ended', 'subscription', {});
          console.log(`[Webhook] Subscription ended for ${profile.id} — downgraded to free`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'stripe-webhook' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
