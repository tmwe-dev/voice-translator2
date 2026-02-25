import { NextResponse } from 'next/server';
import { createAuthCode, verifyAuthCode, createUser, getUser, createSession, getSession, getReferralCode, applyReferral } from '../../lib/users.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';

// POST /api/auth - Handle auth actions
export async function POST(req) {
  try {
    const { action, email, code, name, lang, avatar, token, referralCode } = await req.json();

    // Rate limit auth actions (stricter: 10/min for send-code/verify)
    if (action === 'send-code' || action === 'verify') {
      const rl = await checkRateLimit(getRateLimitKey(req, 'auth'), 10);
      if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 });
      }
    }

    // === SEND CODE ===
    if (action === 'send-code') {
      if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
      const authCode = await createAuthCode(email);

      // Try to send email via Resend if API key available
      let emailSent = false;
      if (process.env.RESEND_API_KEY) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM || 'VoiceTranslator <noreply@resend.dev>',
              to: [email],
              subject: `${authCode} - Codice di accesso VoiceTranslator`,
              html: `
                <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
                  <h2 style="color:#333;">VoiceTranslator</h2>
                  <p>Il tuo codice di accesso:</p>
                  <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:20px;background:#f5f5f5;border-radius:8px;text-align:center;color:#333;">
                    ${authCode}
                  </div>
                  <p style="color:#888;font-size:13px;margin-top:16px;">Il codice scade tra 10 minuti.</p>
                </div>
              `
            })
          });
          emailSent = res.ok;
        } catch (e) {
          console.error('Email send error:', e);
        }
      }

      // In test mode or if email fails, also return code in response
      const isTest = !process.env.RESEND_API_KEY || !emailSent;
      return NextResponse.json({
        ok: true,
        emailSent,
        ...(isTest ? { testCode: authCode } : {})
      });
    }

    // === VERIFY CODE ===
    if (action === 'verify') {
      if (!email || !code) return NextResponse.json({ error: 'email and code required' }, { status: 400 });
      const valid = await verifyAuthCode(email, code);
      if (!valid) return NextResponse.json({ error: 'Codice non valido o scaduto' }, { status: 401 });

      // Create or get user
      let user = await getUser(email);
      const isNewUser = !user;
      if (!user) {
        user = await createUser(email, name || '', lang || 'it', avatar || '/avatars/1.svg');
      }

      // Apply referral bonus if referral code provided and this is a new user
      let referralInfo = { applied: false };
      if (isNewUser && referralCode) {
        try {
          const referralResult = await applyReferral(email, referralCode);
          if (referralResult.success) {
            user = await getUser(email); // Refresh user to get updated credits
            referralInfo = { applied: true, referrerEmail: referralResult.referrerEmail };
          }
        } catch (e) {
          console.error('Referral error:', e);
        }
      }

      // Create session
      const sessionToken = await createSession(email);

      // Get referral code for this user
      const userReferralCode = await getReferralCode(email);

      return NextResponse.json({ ok: true, token: sessionToken, user, referralInfo, referralCode: userReferralCode });
    }

    // === CHECK SESSION (me) ===
    if (action === 'me') {
      if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      const session = await getSession(token);
      if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });
      const user = await getUser(session.email);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      // Get user's referral code
      const userReferralCode = await getReferralCode(session.email);
      // Tell frontend if platform has ElevenLabs key configured
      const platformHasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
      return NextResponse.json({ user, referralCode: userReferralCode, platformHasElevenLabs });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('Auth error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
