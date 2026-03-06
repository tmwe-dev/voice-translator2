import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession, getUser, updateUser, saveApiKeys, getCredits, getPaymentHistory, deleteUserData } from '../../lib/users.js';

// POST /api/user - User profile actions
async function handlePost(req) {
  try {
    const { action, token, name, lang, avatar, apiKeys, useOwnKeys } = await req.json();

    // Authenticate
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    const email = session.email;

    // === GET PROFILE ===
    if (action === 'profile') {
      const user = await getUser(email);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      // Don't send full API keys - mask them
      const safeUser = { ...user };
      if (safeUser.apiKeys) {
        const masked = {};
        for (const [provider, key] of Object.entries(safeUser.apiKeys)) {
          if (key) masked[provider] = key.substring(0, 8) + '...' + key.substring(key.length - 4);
          else masked[provider] = '';
        }
        safeUser.apiKeys = masked;
      }
      return NextResponse.json({ user: safeUser });
    }

    // === UPDATE PROFILE ===
    if (action === 'update') {
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (lang !== undefined) updates.lang = lang;
      if (avatar !== undefined) updates.avatar = avatar;
      const user = await updateUser(email, updates);
      return NextResponse.json({ user });
    }

    // === SAVE API KEYS ===
    if (action === 'save-keys') {
      const user = await saveApiKeys(email, apiKeys || {}, !!useOwnKeys);
      return NextResponse.json({ ok: true, useOwnKeys: user.useOwnKeys });
    }

    // === GET CREDITS ===
    if (action === 'credits') {
      const { credits, useOwnKeys: uok } = await getCredits(email);
      return NextResponse.json({ credits, useOwnKeys: uok });
    }

    // === PAYMENT HISTORY ===
    if (action === 'payments') {
      const payments = await getPaymentHistory(email);
      return NextResponse.json({ payments });
    }

    // === GDPR: DELETE ALL DATA ===
    if (action === 'delete-data') {
      const result = await deleteUserData(email, token);
      return NextResponse.json({
        ok: true,
        message: 'All your data has been deleted (GDPR Art. 17)',
        deleted: result.deleted,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('User error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'user' });
