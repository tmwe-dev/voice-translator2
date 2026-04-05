import { NextResponse } from 'next/server';
import { createUser, getUser, createSession, getReferralCode, applyReferral } from '../../../lib/users.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
import { withApiGuard } from '../../../lib/apiGuard.js';

// Google OAuth: verify ID token and create/login user
// Uses Google's tokeninfo endpoint (no extra npm packages needed)
async function handler(req) {
  try {
    // Rate limit: 10/min per IP
    const rl = await checkRateLimit(getRateLimitKey(req, 'auth-google'), 10);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 });
    }

    const { credential, code, referralCode } = await req.json();

    if (!credential && !code) {
      return NextResponse.json({ error: 'Missing Google credential or code' }, { status: 400 });
    }

    let email, name;

    if (code) {
      // ── OAuth Code flow (from initCodeClient popup) ──
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
      }

      // Exchange code for tokens — redirect_uri must be 'postmessage' for popup flow
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: 'postmessage',
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error('Google token exchange failed:', err);
        return NextResponse.json({ error: 'Google token exchange failed' }, { status: 401 });
      }

      const tokens = await tokenRes.json();

      // Get user info
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoRes.ok) {
        return NextResponse.json({ error: 'Failed to get Google user info' }, { status: 401 });
      }

      const gUser = await userInfoRes.json();
      if (!gUser.email || !gUser.email_verified) {
        return NextResponse.json({ error: 'Email not verified by Google' }, { status: 401 });
      }

      email = gUser.email.toLowerCase();
      name = gUser.name || gUser.given_name || '';

    } else {
      // ── One Tap credential flow (JWT ID token) ──
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!googleRes.ok) {
        return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
      }

      const googleUser = await googleRes.json();

      const expectedClientId = process.env.GOOGLE_CLIENT_ID;
      if (expectedClientId && googleUser.aud !== expectedClientId) {
        return NextResponse.json({ error: 'Token not issued for this app' }, { status: 401 });
      }

      if (!googleUser.email || googleUser.email_verified !== 'true') {
        return NextResponse.json({ error: 'Email not verified by Google' }, { status: 401 });
      }

      email = googleUser.email.toLowerCase();
      name = googleUser.name || googleUser.given_name || '';
    }

    // Create or get user
    let user = await getUser(email);
    const isNewUser = !user;
    if (!user) {
      user = await createUser(email, name, 'it', '/avatars/1.png');
    }

    // Apply referral bonus if provided and new user
    let referralInfo = { applied: false };
    if (isNewUser && referralCode) {
      try {
        const referralResult = await applyReferral(email, referralCode);
        if (referralResult.success) {
          user = await getUser(email);
          referralInfo = { applied: true, referrerEmail: referralResult.referrerEmail };
        }
      } catch (e) {
        console.error('Referral error:', e);
      }
    }

    // Create session
    const sessionToken = await createSession(email);
    const userReferralCode = await getReferralCode(email);

    // Tell frontend if platform has ElevenLabs key
    const platformHasElevenLabs = !!process.env.ELEVENLABS_API_KEY;

    return NextResponse.json({
      ok: true,
      token: sessionToken,
      user,
      referralInfo,
      referralCode: userReferralCode,
      platformHasElevenLabs,
      provider: 'google'
    });

  } catch (e) {
    console.error('Google auth error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handler, { maxRequests: 20, prefix: 'auth-google' });
