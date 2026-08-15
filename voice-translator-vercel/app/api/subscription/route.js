import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { getSession } from '../../lib/users.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('subscription');

// ═══════════════════════════════════════════════
// Subscription Management API
//
// Actions:
//   plans       — list available plans (public)
//   subscribe   — DISATTIVATA b.158 (vedi nota sotto)
//   portal      — DISATTIVATA b.158 (vedi nota sotto)
//   status      — get current subscription status (auth required)
//   cancel      — cancel subscription (auth required) — lasciata attiva
//                 apposta: chi avesse gia' un abbonamento legacy deve
//                 poter smettere di pagare
//
// Auth: Session token required for all actions except 'plans'
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
    const { action, token } = await req.json();

    if (!action) return NextResponse.json({ error: 'No action' }, { status: 400 });

    const sb = getSupabaseAdmin();

    // ── List plans (public — no auth required) ──
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

    // ── Session verification for all other actions ──
    const session = token ? await getSession(token) : null;
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized — valid session required' }, { status: 401 });
    }
    const verifiedEmail = session.email;

    // Resolve userId from Supabase profile (ignore userId from body for security)
    let verifiedUserId = null;
    if (sb) {
      const { data: profile } = await sb.from('profiles').select('id').eq('email', verifiedEmail).single();
      verifiedUserId = profile?.id || null;
    }

    // b.158 — CONFERMATO, difetto critico letto nel codice: 'subscribe'
    // e 'portal' aprono un vero addebito/vera gestione Stripe (carta
    // vera, abbonamento vero, rinnovo automatico vero), ma NESSUNA
    // funzione a pagamento del prodotto legge mai profiles.tier o
    // subscription_status per concedere qualcosa (resolveAuth guarda
    // solo il wallet — vedi apiAuth.js). Come /api/stripe (vedi li'),
    // questa rotta e' pubblica, non ha piu nessuna voce che la chiami
    // dall'interfaccia viva, ma resta raggiungibile chiamando l'API
    // direttamente: un cliente che la trovasse pagherebbe un
    // abbonamento reale, ricorrente, per un tier che il prodotto non
    // applica mai. Disattivate qui le due azioni che aprono un vero
    // addebito o una vera gestione dell'addebito.
    if (action === 'subscribe' || action === 'portal') {
      return NextResponse.json({
        error: 'Gli abbonamenti non sono piu attivi. Usa il wallet in-app per ricaricare il credito.',
      }, { status: 410 });
    }

    // ── Subscription Status ──
    if (action === 'status') {
      if (sb) {
        const query = verifiedUserId
          ? sb.from('profiles').select('tier, subscription_status, subscription_plan, subscription_period_end, credits').eq('id', verifiedUserId)
          : sb.from('profiles').select('tier, subscription_status, subscription_plan, subscription_period_end, credits').eq('email', verifiedEmail);
        const { data } = await query.single();
        if (data) return NextResponse.json(data);
      }
      return NextResponse.json({ tier: 'free', subscription_status: 'none', subscription_plan: 'free', credits: 0 });
    }

    // ── Cancel ──
    // b.159 — CONFERMATO leggendo il database live (Supabase progetto
    // myctvixqhfdbgphqxtlp): la tabella `public.profiles` NON esiste in
    // produzione (le migrazioni 001-003 che la creano non risultano fra
    // quelle applicate — l'unico schema live e quello del wallet). Con
    // la versione precedente, `verifiedUserId` restava sempre null
    // (riga sopra, lookup su profiles fallisce) e questa azione
    // rispondeva sempre 400 "No Supabase profile found": un cliente con
    // un abbonamento legacy ANCORA ATTIVO — l'unica azione lasciata
    // apposta accesa "perche chi avesse gia un abbonamento legacy deve
    // poter smettere di pagare" (vedi commento in cima al file) — non
    // poteva disdire. Soldi veri, addebitati ogni mese, senza modo di
    // fermarli dall'app.
    //
    // Non è possibile correggere questo cercando ANCORA in `profiles`
    // (non esiste): la ricerca dell'abbonamento passa direttamente da
    // Stripe, per email di sessione verificata — nessuna scrittura di
    // schema, nessuna decisione di prodotto, stessa email che avrebbe
    // aperto l'abbonamento in origine.
    if (action === 'cancel') {
      const customers = await getStripe().customers.list({ email: verifiedEmail, limit: 5 });
      const customerIds = customers.data.map(c => c.id);
      if (!customerIds.length) {
        return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
      }
      const canceled = [];
      for (const customerId of customerIds) {
        const subs = await getStripe().subscriptions.list({ customer: customerId, status: 'active', limit: 10 });
        for (const s of subs.data) {
          await getStripe().subscriptions.update(s.id, { cancel_at_period_end: true });
          canceled.push(s.id);
        }
      }
      if (!canceled.length) {
        return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
      }
      // Se profiles esistesse si aggiornerebbe qui il subscription_status:
      // non e' piu il caso (vedi nota sopra) — Stripe resta l'unica
      // fonte di verita per questa azione.
      return NextResponse.json({ ok: true, message: 'Subscription will end at period end', canceled });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    log.error('Subscription error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'subscription' });
