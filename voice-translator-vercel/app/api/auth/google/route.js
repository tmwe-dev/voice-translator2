import { NextResponse } from 'next/server';
import { createUser, getUser, createSession, getReferralCode, applyReferral } from '../../../lib/users.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';

// Google OAuth: verify ID token and create/login user
// Uses Google's tokeninfo endpoint (no extra npm packages needed)
export async function POST(req) {
  try {
    // Rate limit: 10/min per IP
    const rl = await checkRateLimit(getRateLimitKey(req, 'auth-google'), 10);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 });
    }

    const { credential, referralCode } = await req.json();

    if (!credential) {
      return NextResponse.json({ error: 'Missing Google credential' }, { status: 400 });
    }

    // Verify the Google ID token via Google's tokeninfo endpoint
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!googleRes.ok) {
      return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
    }

    const googleUser = await googleRes.json();

    // Verify the token was issued for our app
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && googleUser.aud !== expectedClientId) {
      return NextResponse.json({ error: 'Token not issued for this app' }, { status: 401 });
    }

    // Verify email is present and verified
    if (!googleUser.email || googleUser.email_verified !== 'true') {
      return NextResponse.json({ error: 'Email not verified by Google' }, { status: 401 });
    }

    const email = googleUser.email.toLowerCase();
    const name = googleUser.name || googleUser.given_name || '';

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
