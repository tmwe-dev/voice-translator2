import { NextResponse } from 'next/server';
import { createUser, getUser, createSession, getReferralCode, applyReferral } from '../../../lib/users.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
import crypto from 'crypto';

// Apple Sign-In: verify identity token and create/login user
// Apple sends id_token as JWT — we decode and verify it
export async function POST(req) {
  try {
    // Rate limit: 10/min per IP
    const rl = await checkRateLimit(getRateLimitKey(req, 'auth-apple'), 10);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 });
    }

    const { id_token, user: appleUser, referralCode } = await req.json();

    if (!id_token) {
      return NextResponse.json({ error: 'Missing Apple identity token' }, { status: 400 });
    }

    // Decode the JWT payload (Apple's id_token is a standard JWT)
    // For production, you should verify the signature against Apple's public keys
    const parts = id_token.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
    }

    let payload;
    try {
      const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4);
      payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    // Verify issuer and audience
    if (payload.iss !== 'https://appleid.apple.com') {
      return NextResponse.json({ error: 'Invalid token issuer' }, { status: 401 });
    }

    const expectedClientId = process.env.APPLE_CLIENT_ID;
    if (expectedClientId && payload.aud !== expectedClientId) {
      return NextResponse.json({ error: 'Token not issued for this app' }, { status: 401 });
    }

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    // Apple may relay the email only on first sign-in
    // After that, we use the 'sub' (subject) as a stable identifier
    const appleSubject = payload.sub;
    let email = payload.email;

    if (!email && !appleSubject) {
      return NextResponse.json({ error: 'No email or subject in token' }, { status: 401 });
    }

    // If no email in token, try to look up by Apple subject ID
    if (!email) {
      // Check if we have a mapping for this Apple sub
      const { redis } = await import('../../../lib/redis.js');
      const mappedEmail = await redis('GET', `apple:sub:${appleSubject}`);
      if (mappedEmail) {
        email = mappedEmail;
      } else {
        return NextResponse.json({ error: 'Apple email not available. Please sign in again.' }, { status: 401 });
      }
    }

    email = email.toLowerCase();

    // Store Apple subject → email mapping for future logins
    if (appleSubject) {
      const { redis } = await import('../../../lib/redis.js');
      await redis('SET', `apple:sub:${appleSubject}`, email);
    }

    // Extract name from the user object (Apple sends this only on first auth)
    let name = '';
    if (appleUser) {
      try {
        const u = typeof appleUser === 'string' ? JSON.parse(appleUser) : appleUser;
        name = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ');
      } catch {}
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

    const platformHasElevenLabs = !!process.env.ELEVENLABS_API_KEY;

    return NextResponse.json({
      ok: true,
      token: sessionToken,
      user,
      referralInfo,
      referralCode: userReferralCode,
      platformHasElevenLabs,
      provider: 'apple'
    });

  } catch (e) {
    console.error('Apple auth error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
