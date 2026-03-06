import { NextResponse } from 'next/server';
import { saveApiKeys, getKeyStatus, deleteApiKey } from '../../lib/keyVault.js';
import { getSession } from '../../lib/users.js';
import { withApiGuard } from '../../lib/apiGuard.js';

// GET: Check which providers have saved keys (no values returned)
async function handleGet(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await getSession(token);
  if (!session?.email) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const status = await getKeyStatus(session.email);
  return NextResponse.json({ keys: status });
}

// POST: Save new API keys (encrypted)
async function handlePost(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await getSession(token);
  if (!session?.email) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { keys } = body;
  if (!keys || typeof keys !== 'object') {
    return NextResponse.json({ error: 'Missing keys object' }, { status: 400 });
  }

  // Validate provider names
  const validProviders = new Set(['openai', 'elevenlabs', 'anthropic', 'gemini']);
  for (const provider of Object.keys(keys)) {
    if (!validProviders.has(provider)) {
      return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
    }
  }

  // Basic key format validation
  for (const [provider, key] of Object.entries(keys)) {
    if (typeof key !== 'string' || key.length < 10 || key.length > 200) {
      return NextResponse.json({ error: `Invalid key format for ${provider}` }, { status: 400 });
    }
  }

  const ok = await saveApiKeys(session.email, keys);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to save keys' }, { status: 500 });
  }

  // Return key status (not values!)
  const status = await getKeyStatus(session.email);
  return NextResponse.json({ ok: true, keys: status });
}

// DELETE: Remove a specific provider key
async function handleDelete(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await getSession(token);
  if (!session?.email) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider');

  if (!provider) {
    return NextResponse.json({ error: 'Missing provider parameter' }, { status: 400 });
  }

  const ok = await deleteApiKey(session.email, provider);
  return NextResponse.json({ ok });
}

export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'keys' });
export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'keys-save' });
export const DELETE = withApiGuard(handleDelete, { maxRequests: 10, prefix: 'keys-del' });
