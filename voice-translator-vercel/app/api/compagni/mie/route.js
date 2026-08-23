import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { elencaCompagni, salvaCompagno, cancellaCompagno } from '../../../lib/compagni/persistenza.js';
import { dimentica } from '../../../lib/compagni/memoria.js';

const log = createLogger('compagni-mie');

// ═══════════════════════════════════════════════════════════════
// /api/compagni/mie — i Compagni creati dall'utente.
//   azione 'elenco'   → lista
//   azione 'salva'    → crea/aggiorna (serve un nome)
//   azione 'cancella' → rimuove (solo i propri)
//
// L'identità viene SEMPRE dal gettone di sessione (getSession), mai dal
// corpo: nessuno può toccare i Compagni di un altro. Persistenza in tabella
// nostra, non passa dal ponte.
// ═══════════════════════════════════════════════════════════════

async function handlePost(req) {
  try {
    const body = await req.json();
    const azione = typeof body.azione === 'string' ? body.azione : '';
    const userToken = typeof body.userToken === 'string' ? body.userToken : '';

    const sessione = userToken ? await getSession(userToken) : null;
    if (!sessione?.email) return NextResponse.json({ error: 'Accedi per avere i tuoi Compagni' }, { status: 401 });
    const email = sessione.email;

    if (azione === 'elenco') {
      return NextResponse.json({ ok: true, compagni: await elencaCompagni(email) });
    }

    if (azione === 'salva') {
      const c = body.compagno;
      if (!c || !c.nome || !String(c.nome).trim()) return NextResponse.json({ error: 'Serve un nome' }, { status: 400 });
      const salvato = await salvaCompagno(email, c);
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Il compagno spariva e l'utente lo scopriva da solo.
      if (!salvato) {
        log.error('Compagno non salvato');
        return NextResponse.json({ error: 'Salvataggio non riuscito' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, compagno: salvato });
    }

    if (azione === 'cancella') {
      if (!body.id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });
      const fatto = await cancellaCompagno(email, body.id);
      return NextResponse.json({ ok: fatto });
    }

    // b.411 · P1.17 — «DIMENTICA», che esisteva e non si poteva chiedere.
    //
    // `dimentica()` stava in memoria.js da sempre, e il piano promette una
    // memoria «cancellabile». Ma nessuna schermata e nessuna rotta la
    // chiamava: cercato in tutto il progetto, zero chiamanti. Una promessa
    // di privacy che non ha un modo di essere esercitata non e una
    // promessa, e una frase.
    //
    // Vale anche per i PREDEFINITI: un Compagno del catalogo puo avere
    // ricordi tuoi, e non lo si puo cancellare per liberarsene.
    if (azione === 'dimentica') {
      if (!body.id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });
      const fatto = await dimentica(email, String(body.id).slice(0, 96));
      return NextResponse.json({ ok: fatto });
    }

    return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 40, prefix: 'compagni-mie' });
