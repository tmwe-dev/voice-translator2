import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession, getUser, updateUser, saveApiKeys, getCredits, getPaymentHistory, deleteUserData, maskApiKeys } from '../../lib/users.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('user');

// ═══════════════════════════════════════════════════════════════
// b.422 — LE PREFERENZE NON SONO MAI STATE SU SUPABASE.
//
// Questa rotta aveva due azioni per tenere allineate le preferenze fra
// telefono e server: `get-prefs` (GET) e `sync-prefs` (PUT). Tutte e due
// cominciavano da `getProfileByEmail`, che leggeva `public.profiles`, e
// scrivevano/leggevano `public.user_settings`. Verificato sul database
// vivo di produzione: NESSUNA DELLE DUE TABELLE ESISTE.
//
// Conseguenza, per tutto il tempo in cui il codice e stato in piedi:
// `get-prefs` rispondeva sempre `{ prefs: {} }` e `sync-prefs` sempre
// «No Supabase profile yet — sync skipped». Nessun cliente le chiamava
// (verificato: zero riferimenti nel client — le preferenze vivono nella
// memoria del telefono, vedi savePrefs in app/page.js), quindi non si
// perde niente: si toglie solo la mappa di due strade che non portavano
// da nessuna parte, e con lei ottanta righe di conversione fra nomi di
// colonne che non esistono.
// ═══════════════════════════════════════════════════════════════


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
      // Don't send full API keys - mask them (b.166 — formula centralizzata in users.js)
      return NextResponse.json({ user: maskApiKeys(user) });
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
    // b.168 — CONFERMATO (audit esterno 15/8): il messaggio dichiarava
    // "All your data has been deleted" in modo assoluto, ma
    // deleteUserData() cancellava solo le chiavi su Redis e la sessione
    // CORRENTE. Il messaggio fu corretto per dire esattamente quello.
    //
    // b.415 — ADESSO E' IL COMPORTAMENTO A ESSERE CAMBIATO, non la frase.
    // Due delle tre riserve scritte qui sopra non valgono piu:
    //   - le sessioni sugli ALTRI dispositivi ora si revocano subito
    //     (l'indice sessioni-per-utente, che «oggi non esiste», adesso
    //     esiste: lo scrive createSession in users.js);
    //   - i dati su Supabase ora si cancellano (Compagni, ricordi, corsi,
    //     compiti, profilo studente, pronuncia, dispositivi PeepOff).
    // Resta il portafoglio, per obbligo contabile — quella riserva era
    // giusta allora ed e giusta adesso. E restano i contenuti pubblici di
    // Mondo, che sono una DECISIONE DI PRODOTTO in sospeso, non una
    // dimenticanza: una discussione contiene le risposte di altri.
    //
    // Questo commento e stato riscritto perche descriveva un codice che
    // non c'e piu. Un commento che mente costa piu di un commento assente.
    if (action === 'delete-data') {
      const result = await deleteUserData(email, token);
      return NextResponse.json({
        ok: true,
        // b.415 — LA FRASE DICE QUELLO CHE SUCCEDE, e cambia perche e
        // cambiato cio che succede: adesso spariscono anche i Compagni,
        // i loro ricordi, i corsi, i compiti, il profilo studente, gli
        // errori di pronuncia e i dispositivi PeepOff — che prima
        // restavano tutti su Supabase — e TUTTE le sessioni, non solo
        // questa. Restano il portafoglio (obbligo di legge) e i
        // contenuti pubblici di Mondo, che non sono solo tuoi: una
        // discussione contiene le risposte di altre persone, e
        // cancellarla o anonimizzarla e una decisione di prodotto.
        message: 'Deleted: profile, ALL sessions (every device, immediately), referrals, lending tokens, all your Life data — Companions, their memories, courses, homework, student profile, pronunciation history and PeepOff devices — and your Mondo activity: who you follow, your likes and the reports you filed. Retained: wallet accounting records (legal/bookkeeping obligation) and your public Mondo posts, which contain other people\'s replies — ask us and we will handle those case by case.',
        deleted: result.deleted,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    log.error('User error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET /api/user - Retrieve user data (supports action query param)
async function handleGet(req) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    // SECURITY: tokens ONLY via Authorization header — never from query string (logged by proxies/CDNs)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Authenticate
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    // === GET PROFILE ===
    if (action === 'profile') {
      const user = await getUser(session.email);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      return NextResponse.json({
        email: session.email,
        name: user.name || null,
        tier: user.tier || 'free',
        credits: user.credits || 0,
        clonedVoiceId: user.clonedVoiceId || null,
        clonedVoiceName: user.clonedVoiceName || null,
        useOwnKeys: user.useOwnKeys || false,
        createdAt: user.createdAt || null,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    log.error('User GET error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'user' });
export const GET = withApiGuard(handleGet, { maxRequests: 60, prefix: 'user' });
