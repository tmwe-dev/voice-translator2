import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { preparaBriefing, sintetizzaReport } from '../../../lib/compagni/dossier.js';

const log = createLogger('compagni-dossier');

// ═══════════════════════════════════════════════════════════════
// /api/compagni/dossier — dall'argomento al documento.
//   azione 'briefing' → cerca fonti + scrive l'articolo da discutere
//   azione 'report'   → dalla discussione scrive il documento finale
//
// Riusa ponte.cerca (ricerca) e ponte.generaTesto (scrittura, dal wallet).
// La discussione in mezzo la fa /api/compagni/podcast. Modulo autonomo.
// ═══════════════════════════════════════════════════════════════

async function handlePost(req) {
  try {
    const body = await req.json();
    const azione = typeof body.azione === 'string' ? body.azione : '';
    const userToken = typeof body.userToken === 'string' ? body.userToken : null;
    const lingua = typeof body.lingua === 'string' ? body.lingua.slice(0, 8) : 'it';
    const argomento = typeof body.argomento === 'string' ? body.argomento.trim().slice(0, 200) : '';

    const esito = (r) => {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Il motivo tornava al client ma non restava da nessuna parte.
      log.warn('Dossier compagno: chiamata al modello non riuscita');
      return NextResponse.json({ error: 'Non riuscito', motivo: r.motivo }, { status: 502 });
    };

    if (azione === 'briefing') {
      if (!argomento) return NextResponse.json({ error: 'Serve un argomento' }, { status: 400 });
      const r = await preparaBriefing({ argomento, lingua, userToken });
      if (!r.ok) return esito(r);
      // b.247 — `fontiGuaste` viaggia fino al client: prima un briefing con
      // zero fonti era indistinguibile da uno scritto mentre la ricerca era
      // rotta, e l'interfaccia mostrava un elenco fonti vuoto senza spiegare
      // perché. Il guasto si dichiara, non si nasconde.
      if (r.fontiGuaste) log.warn('briefing consegnato SENZA fonti (ricerca guasta)', { argomento: argomento.slice(0, 120) });
      return NextResponse.json({ ok: true, articolo: r.articolo, punti: r.punti, domande: r.domande, fonti: r.fonti, fontiGuaste: !!r.fontiGuaste });
    }

    if (azione === 'report') {
      const discussione = typeof body.discussione === 'string' ? body.discussione : '';
      if (!discussione.trim()) return NextResponse.json({ error: 'Serve la discussione' }, { status: 400 });
      const r = await sintetizzaReport({ argomento, briefing: body.briefing || '', discussione, lingua, userToken });
      if (!r.ok) return esito(r);
      return NextResponse.json({ ok: true, report: r.report });
    }

    return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Genera contenuto AI (ricerca + scrittura): tetto di frequenza basso.
// b.205 — la generazione lunga di Life puo superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;
export const POST = withApiGuard(handlePost, { maxRequests: 12, prefix: 'compagni-dossier' });
