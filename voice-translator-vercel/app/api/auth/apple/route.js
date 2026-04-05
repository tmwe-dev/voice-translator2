import { NextResponse } from 'next/server';
import { createUser, getUser, createSession, getReferralCode, applyReferral } from '../../../lib/users.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import crypto from 'crypto';

// ── Apple JWKS cache (refresh every 24h) ──
let _appleKeys = null;
let _appleKeysTs = 0;
const JWKS_TTL = 86400000; // 24h

async function getApplePublicKeys() {
  if (_appleKeys && Date.now() - _appleKeysTs < JWKS_TTL) return _appleKeys;
  const res = await fetch('https://appleid.apple.com/auth/keys', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch Apple JWKS');
  const jwks = await res.json();
  _appleKeys = jwks.keys;
  _appleKeysTs = Date.now();
  return _appleKeys;
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - str.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

async function verifyAppleJWT(id_token) {
  const parts = id_token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  // Decode header to get key ID
  const header = JSON.parse(base64urlDecode(parts[0]).toString('utf8'));
  if (!header.kid || header.alg !== 'RS256') throw new Error('Unsupported token header');

  // Find matching Apple public key
  const appleKeys = await getApplePublicKeys();
  const jwk = appleKeys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('Apple key not found for kid: ' + header.kid);

  // Import JWK as CryptoKey and verify signature
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signatureInput = Buffer.from(parts[0] + '.' + parts[1], 'utf8');
  const signature = base64urlDecode(parts[2]);
  const valid = crypto.verify('RSA-SHA256', signatureInput, key, signature);
  if (!valid) throw new Error('Invalid token signature');

  // Decode payload
  return JSON.parse(base64urlDecode(parts[1]).toString('utf8'));
}

// Apple Sign-In: verify identity token and create/login user
async function appleHandler(req) {
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

    // Verify JWT signature against Apple's public keys (JWKS)
    let payload;
    try {
      payload = await verifyAppleJWT(id_token);
    } catch (e) {
      console.error('Apple JWT verification failed:', e.message);
      return NextResponse.json({ error: 'Invalid or tampered token' }, { status: 401 });
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
      } catch (e) { console.warn('[Apple Auth] Failed to parse user name:', e.message); }
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

export const POST = withApiGuard(appleHandler, { maxRequests: 20, prefix: 'auth-apple' });
