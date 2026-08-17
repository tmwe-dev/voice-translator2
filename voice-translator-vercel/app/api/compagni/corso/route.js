import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getCompagnoPredefinito } from '../../../lib/compagni/catalogo.js';
import { lezioniPerLivello } from '../../../lib/compagni/corsi/catalogo.js';
import { generaSyllabus, generaLezione, generaQuiz } from '../../../lib/compagni/corsi/generatore.js';

const log = createLogger('compagni-corso');

// ═══════════════════════════════════════════════════════════════
// /api/compagni/corso — genera un percorso di studio, un pezzo alla
// volta. Tre azioni:
//   syllabus → l'elenco lezioni per un argomento/livello
//   lezione  → il contenuto di una lezione (fonti reali se materia certificata)
//   quiz     → il quiz di una lezione
//
// La scrittura e le fonti passano SOLO dalla cerniera (ponte), quindi dal
// wallet e dallo scraper SSRF-safe di BarTalk. Modulo Life autonomo: qui
// si importa solo il dominio corsi, mai le funzioni interne di BarTalk.
//
// Il docente può essere un Compagno (la sua personalità dà il tono).
// ═══════════════════════════════════════════════════════════════

async function handlePost(req) {
  try {
    const body = await req.json();
    const azione = typeof body.azione === 'string' ? body.azione : '';
    const userToken = typeof body.userToken === 'string' ? body.userToken : null;
    const lingua = typeof body.lingua === 'string' ? body.lingua.slice(0, 8) : 'it';
    const argomento = typeof body.argomento === 'string' ? body.argomento.trim().slice(0, 200) : '';
    const categoria = typeof body.categoria === 'string' ? body.categoria : 'altro';
    const livello = typeof body.livello === 'string' ? body.livello : 'base';
    const docente = body.docenteId ? getCompagnoPredefinito(body.docenteId) : null;

    const rispostaEsito = (r) => {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      return NextResponse.json({ error: 'Generazione non riuscita', motivo: r.motivo }, { status: 502 });
    };

    if (azione === 'syllabus') {
      if (!argomento) return NextResponse.json({ error: 'Serve un argomento' }, { status: 400 });
      const nLezioni = lezioniPerLivello(livello);
      const r = await generaSyllabus({ argomento, categoria, livello, lingua, docente, nLezioni, direzione: body.direzione || '' }, { userToken });
      if (!r.ok) return rispostaEsito(r);
      return NextResponse.json({ ok: true, argomento, categoria, livello, lezioni: r.lezioni });
    }

    if (azione === 'lezione') {
      const lezione = body.lezione;
      if (!argomento || !lezione?.titolo) return NextResponse.json({ error: 'Servono argomento e lezione' }, { status: 400 });
      const r = await generaLezione({ argomento, categoria, lezione, livello, lingua, docente }, { userToken });
      if (!r.ok) return rispostaEsito(r);
      return NextResponse.json({ ok: true, contenuto: r.contenuto, fonti: r.fonti });
    }

    if (azione === 'quiz') {
      const lezione = body.lezione;
      if (!lezione?.titolo) return NextResponse.json({ error: 'Serve la lezione' }, { status: 400 });
      const r = await generaQuiz(lezione, { lingua, userToken });
      if (!r.ok) return rispostaEsito(r);
      return NextResponse.json({ ok: true, domande: r.domande });
    }

    return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Genera contenuto AI: tetto di frequenza basso.
export const POST = withApiGuard(handlePost, { maxRequests: 15, prefix: 'compagni-corso' });
