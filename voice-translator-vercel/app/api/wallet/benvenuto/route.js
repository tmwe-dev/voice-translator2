import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { getSession } from '../../../lib/users.js';
import { BONUS_BENVENUTO_SECONDI, formattaDurata } from '../../../wallet/tariffe.js';
// b.363 — questo file non aveva alcun registro: ogni suo guasto usciva
// dalla porta senza lasciare una riga da nessuna parte.
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('walletBenvenuto');

// POST /api/wallet/benvenuto — regala i minuti di benvenuto, UNA volta.
//
// Sicurezza: l'email NON arriva dal client — arriva dalla SESSIONE
// verificata (token). Nessuno puo' farmare bonus con email inventate.
// Il "una volta sola" lo garantisce il DB (indice unico su tipo=benvenuto).
async function handlePost(req) {
  try {
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'token mancante' }, { status: 401 });

    const sessione = await getSession(token);
    if (!sessione?.email) return NextResponse.json({ error: 'sessione non valida' }, { status: 401 });

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } });

    const { error } = await db.from('credit_ledger').insert({
      user_id: sessione.email.toLowerCase(),
      tipo: 'benvenuto',
      secondi: BONUS_BENVENUTO_SECONDI,
      dettaglio: { nota: 'bonus primo accesso' },
    });

    // 23505 = bonus gia' dato in passato: va benissimo, non e' un errore
    if (error && error.code !== '23505') {
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. L'utente nuovo restava senza minuti e nessuno lo sapeva.
      log.error('Bonus di benvenuto non accreditato', { err: error?.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      nuovo: !error,
      testo: formattaDurata(BONUS_BENVENUTO_SECONDI),
    });
  } catch (e) {
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. Tutto il ramo di guasto era muto.
    log.error('Bonus di benvenuto: errore imprevisto', { err: e?.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'wallet-benvenuto' });
