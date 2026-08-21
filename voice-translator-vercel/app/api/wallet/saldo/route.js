import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { getSession } from '../../../lib/users.js';
import { saldo, usoOggiEMese, storicoAcquisti } from '../../../wallet/contabilita.js';
import { coloreBatteria, formattaDurata, BATTERIA } from '../../../wallet/tariffe.js';
// b.363 — questo file non aveva alcun registro: ogni suo guasto usciva
// dalla porta senza lasciare una riga da nessuna parte.
import { createLogger } from '../../../lib/logger.js';

const log = createLogger('walletSaldo');

// GET /api/wallet/saldo — saldo, uso e storico DELL'UTENTE LOGGATO.
// L'identità arriva dalla SESSIONE (Bearer token), mai da un parametro:
// nessuno può leggere il saldo di un altro indovinandone l'email.
async function handleGet(req) {
  try {
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'token mancante' }, { status: 401 });
    const sessione = await getSession(token);
    if (!sessione?.email) return NextResponse.json({ error: 'sessione non valida' }, { status: 401 });
    const utente = sessione.email.toLowerCase();

    const secondi = await saldo(utente);
    const uso = await usoOggiEMese(utente);
    // Storico ricariche (acquisti, voucher, regali, bonus) per il popup
    const storico = (await storicoAcquisti(utente, 10)).map(r => ({
      quando: String(r.created_at).slice(0, 10),
      tipo: r.tipo,
      testo: '+' + formattaDurata(r.secondi),
      euro: r.dettaglio?.euro ? `€${Number(r.dettaglio.euro).toFixed(2).replace('.', ',')}` : null,
    }));

    return NextResponse.json({
      storico,
      secondi,
      testo: formattaDurata(secondi),
      colore: coloreBatteria(secondi),
      percento: Math.min(100, Math.round((secondi / BATTERIA.riferimentoSecondi) * 100)),
      oggi: formattaDurata(uso.oggi),
      mese: formattaDurata(uso.mese),
    });
  } catch (e) {
    // b.363 — uscita di guasto muta: dal registro sembrava che non
    // fosse successo niente. Il saldo non compariva e non restava traccia del perche.
    log.error('Lettura saldo non riuscita', { err: e?.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withApiGuard(handleGet, { maxRequests: 60, prefix: 'wallet-saldo', skipBodyCheck: true });
