import { NextResponse } from 'next/server';
import { getSession, createLendingToken, validateLending, revokeLending, getLendingTokens, deductLendingTokens } from '../../lib/users.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';

// API Key Lending — Temporary TOP PRO access sharing
// Allows TOP PRO users to create time/token-limited access passes

export async function POST(req) {
  try {
    const { action, token, code, type, duration, tokenBudget } = await req.json();

    // Rate limit
    const rl = await checkRateLimit(getRateLimitKey(req, 'lending'), 20);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // === VALIDATE (public — no auth needed) ===
    if (action === 'validate') {
      if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
      const result = await validateLending(code);
      if (!result) {
        return NextResponse.json({ valid: false, error: 'Invalid lending code' });
      }
      return NextResponse.json({
        valid: true,
        type: result.type,
        tokensRemaining: result.tokensRemaining,
        expiresAt: result.expiresAt
      });
    }

    // All other actions require auth
    if (!token) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    }
    const session = await getSession(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    const email = session.email;

    // === CREATE lending token ===
    if (action === 'create') {
      try {
        const result = await createLendingToken(email, { type, duration, tokenBudget });
        return NextResponse.json({ ok: true, lendingCode: result.lendingCode });
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    // === LIST my lending tokens ===
    if (action === 'list') {
      const tokens = await getLendingTokens(email);
      return NextResponse.json({ ok: true, tokens });
    }

    // === REVOKE a lending token ===
    if (action === 'revoke') {
      if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
      try {
        await revokeLending(code, email);
        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (e) {
    console.error('Lending error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
