import { NextResponse, after } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagno } from '../../../lib/compagni/persistenza.js';
import { lezioniProfonde, domandePerLivello } from '../../../lib/compagni/corsi/catalogo.js';
import { generaSyllabus, generaLezione, generaQuiz } from '../../../lib/compagni/corsi/generatore.js';
import { pubblicaCorso, elencaCorsiPubblici } from '../../../lib/compagni/corsi/pubblici.js';
import { leggiOsservazioni, aggiungiOsservazioni, leggiProgresso, salvaEsito } from '../../../lib/compagni/corsi/studente.js';

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
    const sessione = userToken ? await getSession(userToken) : null;
    const docente = body.docenteId ? await risolviCompagno(body.docenteId, sessione?.email) : null;

    const rispostaEsito = (r) => {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      return NextResponse.json({ error: 'Generazione non riuscita', motivo: r.motivo }, { status: 502 });
    };

    if (azione === 'syllabus') {
      if (!argomento) return NextResponse.json({ error: 'Serve un argomento' }, { status: 400 });
      const nLezioni = lezioniProfonde(livello);   // b.301 PUNTO 5
      const r = await generaSyllabus({ argomento, categoria, livello, lingua, docente, nLezioni, direzione: body.direzione || '' }, { userToken });
      if (!r.ok) return rispostaEsito(r);
      return NextResponse.json({ ok: true, argomento, categoria, livello, lezioni: r.lezioni });
    }

    if (azione === 'lezione') {
      const lezione = body.lezione;
      if (!argomento || !lezione?.titolo) return NextResponse.json({ error: 'Servono argomento e lezione' }, { status: 400 });
      // b.242 — il Maestro RICORDA: cosa sa di questa persona e dove siete
      // arrivati nel corso. Due letture leggere, nessuna chiamata al modello
      // in piu; se l'utente non ha un account, semplicemente non c'e ricordo.
      const [osservazioni, progresso] = sessione?.email
        ? await Promise.all([leggiOsservazioni(sessione.email), leggiProgresso(sessione.email, argomento)])
        : [[], []];
      const r = await generaLezione({ argomento, categoria, lezione, livello, lingua, docente, osservazioni, progresso }, { userToken });
      if (!r.ok) return rispostaEsito(r);
      // b.244 — quello che il Maestro ha notato di questa persona si salva
      // DOPO aver risposto: la lezione non deve aspettare.
      if (sessione?.email && r.osservazioni?.length) {
        after(() => aggiungiOsservazioni(sessione.email, r.osservazioni).catch(() => {}));
      }
      return NextResponse.json({ ok: true, contenuto: r.contenuto, fonti: r.fonti });
    }

    if (azione === 'quiz') {
      const lezione = body.lezione;
      if (!lezione?.titolo) return NextResponse.json({ error: 'Serve la lezione' }, { status: 400 });
      // b.231 — passiamo il CONTENUTO reale della lezione (generato prima):
      // così il quiz chiede solo ciò che è stato insegnato.
      const contenuto = typeof body.contenuto === 'string' ? body.contenuto : '';
      // b.240 — anche la prova passa dal docente scelto: e lui che sfida.
      const [oss, prog] = sessione?.email
        ? await Promise.all([leggiOsservazioni(sessione.email), leggiProgresso(sessione.email, argomento)])
        : [[], []];
      // b.301 PUNTO 7: quante domande secondo il livello.
      const nDomande = domandePerLivello(livello);
      const r = await generaQuiz(lezione, { lingua, userToken, nDomande, livello, contenuto, argomento, docente, osservazioni: oss, progresso: prog });
      if (!r.ok) return rispostaEsito(r);
      return NextResponse.json({ ok: true, domande: r.domande });
    }

    // b.244 — il CAMMINO fatto: serve alla vista del progresso e a sapere
    // quali lezioni sono aperte.
    if (azione === 'progresso') {
      if (!sessione?.email) return NextResponse.json({ ok: true, progresso: [] });
      return NextResponse.json({ ok: true, progresso: await leggiProgresso(sessione.email, argomento) });
    }

    // b.242 — REGISTRA com'e andata: e cio che rende possibili la
    // motivazione ("guarda dov'eri"), il ripasso mirato e un percorso che si
    // adatta. Senza account non si salva niente, e va bene cosi.
    if (azione === 'esito') {
      if (!sessione?.email) return NextResponse.json({ ok: true, salvato: false });
      const indice = Number(body.lezioneIndice) || 0;
      const punteggio = body.punteggio === null || body.punteggio === undefined ? null : Number(body.punteggio);
      const daRivedere = Array.isArray(body.daRivedere) ? body.daRivedere.slice(0, 15).map(t => String(t).slice(0, 160)) : [];
      const osservazioni = Array.isArray(body.osservazioni) ? body.osservazioni.slice(0, 6).map(t => String(t).slice(0, 160)) : [];
      const salvato = await salvaEsito(sessione.email, { corso: argomento, lezione: indice, punteggio, daRivedere });
      if (osservazioni.length) await aggiungiOsservazioni(sessione.email, osservazioni);
      return NextResponse.json({ ok: true, salvato });
    }

    // b.228 — libreria condivisa: sfoglia i corsi disponibili (nessun account
    // richiesto per SFOGLIARE) e pubblica un corso (richiede l'account).
    if (azione === 'disponibili') {
      const corsi = await elencaCorsiPubblici({
        soloBambini: body.soloBambini === true,
        lingua: typeof body.linguaFiltro === 'string' ? body.linguaFiltro : null,
        categoria: typeof body.categoriaFiltro === 'string' ? body.categoriaFiltro : null,
      });
      return NextResponse.json({ ok: true, corsi });
    }

    if (azione === 'pubblica') {
      if (!sessione?.email) return NextResponse.json({ error: 'Accedi per pubblicare un corso' }, { status: 401 });
      const salvato = await pubblicaCorso(sessione.email, {
        titolo: body.titolo || argomento, argomento, categoria, livello, lingua,
        perBambini: livello === 'bambino' || body.perBambini === true,
        lezioni: Array.isArray(body.lezioni) ? body.lezioni : [],
        docente: docente ? { nome: docente.nome, ruolo: docente.ruolo, avatar: docente.avatar } : null,
      });
      if (!salvato) return NextResponse.json({ error: 'Pubblicazione non riuscita' }, { status: 500 });
      return NextResponse.json({ ok: true, corso: salvato });
    }

    return NextResponse.json({ error: 'Azione sconosciuta' }, { status: 400 });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Genera contenuto AI: tetto di frequenza basso.
// b.205 — la generazione lunga di Life puo superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;
export const POST = withApiGuard(handlePost, { maxRequests: 15, prefix: 'compagni-corso' });
