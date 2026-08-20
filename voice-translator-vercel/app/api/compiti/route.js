import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession } from '../../lib/users.js';
import { salvaJob, elencaJobs, cambiaStatoJob, eliminaJob, salvaMateriale, elencaMateriali, leggiMateriale } from '../../lib/compagni/compiti.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('compiti');

// ═══════════════════════════════════════════════════════════════
// /api/compiti — l'agenda di studio e i materiali (b.332).
// Tutto richiede l'account: sono dati personali dello studente.
// Azioni: elenca | salva | stato | elimina · materiali | salvaMateriale |
// leggiMateriale.
// ═══════════════════════════════════════════════════════════════

async function handlePost(req) {
  try {
    const body = await req.json();
    const azione = typeof body.azione === 'string' ? body.azione : '';
    const userToken = typeof body.userToken === 'string' ? body.userToken : null;
    const sessione = userToken ? await getSession(userToken) : null;
    if (!sessione?.email) return NextResponse.json({ error: 'Accedi per usare i Compiti' }, { status: 401 });
    const email = sessione.email;

    if (azione === 'elenca') return NextResponse.json({ ok: true, jobs: await elencaJobs(email) });
    if (azione === 'salva') {
      const salvato = await salvaJob(email, body.job || {});
      return salvato ? NextResponse.json({ ok: true, job: salvato })
        : NextResponse.json({ error: 'Salvataggio non riuscito' }, { status: 500 });
    }
    if (azione === 'stato') {
      const ok = await cambiaStatoJob(email, String(body.id || ''), String(body.stato || ''));
      return NextResponse.json({ ok });
    }
    if (azione === 'elimina') {
      const ok = await eliminaJob(email, String(body.id || ''));
      return NextResponse.json({ ok });
    }
    if (azione === 'materiali') return NextResponse.json({ ok: true, materiali: await elencaMateriali(email) });
    if (azione === 'salvaMateriale') {
      const salvato = await salvaMateriale(email, body.materiale || {});
      return salvato ? NextResponse.json({ ok: true, materiale: salvato })
        : NextResponse.json({ error: 'Materiale non salvato' }, { status: 500 });
    }
    // b.333 — OCR con l'AI (il gradino a pagamento della cascata): la foto
    // degli appunti diventa testo fedele + una tabella strutturata. Costa
    // frazioni di centesimo dal wallet dell'UTENTE (il gradino gratis e
    // incollare il testo). L'immagine arriva gia rimpicciolita dal client.
    if (azione === 'ocr') {
      const img = typeof body.immagine === 'string' ? body.immagine : '';
      const { leggiImmagine } = await import('../../lib/compagni/ponte.js');
      const r = await leggiImmagine({
        immagineDataUrl: img,
        istruzione: `Trascrivi FEDELMENTE tutto il testo di questa pagina di appunti/libro (niente riassunti, niente aggiunte). Poi strutturala. Rispondi SOLO con JSON valido:
{"titolo":"un titolo breve per questo materiale","testo":"la trascrizione fedele completa","tabella":{"sezioni":[{"voce":"titoletto o concetto","contenuto":"il testo di quella parte"}]}}`,
        userToken,
      });
      if (!r.ok) {
        if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
        return NextResponse.json({ error: 'Lettura non riuscita', motivo: r.motivo }, { status: 502 });
      }
      const { estraiJSON } = await import('../../lib/compagni/corsi/generatore.js');
      const d = estraiJSON(r.testo);
      if (d && typeof d === 'object' && d.testo) {
        return NextResponse.json({ ok: true, titolo: String(d.titolo || '').slice(0, 160), testo: String(d.testo).slice(0, 40000), tabella: d.tabella && typeof d.tabella === 'object' ? d.tabella : null });
      }
      // JSON non riuscito: la trascrizione grezza vale comunque.
      return NextResponse.json({ ok: true, titolo: '', testo: r.testo.slice(0, 40000), tabella: null });
    }

    if (azione === 'leggiMateriale') {
      const m = await leggiMateriale(email, String(body.id || ''));
      return m ? NextResponse.json({ ok: true, materiale: m })
        : NextResponse.json({ error: 'Materiale non trovato' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'compiti' });
