import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getSession } from '../../lib/users.js';
import { salvaJob, elencaJobs, cambiaStatoJob, eliminaJob, salvaMateriale, elencaMateriali, leggiMateriale, depositaScansione, ritiraScansione } from '../../lib/compagni/compiti.js';
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

    // b.342 — IL TELEFONO COME SCANNER: il deposito della foto arriva dal
    // telefono che ha inquadrato il QR, che puo NON essere loggato — il
    // lasciapassare e il sid usa-e-getta (vita breve, si consuma al ritiro).
    // Sta PRIMA del cancello dell'account, ed e l'unica azione a farlo.
    if (azione === 'scanDeposita') {
      const sid = String(body.sid || '');
      const dato = typeof body.dato === 'string' ? body.dato : '';
      if (!/^[a-z0-9-]{8,64}$/i.test(sid) || !dato.startsWith('data:image/')) {
        return NextResponse.json({ error: 'deposito non valido' }, { status: 400 });
      }
      const ok = await depositaScansione(sid, dato);
      return NextResponse.json({ ok });
    }

    const sessione = userToken ? await getSession(userToken) : null;
    if (!sessione?.email) return NextResponse.json({ error: 'Accedi per usare i Compiti' }, { status: 401 });
    const email = sessione.email;

    // b.342 — il PC ritira la foto depositata dal telefono (e la legge in
    // locale, gratis). Qui il login serve: e la scrivania dello studente.
    if (azione === 'scanRitira') {
      const dato = await ritiraScansione(String(body.sid || ''));
      return NextResponse.json({ ok: true, dato: dato || null });
    }

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

    // b.334 — PDF: il testo si estrae LATO SERVER, gratis (niente AI):
    // dispense e capitoli entrano nei Materiali senza toccare il wallet.
    if (azione === 'pdf') {
      const b64 = typeof body.pdf === 'string' ? body.pdf.replace(/^data:application\/pdf;base64,/, '') : '';
      if (!b64) return NextResponse.json({ error: 'PDF mancante' }, { status: 400 });
      try {
        const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
        const buf = Buffer.from(b64, 'base64');
        const out = await pdfParse(buf, { max: 30 }); // fino a 30 pagine
        const testo = (out?.text || '').trim().slice(0, 40000);
        if (!testo) return NextResponse.json({ error: 'PDF senza testo leggibile (scansione? usa la foto)' }, { status: 422 });
        return NextResponse.json({ ok: true, testo, pagine: out?.numpages || 0 });
      } catch (e) {
        log.warn('pdf non leggibile:', e?.message);
        return NextResponse.json({ error: 'PDF non leggibile' }, { status: 422 });
      }
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

// b.334 — BUG mio corretto: il tetto standard di 256KB avrebbe respinto la
// FOTO degli appunti (413) prima ancora dell'OCR. Le foto rimpicciolite e i
// PDF stanno larghi in 6MB.
export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'compiti', maxBodySize: 6 * 1024 * 1024 });
