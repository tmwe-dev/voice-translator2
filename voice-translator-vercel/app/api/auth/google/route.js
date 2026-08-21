import { NextResponse } from 'next/server';
import { createUser, getUser, createSession, getReferralCode, applyReferral } from '../../../lib/users.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('authGoogle');

// Google OAuth: verify ID token and create/login user
// Uses Google's tokeninfo endpoint (no extra npm packages needed)
async function handler(req) {
  try {
    // b.106 — era un secondo conteggio sulla STESSA chiave del guard, che
    // dimezzava il tetto senza volerlo. Trattandosi di autenticazione, sul
    // guard e rimasto il tetto piu STRETTO dei due (10), non il piu largo.

    // b.363 — `credential` (il gettone firmato da Google) e `code` (il
    // codice di autorizzazione) partivano dritti verso Google dentro
    // l'indirizzo o il corpo della chiamata, senza che nessuno guardasse
    // se fossero stringhe o quanto fossero lunghi. Un valore che non e una
    // parola faceva esplodere la costruzione della richiesta; uno enorme
    // ce la faceva spedire per intero a spese nostre. Le misure sono
    // larghe apposta: un gettone Google vero sta sotto i duemila caratteri.
    const corpo = await req.json();
    const parola = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);
    const credential = parola(corpo?.credential, 4000);
    const code = parola(corpo?.code, 2000);
    const referralCode = parola(corpo?.referralCode, 40);

    if (!credential && !code) {
      return NextResponse.json({ error: 'Missing Google credential or code' }, { status: 400 });
    }

    let email, name;

    if (code) {
      // ── OAuth Code flow (from initCodeClient popup) ──
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        // b.363 — uscita di guasto muta: dal registro sembrava che non
        // fosse successo niente. L'accesso con Google smetteva di funzionare per tutti e nel registro non compariva nulla.
        log.error('Accesso Google: manca client_id o client_secret');
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
        log.error('Google token exchange failed:', err);
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

      // SECURITY: aud check is MANDATORY — reject if GOOGLE_CLIENT_ID not configured
      const expectedClientId = process.env.GOOGLE_CLIENT_ID;
      if (!expectedClientId) {
        log.error('GOOGLE_CLIENT_ID not configured — rejecting token');
        return NextResponse.json({ error: 'Google auth not properly configured' }, { status: 500 });
      }
      if (googleUser.aud !== expectedClientId) {
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
        log.error('Referral error:', e);
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
    log.error('Google auth error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handler, { maxRequests: 10, prefix: 'auth-google' });
