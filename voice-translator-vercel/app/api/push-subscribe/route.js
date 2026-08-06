// ═══════════════════════════════════════════════
// Push Subscription API — Store/manage Web Push subscriptions
//
// POST: Save push subscription for a user
// DELETE: Remove push subscription
// ═══════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';

// In production, store subscriptions in Redis/Supabase
// For now, use a Map (lost on cold start, but works for demo)
const subscriptions = new Map();

async function handlePost(request) {
  try {
    const { subscription, userId, roomId } = await request.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const key = userId || subscription.endpoint;
    subscriptions.set(key, {
      subscription,
      userId,
      roomId,
      createdAt: Date.now(),
    });

    return NextResponse.json({ ok: true, count: subscriptions.size });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

async function handleDelete(request) {
  try {
    const { endpoint, userId } = await request.json();
    const key = userId || endpoint;
    subscriptions.delete(key);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to remove' }, { status: 500 });
  }
}

// GET: Return VAPID public key so clients can subscribe
async function handleGet() {
  // VAPID public key — generate once and store in env
  // For now, use a placeholder that can be replaced with real VAPID keys
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkOs-N_Akh7MljRiVfAzJHROsAaChMfmaZp2SQ7aB8';
  return NextResponse.json({ publicKey: vapidPublicKey });
}

// ── b.118 · anche questa passa dalla guardia comune ──
// La caccia al tesoro l'ha trovata scoperta: rispondeva 500 a un corpo
// malformato, e non aveva il limite di frequenza condiviso. Aveva un
// limite suo, scritto a mano — che e proprio il modo in cui una rotta
// si dimentica per strada le protezioni aggiunte a tutte le altre.
export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'push-subscribe' });
export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'push-subscribe', skipBodyCheck: true });
export const DELETE = withApiGuard(handleDelete, { maxRequests: 30, prefix: 'push-subscribe' });
