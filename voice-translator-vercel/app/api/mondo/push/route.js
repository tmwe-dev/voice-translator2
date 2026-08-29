import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { pushPublicKey } from '../../../lib/mondo/pushServer.js';
import { savePushSubscription, removePushSubscription } from '../../../lib/mondo/liveStore.js';

async function handleGet() {
  const publicKey = pushPublicKey();
  return NextResponse.json({ enabled: !!publicKey, publicKey: publicKey || null });
}

async function handlePost(req) {
  const body = await req.json().catch(() => null);
  const subscription = body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
  }
  try {
    const id = await savePushSubscription(subscription, body?.preferences || {});
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: 'push store unavailable', detail: String(e?.message || e).slice(0, 100) }, { status: 503 });
  }
}

async function handleDelete(req) {
  const body = await req.json().catch(() => null);
  if (!body?.endpoint) return NextResponse.json({ ok: true });
  await removePushSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}

export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'mondo-push-get', skipBodyCheck: true });
export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'mondo-push-post' });
export const DELETE = withApiGuard(handleDelete, { maxRequests: 30, prefix: 'mondo-push-del' });
