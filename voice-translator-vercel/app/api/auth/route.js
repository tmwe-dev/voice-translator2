import { NextResponse } from 'next/server';
import { createAuthCode, verifyAuthCode, createUser, getUser, createSession, getSession, deleteSession, getReferralCode, applyReferral, maskApiKeys } from '../../lib/users.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';
import { t } from '../../lib/i18n.js';
import { withApiGuard } from '../../lib/apiGuard.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('auth');

// POST /api/auth - Handle auth actions
async function handler(req) {
  try {
    const corpo = await req.json();

    // b.363 — TUTTO quello che segue arrivava dal client e veniva usato
    // cosi com'era: `email` finiva in una chiave del database e nel
    // destinatario di una vera email, `name` e `avatar` venivano scritti
    // sul profilo, `token` nella ricerca della sessione. Nessuno guardava
    // se fossero stringhe: mandando un oggetto o una lista al posto di una
    // parola si scriveva spazzatura in archivio, e con una stringa da un
    // milione di caratteri si riempiva il database. Qui non cambia nulla
    // per chi manda dati normali: si rifiuta solo cio che non e una
    // parola, o che e assurdamente lungo.
    const parola = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);
    const AZIONI = ['send-code', 'verify', 'me', 'logout'];

    const action = parola(corpo?.action, 20);
    if (!action || !AZIONI.includes(action)) {
      return NextResponse.json({ error: 'action non valida' }, { status: 400 });
    }
    const email = parola(corpo?.email, 254);
    const code = parola(corpo?.code, 12);
    const name = parola(corpo?.name, 80);
    const lang = parola(corpo?.lang, 12);
    const avatar = parola(corpo?.avatar, 300);
    const token = parola(corpo?.token, 200);
    const referralCode = parola(corpo?.referralCode, 40);

    // Rate limit OTP (prefix DEDICATO: prima usava 'auth' — lo stesso del
    // guard esterno — così ogni chiamata contava DOPPIO e il limite reale
    // per il login era ~5/min: bastava riprovare due volte per il 429)
    if (action === 'send-code' || action === 'verify') {
      const rl = await checkRateLimit(getRateLimitKey(req, 'auth-otp'), 12);
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
              from: process.env.RESEND_FROM || 'BarTalk <noreply@resend.dev>',
              to: [email],
              subject: `${authCode} - BarTalk ${t(lang || 'en', 'emailSubject')}`,
              html: `
                <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
                  <h2 style="color:#333;">BarTalk</h2>
                  <p>${t(lang || 'en', 'emailYourCode')}</p>
                  <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:20px;background:#f5f5f5;border-radius:8px;text-align:center;color:#333;">
                    ${authCode}
                  </div>
                  <p style="color:#888;font-size:13px;margin-top:16px;">${t(lang || 'en', 'emailCodeExpires')}</p>
                </div>
              `
            })
          });
          emailSent = res.ok;
        } catch (e) {
          log.error('Email send error:', e);
        }
      }

      // Only return code in dev/test — NEVER in production
      const isVercelProd = process.env.VERCEL_ENV === 'production';
      const isTestEnv = !isVercelProd && (process.env.NEXT_PUBLIC_TESTING_MODE === 'true' || process.env.NODE_ENV === 'development');
      const emailFailed = !process.env.RESEND_API_KEY || !emailSent;
      return NextResponse.json({
        ok: true,
        emailSent,
        ...(isTestEnv && emailFailed ? { testCode: authCode } : {})
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
        user = await createUser(email, name || '', lang || 'it', avatar || '/avatars/1.webp');
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
          log.error('Referral error:', e);
        }
      }

      // Create session
      const sessionToken = await createSession(email);

      // ═══════════════════════════════════════════════════════════════
      // b.422 — LA "SINCRONIZZAZIONE DEL PROFILO SU SUPABASE" NON HA MAI
      // SINCRONIZZATO NIENTE.
      //
      // Qui, a ogni accesso, si cercava la persona in `public.profiles`
      // per aggiornarla o crearla, e se non c'era si chiamava
      // `sb.auth.admin.listUsers()` — l'elenco INTERO degli utenti di
      // Supabase Auth — per provare a trovarne l'UUID. Verificato sul
      // database vivo di produzione: `public.profiles` NON ESISTE.
      // Quindi la select falliva sempre, l'insert falliva sempre, e
      // `supabaseUserId` usciva sempre null. Il campo partiva lo stesso
      // nella risposta del login, dove nessuna schermata lo leggeva
      // (verificato: zero riferimenti nel client).
      //
      // Non era neutro: l'elenco completo degli utenti veniva scaricato
      // a ogni accesso di ogni persona, per buttarlo via un istante
      // dopo. Un costo vero, pagato per un risultato che non esisteva.
      // ═══════════════════════════════════════════════════════════════
      // Get referral code for this user
      const userReferralCode = await getReferralCode(email);

      const platformHasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
      // b.166 — CONFERMATO (caccia al tesoro): `user` grezzo conteneva le
      // apiKeys dell'utente decriptate IN CHIARO, spedite al client a ogni
      // login. Mascherate qui, coerente con /api/user (azione 'profile').
      return NextResponse.json({ ok: true, token: sessionToken, user: maskApiKeys(user), referralInfo, referralCode: userReferralCode, platformHasElevenLabs });
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

      // ═══════════════════════════════════════════════════════════════
      // b.422 — anche qui si arricchiva la risposta con l'abbonamento
      // letto da `public.profiles`, che non esiste: `subscription`
      // usciva sempre null. Il client legge il piano dalla scheda utente
      // (Redis), non da qui. Tolto: era una lettura a vuoto su OGNI
      // apertura dell'app, perche 'me' e la prima chiamata che parte
      // quando si ripristina la sessione da localStorage.
      // ═══════════════════════════════════════════════════════════════
      // b.166 — stesso mascheramento: 'me' viene chiamata ad ogni apertura
      // app (restore sessione da localStorage), quindi era il punto piu
      // frequente di fuga delle chiavi in chiaro.
      return NextResponse.json({ user: maskApiKeys(user), referralCode: userReferralCode, platformHasElevenLabs });
    }

    // === LOGOUT ===
    // b.167 — CONFERMATO (audit esterno 15/8): il logout di useAuth.js
    // cancellava solo il token da localStorage e lo stato React. La
    // sessione su Redis (`session:${token}`) restava viva per i suoi 7
    // giorni interi: un token gia copiato (dispositivo condiviso, storage
    // letto da un'estensione, ecc.) continuava a funzionare anche dopo che
    // l'utente aveva premuto "esci". `deleteSession` esisteva gia in
    // users.js ma non veniva mai chiamata da nessuna rotta. Non fallisce
    // se il token e gia scaduto/assente: un logout deve poter sempre
    // "riuscire" dal punto di vista del client.
    if (action === 'logout') {
      if (token) await deleteSession(token);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    log.error('Auth error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handler, { maxRequests: 30, prefix: 'auth' });
