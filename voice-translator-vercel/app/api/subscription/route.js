import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../lib/supabase.js';

// ═══════════════════════════════════════════════
// Subscription Management API
//
// Actions:
//   plans       — list available plans
//   subscribe   — create Stripe checkout for subscription
//   portal      — create Stripe customer portal session
//   status      — get current subscription status
//   cancel      — cancel subscription (end of period)
// ═══════════════════════════════════════════════

// Lazy init — avoid build-time crash when STRIPE_SECRET_KEY is not set
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Plan pricing (Stripe price IDs — set these in your Stripe dashboard)
const PLANS = {
  pro: {
    name: 'Pro',
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
    priceMonthly: 990,     // €9.90
    priceYearly: 9900,     // €99.00 (save 2 months)
    creditsMonthly: 500,
    features: {
      max_rooms: 50, max_members: 5, voice_clone: true,
      ai_models: ['gpt-4o-mini', 'claude-haiku', 'gemini-flash'],
      tts_engines: ['openai', 'elevenlabs', 'edge'],
      glossaries: 5, history_days: 90,
    },
  },
  business: {
    name: 'Business',
    monthly: process.env.STRIPE_PRICE_BIZ_MONTHLY || 'price_biz_monthly',
    yearly: process.env.STRIPE_PRICE_BIZ_YEARLY || 'price_biz_yearly',
    priceMonthly: 2990,    // €29.90
    priceYearly: 29900,    // €299.00 (save 2 months)
    creditsMonthly: 3000,
    features: {
      max_rooms: -1, max_members: 10, voice_clone: true,
      ai_models: ['gpt-4o', 'claude-sonnet', 'gemini-pro', 'gpt-4o-mini', 'claude-haiku', 'gemini-flash'],
      tts_engines: ['openai', 'elevenlabs', 'edge'],
      glossaries: -1, history_days: -1, api_access: true, priority_support: true,
    },
  },
};

async function handlePost(req) {
  try {
    const { action, userEmail, userId, plan, period, returnUrl } = await req.json();

    if (!action) return NextResponse.json({ error: 'No action' }, { status: 400 });

    const sb = getSupabaseAdmin();

    // ── List plans ──
    if (action === 'plans') {
      return NextResponse.json({
        plans: [
          { id: 'free', name: 'Free', priceMonthly: 0, priceYearly: 0, creditsMonthly: 0,
            features: { max_rooms: 3, max_members: 2, tts_engines: ['edge'], ai_models: [],
              voice_clone: false, glossaries: 0, history_days: 7, free_chars_daily: 50000 }},
          { id: 'pro', ...PLANS.pro },
          { id: 'business', ...PLANS.business },
        ],
      });
    }

    // ── Subscribe ──
    if (action === 'subscribe') {
      if (!plan || !PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
      if (!userEmail) return NextResponse.json({ error: 'Email required' }, { status: 400 });

      const selectedPlan = PLANS[plan];
      const billingPeriod = period === 'yearly' ? 'yearly' : 'monthly';
      const priceId = selectedPlan[billingPeriod];

      // Get or create Stripe customer
      let customerId;
      if (sb && userId) {
        const { data: profile } = await sb.from('profiles').select('stripe_customer_id').eq('id', userId).single();
        customerId = profile?.stripe_customer_id;
      }
      if (!customerId) {
        const customer = await getStripe().customers.create({ email: userEmail, metadata: { userId: userId || '', plan } });
        customerId = customer.id;
        if (sb && userId) {
          await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId);
        }
      }

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${returnUrl || process.env.NEXT_PUBLIC_URL || 'https://voicetranslate.app'}/?subscription=success`,
        cancel_url: `${returnUrl || process.env.NEXT_PUBLIC_URL || 'https://voicetranslate.app'}/?subscription=cancel`,
        metadata: { userId: userId || '', plan, period: billingPeriod },
        subscription_data: {
          metadata: { userId: userId || '', plan },
        },
      });

      return NextResponse.json({ url: session.url, sessionId: session.id });
    }

    // ── Customer Portal ──
    if (action === 'portal') {
      if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
      let customerId;
      if (sb) {
        const { data: profile } = await sb.from('profiles').select('stripe_customer_id').eq('id', userId).single();
        customerId = profile?.stripe_customer_id;
      }
      if (!customerId) return NextResponse.json({ error: 'No billing account' }, { status: 400 });

      const portalSession = await getStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || process.env.NEXT_PUBLIC_URL || 'https://voicetranslate.app',
      });
      return NextResponse.json({ url: portalSession.url });
    }

    // ── Subscription Status ──
    if (action === 'status') {
      if (!userId && !userEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
      if (sb) {
        const query = userId
          ? sb.from('profiles').select('tier, subscription_status, subscription_plan, subscription_period_end, credits').eq('id', userId)
          : sb.from('profiles').select('tier, subscription_status, subscription_plan, subscription_period_end, credits').eq('email', userEmail);
        const { data } = await query.single();
        if (data) return NextResponse.json(data);
      }
      return NextResponse.json({ tier: 'free', subscription_status: 'none', subscription_plan: 'free', credits: 0 });
    }

    // ── Cancel ──
    if (action === 'cancel') {
      if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
      if (sb) {
        const { data: profile } = await sb.from('profiles').select('stripe_subscription_id').eq('id', userId).single();
        if (profile?.stripe_subscription_id) {
          await getStripe().subscriptions.update(profile.stripe_subscription_id, { cancel_at_period_end: true });
          await sb.from('profiles').update({ subscription_status: 'canceled' }).eq('id', userId);
          return NextResponse.json({ ok: true, message: 'Subscription will end at period end' });
        }
      }
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Subscription error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'subscription' });
