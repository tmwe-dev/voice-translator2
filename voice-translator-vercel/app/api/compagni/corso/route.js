import { NextResponse, after } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagno } from '../../../lib/compagni/persistenza.js';
import { lezioniProfonde, domandePerLivello } from '../../../lib/compagni/corsi/catalogo.js';
import { generaSyllabus, generaLezione, generaQuiz, generaRispostaDomanda } from '../../../lib/compagni/corsi/generatore.js';
import { pubblicaCorso, elencaCorsiPubblici } from '../../../lib/compagni/corsi/pubblici.js';
import { leggiOsservazioni, aggiungiOsservazioni, leggiProgresso, salvaEsito } from '../../../lib/compagni/corsi/studente.js';
import { salvaCorsoUtente, mieiCorsi, segnaUltimaLezione, leggiProfiloStudente, salvaProfiloStudente, contestoProfilo, aggiornaProfiloPronuncia } from '../../../lib/compagni/corsi/biblioteca.js';

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
      // b.358 — il motivo del guasto finiva SOLO nella risposta, e il client
      // lo buttava: quando a Luca non nasceva piu il corso, nei registri di
      // produzione non c'era una riga per capire perche. Ora si scrive.
      log.warn('generazione non riuscita', { azione, motivo: r.motivo || 'ignoto', argomento: argomento.slice(0, 120), livello, categoria });
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
      const [osservazioni, progresso, datiProfilo] = sessione?.email
        ? await Promise.all([leggiOsservazioni(sessione.email), leggiProgresso(sessione.email, argomento), leggiProfiloStudente(sessione.email)])
        : [[], [], null];
      // b.321 — Ondata A/B: il Maestro CONOSCE chi ha davanti (Learner
      // Profile) e rispetta la durata di sessione scelta.
      const notaPersona = contestoProfilo(datiProfilo);
      const durata = datiProfilo?.preferenze?.durata || body.durata || '';
      // b.333 — LEZIONE DAL MATERIALE (Compiti): se arriva materialeId, la
      // lezione si fonda esclusivamente su quel materiale dello studente.
      let materialeTesto = '';
      if (typeof body.materialeId === 'string' && body.materialeId && sessione?.email) {
        const { leggiMateriale } = await import('../../../lib/compagni/compiti.js');
        const m = await leggiMateriale(sessione.email, body.materialeId);
        materialeTesto = m?.testo || '';
      }
      const r = await generaLezione({ argomento, categoria, lezione, livello, lingua, docente, osservazioni, progresso, notaPersona, durata, materialeTesto, ripasso: body.ripasso === true }, { userToken });
      if (!r.ok) return rispostaEsito(r);
      // b.244 — quello che il Maestro ha notato di questa persona si salva
      // DOPO aver risposto: la lezione non deve aspettare.
      if (sessione?.email && r.osservazioni?.length) {
        after(() => aggiungiOsservazioni(sessione.email, r.osservazioni).catch(() => {}));
      }
      // b.363 — la lezione dice anche se le fonti NON si sono trovate: era
      // gia scritto nel generatore ma la rotta lo buttava via, e una lezione
      // di materia certificata senza un solo documento arrivava a schermo
      // identica a una fondata sulle fonti.
      return NextResponse.json({ ok: true, contenuto: r.contenuto, fonti: r.fonti, fontiNonTrovate: !!r.fontiNonTrovate });
    }

    // b.313 — "alzo la mano e chiedo": lo studente interrompe la lezione,
    // il Maestro risponde nel personaggio, ancorato al pezzo in corso.
    if (azione === 'domanda') {
      const modo = body.modo === 'ripresa' ? 'ripresa' : 'risposta';
      const domanda = typeof body.domanda === 'string' ? body.domanda : '';
      if (modo === 'risposta' && !domanda.trim()) return NextResponse.json({ error: 'Serve la domanda' }, { status: 400 });
      const sezione = typeof body.sezione === 'string' ? body.sezione : (typeof body.contenuto === 'string' ? body.contenuto : '');
      const storia = Array.isArray(body.storia) ? body.storia.slice(-10).map((t) => ({ ruolo: t?.ruolo === 'maestro' ? 'maestro' : 'studente', testo: String(t?.testo || '').slice(0, 600) })) : [];
      const prossime = Array.isArray(body.prossime) ? body.prossime.slice(0, 2).map((p) => String(p || '').slice(0, 900)) : [];
      const r = await generaRispostaDomanda({ argomento, lezione: body.lezione, sezione, prossime, domanda, storia, modo, livello, lingua, docente }, { userToken });
      if (!r.ok) return rispostaEsito(r);
      return NextResponse.json({ ok: true, risposta: r.risposta, salta: r.salta || 0 });
    }

    // b.335 — I 5 ASSI della conversazione libera (Modulo Lingue): mai un
    // numero solo. Pronuncia qui NON si valuta (serve l'audio): dagli scritti
    // si giudicano GRAMMATICA, VOCABOLARIO, FLUIDITA (scorrevolezza delle
    // frasi), CONTENUTO (quanto dici davvero) e COMPRENSIBILITA. Separati.
    if (azione === 'cinqueAssi') {
      const turni = Array.isArray(body.turni) ? body.turni.slice(-10).map((t) => String(t || '').slice(0, 400)) : [];
      const linguaStudiata = typeof body.linguaStudiata === 'string' ? body.linguaStudiata.slice(0, 8) : 'en';
      if (!turni.length) return NextResponse.json({ error: 'Servono i turni' }, { status: 400 });
      const { generaTesto } = await import('../../../lib/compagni/ponte.js');
      const { estraiJSON } = await import('../../../lib/compagni/corsi/generatore.js');
      const system = `Sei un insegnante madrelingua di ${linguaStudiata}. Valuti la produzione SCRITTA di uno studente su CINQUE assi SEPARATI, mai mischiati. Onesto ma incoraggiante. Rispondi SOLO con JSON valido.`;
      const prompt = 'Turni dello studente (in ' + linguaStudiata + '):\n'
        + turni.map((t, i) => (i + 1) + '. ' + t).join('\n')
        + '\n\nValuta 0-100 ogni asse, con UNA riga di consiglio concreto ciascuno, in lingua ' + lingua + ':\n'
        + '{"comprensibilita":{"voto":0,"consiglio":"..."},"grammatica":{"voto":0,"consiglio":"..."},"vocabolario":{"voto":0,"consiglio":"..."},"fluidita":{"voto":0,"consiglio":"..."},"contenuto":{"voto":0,"consiglio":"..."}}';
      const r = await generaTesto({ system, prompt, userToken, maxTokens: 500, temperature: 0.3 });
      if (!r.ok) return rispostaEsito(r);
      const d = estraiJSON(r.testo);
      const assi = {};
      for (const k of ['comprensibilita', 'grammatica', 'vocabolario', 'fluidita', 'contenuto']) {
        const v2 = d?.[k] || {};
        assi[k] = { voto: Math.max(0, Math.min(100, Number(v2.voto) || 0)), consiglio: String(v2.consiglio || '').slice(0, 200) };
      }
      return NextResponse.json({ ok: true, assi });
    }

    // b.331 — DRILL delle coppie minime: da una parola andata male nasce
    // l'esercizio mirato sul suono che inganna (Teaching Policy).
    if (azione === 'drill') {
      const parola = typeof body.parola === 'string' ? body.parola.trim().slice(0, 40) : '';
      if (!parola) return NextResponse.json({ error: 'Serve la parola' }, { status: 400 });
      const { promptDrill } = await import('../../../lib/compagni/corsi/lingua.js');
      const { generaTesto } = await import('../../../lib/compagni/ponte.js');
      const { estraiJSON } = await import('../../../lib/compagni/corsi/generatore.js');
      const linguaStudiata = typeof body.linguaStudiata === 'string' ? body.linguaStudiata.slice(0, 8) : 'en';
      const { system, prompt } = promptDrill({ parola, lingua: linguaStudiata, linguaParlata: lingua });
      const r = await generaTesto({ system, prompt, userToken, maxTokens: 260, temperature: 0.4 });
      if (!r.ok) return rispostaEsito(r);
      const d = estraiJSON(r.testo);
      const coppie = Array.isArray(d?.coppie) ? d.coppie.filter((c) => c?.a && c?.b).slice(0, 3).map((c) => ({ a: String(c.a).slice(0, 40), b: String(c.b).slice(0, 40) })) : [];
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Non si distingueva un modello muto da un guasto vero.
      if (!coppie.length) {
        log.warn('Corso: il modello non ha prodotto nessuna coppia utilizzabile');
        return NextResponse.json({ error: 'Drill non riuscito' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, suono: String(d?.suono || '').slice(0, 160), coppie });
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

    // ── b.321 · ONDATA A — LA BIBLIOTECA DEI CORSI DELL'UTENTE ──
    // Il corso si SALVA (syllabus stabile) e si riprende: niente piu
    // rigenerazioni pagate per contenuto gia visto, niente progresso
    // disallineato. Piu percorsi insieme, ciascuno col suo segnalibro.
    if (azione === 'salvaCorsoMio') {
      if (!sessione?.email) return NextResponse.json({ error: 'Accedi per salvare i tuoi corsi' }, { status: 401 });
      const salvato = await salvaCorsoUtente(sessione.email, {
        argomento, titolo: body.titolo, categoria, livello, lingua,
        // b.374 — la lingua CHE SI STUDIA arriva dalla sezione Lingue di
        // Impara. Si accetta solo un codice breve e pulito: e un dato che
        // finisce nel database, non una frase.
        linguaStudiata: typeof body.linguaStudiata === 'string' && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(body.linguaStudiata)
          ? body.linguaStudiata : null,
        docenteId: body.docenteId, lezioni: Array.isArray(body.lezioni) ? body.lezioni : [],
        obiettivoId: typeof body.obiettivoId === 'string' ? body.obiettivoId.slice(0, 80) : null,
      });
      return NextResponse.json({ ok: true, salvato: !!salvato });
    }
    if (azione === 'mieiCorsi') {
      if (!sessione?.email) return NextResponse.json({ ok: true, corsi: [] });
      return NextResponse.json({ ok: true, corsi: await mieiCorsi(sessione.email) });
    }
    if (azione === 'segnalibro') {
      if (sessione?.email && argomento) await segnaUltimaLezione(sessione.email, argomento, body.indice);
      return NextResponse.json({ ok: true });
    }
    // ── b.321 · profilo dello studente (Learner Profile + preferenze) ──
    if (azione === 'profiloStudente') {
      if (!sessione?.email) return NextResponse.json({ ok: true, dati: null });
      return NextResponse.json({ ok: true, dati: await leggiProfiloStudente(sessione.email) });
    }
    if (azione === 'salvaProfiloStudente') {
      if (!sessione?.email) return NextResponse.json({ error: 'Accedi per salvare il profilo' }, { status: 401 });
      const ok = await salvaProfiloStudente(sessione.email, { profilo: body.profilo, comunicazione: body.comunicazione, preferenze: body.preferenze });
      return NextResponse.json({ ok });
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
      // b.321 — Ondata C: se l'esito e di PRONUNCIA, aggiorna anche il
      // profilo pronuncia persistente (errori ricorrenti + trend): e da li
      // che nascono i drill mirati e i ritorni futuri.
      let ricorrenti = [];
      if (body.tipo === 'pronuncia' && typeof body.linguaStudiata === 'string') {
        try {
          const profilo = await aggiornaProfiloPronuncia(sessione.email, body.linguaStudiata.slice(0, 8), { punteggio, parole: daRivedere });
          // b.334 — DRILL AUTOMATICO (Teaching Policy, deciso): la parola
          // sbagliata per la SECONDA volta torna come esercizio da sola.
          const insistenti = new Set((profilo?.errori || []).filter((e) => e.volte >= 2).map((e) => e.parola));
          ricorrenti = daRivedere.map((w) => String(w).toLowerCase()).filter((w) => insistenti.has(w)).slice(0, 2);
        } catch { /* il profilo pronuncia e un di piu: l'esito resta salvato */ }
      }
      return NextResponse.json({ ok: true, salvato, ricorrenti });
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
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Un corso generato (e pagato) andava perso senza traccia.
      if (!salvato) {
        log.error('Corso: pubblicazione non salvata');
        return NextResponse.json({ error: 'Pubblicazione non riuscita' }, { status: 500 });
      }
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
