import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import Stripe from 'stripe';
import { getSession } from '../../lib/users.js';
import { CREDIT_PACKAGES } from '../../lib/users.js';

// POST /api/stripe - Create checkout session
async function handlePost(req) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { action, packageId, token } = await req.json();

    if (action === 'checkout') {
      if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      const session = await getSession(token);
      if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

      const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
      if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 });

      const origin = req.headers.get('origin') || 'https://voice-translator2.vercel.app';

      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: `VoiceTranslator - Credito ${pkg.label}`,
              description: `${pkg.messages}${pkg.bonus ? ` (${pkg.bonus})` : ''}`,
            },
            unit_amount: pkg.euros * 100, // Stripe uses cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${origin}?payment=success&credits=${pkg.credits}`,
        cancel_url: `${origin}?payment=cancelled`,
        customer_email: session.email,
        metadata: {
          email: session.email,
          packageId: pkg.id,
          credits: pkg.credits.toString(),
        },
      });

      return NextResponse.json({ url: checkoutSession.url, sessionId: checkoutSession.id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('Stripe error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'stripe' });
