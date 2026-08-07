import { NextResponse } from 'next/server';
import { createUser, getUser, createSession, getReferralCode } from '../../../lib/users.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import crypto from 'crypto';

const log = createLogger('authGoogleCallback');

// Force dynamic rendering — this route uses req.url and query params
export const dynamic = 'force-dynamic';

// Google OAuth callback — exchanges authorization code for user info
// Used as fallback when Google One Tap SDK doesn't load
export async function GET(req) {
  try {
    // Rate limit: 20/min per IP
    const rl = await checkRateLimit(getRateLimitKey(req, 'auth-google-cb'), 20);
    if (!rl.allowed) {
      return new Response(closePopupHTML('Too many attempts. Please wait.'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // SECURITY: OAuth state is MANDATORY to prevent CSRF attacks.
    // Triple validation: state param + Redis + browser cookie hash.
    // This binds the OAuth flow to the browser that initiated it.
    if (!state) {
      return new Response(closePopupHTML('Parametro state mancante. Riprova il login.'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // 1. Verify state exists in Redis (server-side, one-time use)
    const stateKey = `oauth_state:${state}`;
    const valid = await redis('GET', stateKey);
    if (!valid) {
      return new Response(closePopupHTML('Sessione OAuth scaduta o invalida. Riprova.'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // 2. Verify cookie hash matches the state (binds to browser)
    const cookieHash = req.cookies?.get?.('oauth_state_hash')?.value
      || (req.headers.get('cookie') || '').match(/oauth_state_hash=([^;]+)/)?.[1]
      || '';
    const expectedHash = crypto.createHash('sha256').update(state).digest('hex');
    if (!cookieHash || cookieHash !== expectedHash) {
      await redis('DEL', stateKey); // clean up
      return new Response(closePopupHTML('Verifica browser fallita. Riprova il login.'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // 3. Delete state from Redis (one-time use) — cookie expires naturally
    await redis('DEL', stateKey);

    if (error) {
      return new Response(closePopupHTML('Accesso annullato'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code) {
      return new Response(closePopupHTML('Codice mancante'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_URL || 'https://voice-translator2.vercel.app'}/api/auth/google-callback`;

    if (!clientId || !clientSecret) {
      return new Response(closePopupHTML('Google OAuth non configurato sul server'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      log.error('Google token exchange failed:', err);
      return new Response(closePopupHTML('Errore nello scambio del token Google'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const tokens = await tokenRes.json();

    // Get user info from ID token
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      return new Response(closePopupHTML('Errore nel recupero delle informazioni utente'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const googleUser = await userInfoRes.json();

    if (!googleUser.email || !googleUser.email_verified) {
      return new Response(closePopupHTML('Email non verificata da Google'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const email = googleUser.email.toLowerCase();
    const name = googleUser.name || googleUser.given_name || '';

    // Create or get user
    let user = await getUser(email);
    if (!user) {
      user = await createUser(email, name, 'it', '/avatars/1.png');
    }

    // Create session
    const sessionToken = await createSession(email);
    const userReferralCode = await getReferralCode(email);
    const platformHasElevenLabs = !!process.env.ELEVENLABS_API_KEY;

    // Send result to parent window and close popup
    const result = JSON.stringify({
      ok: true,
      token: sessionToken,
      user,
      referralCode: userReferralCode,
      platformHasElevenLabs,
      provider: 'google'
    });

    return new Response(successPopupHTML(result), {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (e) {
    log.error('Google callback error:', e);
    return new Response(closePopupHTML('Errore interno'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function closePopupHTML(message) {
  // Escape HTML to prevent XSS
  const escaped = escapeHtml(message);
  return `<!DOCTYPE html><html><body>
    <p>${escaped}</p>
    <script>
      setTimeout(() => window.close(), 2000);
    </script>
  </body></html>`;
}

function successPopupHTML(resultJson) {
  // Use specific origin instead of '*' to prevent clickjacking
  const appUrl = process.env.NEXT_PUBLIC_URL || 'https://voice-translator2.vercel.app';
  // Encode as base64 to prevent XSS from user-controlled data (e.g. user.name)
  const b64 = Buffer.from(resultJson, 'utf-8').toString('base64');
  return `<!DOCTYPE html><html><body>
    <p>Accesso riuscito! Chiusura in corso...</p>
    <script>
      try {
        if (window.opener) {
          var data = JSON.parse(atob("${b64}"));
          window.opener.postMessage({ type: 'google-oauth-result', data: data }, '${appUrl}');
        }
      } catch(e) { /* gettone di stato illeggibile: vale come assente e l accesso viene rifiutato */ }
      setTimeout(function() { window.close(); }, 1000);
    </script>
  </body></html>`;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
