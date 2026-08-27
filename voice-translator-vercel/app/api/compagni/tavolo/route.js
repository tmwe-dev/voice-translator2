import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagni } from '../../../lib/compagni/persistenza.js';
import { promptTavolo, promptSintesi, TAVOLO_MAX } from '../../../lib/compagni/tavolo.js';
import { analizzaConvergenza, istruzioneConvergenza, haAppenaConcordato, rigaAntiEco } from '../../../lib/compagni/orchestratore.js';
import { bloccoSezioni } from '../../../lib/compagni/sezioni.js';
import { formattaObiettivi } from '../../../lib/compagni/obiettivi.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';
import { temperaturaLiberta, temperaturaDibattito, staccaEsito } from '../../../lib/compagni/contratto.js';

const log = createLogger('compagni-tavolo');

// ═══════════════════════════════════════════════════════════════
// /api/compagni/tavolo — tu + 2-4 Compagni che rispondono insieme.
// Per ogni Compagno, in ordine, genera una risposta che vede l'ultimo
// messaggio della persona E cosa hanno già detto gli altri in questo giro.
// Ritorna [{compagnoId, nome, voceId, testo}]. La voce la fa il client.
//
// Superficie autonoma di Life: NON tocca il flusso stanza. Tutto dal
// wallet via cerniera. Identità dal token di sessione.
// ═══════════════════════════════════════════════════════════════

async function handlePost(req) {
  try {
    const body = await req.json();
    const userToken = typeof body.userToken === 'string' ? body.userToken : '';
    const lingua = typeof body.lingua === 'string' ? body.lingua.slice(0, 8) : 'it';
    const ids = Array.isArray(body.compagni) ? body.compagni.slice(0, TAVOLO_MAX) : [];
    const messaggi = Array.isArray(body.messaggi) ? body.messaggi.slice(-20) : [];
    // b.226 — DEBATE: obiettivo comune della tavola + azione 'sintesi'.
    const obiettivo = typeof body.obiettivo === 'string' ? body.obiettivo.slice(0, 300).trim() : '';
    // b.391 — il documento che sta sul tavolo: non un turno, un contesto.
    const briefing = typeof body.briefing === 'string' ? body.briefing.slice(0, 4000).trim() : '';
    const azione = typeof body.azione === 'string' ? body.azione : 'giro';
    // b.533 — la memoria cumulativa e la KB a sezioni (da RadioChat).
    const riassunto = typeof body.riassunto === 'string' ? body.riassunto.slice(0, 1200) : '';
    const sezioniBlocco = bloccoSezioni(body.sezioni, (Array.isArray(body.messaggi) && body.messaggi.length) ? String(body.messaggi[body.messaggi.length - 1].testo || '') : '');
    // b.224 — obiettivi di vita nel prompt: anche al tavolo i Compagni li conoscono.
    const bloccoObiettivi = formattaObiettivi(Array.isArray(body.obiettivi) ? body.obiettivi.slice(0, 12) : []);

    const sessione = userToken ? await getSession(userToken) : null;
    const compagni = await risolviCompagni(ids, sessione?.email);
    if (compagni.length < 2) return NextResponse.json({ error: 'Scegli almeno due Compagni' }, { status: 400 });

    // b.226 — SINTESI: chiude la tavola in un risultato condiviso (neutrale).
    if (azione === 'sintesi') {
      const { system, prompt } = promptSintesi({ obiettivo, discussione: messaggi.map(m => ({ ruolo: m.ruolo, nome: m.nome, testo: m.testo })), lingua });
      // b.308 — la sintesi legge TUTTI i turni: 500 token erano pochi per
      // chiudere davvero. Spazio proporzionato alla mole della discussione.
      const maxTokensSintesi = Math.min(2000, 700 + messaggi.length * 40);
      const r = await generaTesto({ system, prompt, userToken, maxTokens: maxTokensSintesi });
      if (!r.ok) {
        if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
        // b.363 — il motivo esiste: buttarlo lasciava senza traccia i
        // guasti in produzione (stesso buco tappato in corso/route.js).
        log.warn('sintesi non riuscita', { motivo: r.motivo });
        return NextResponse.json({ error: 'Sintesi non riuscita', motivo: r.motivo }, { status: 502 });
      }
      return NextResponse.json({ ok: true, sintesi: r.testo });
    }

    // b.533 — AZIONE 'riassunto': il client manda il pezzo di
    // conversazione uscito dalla finestra (+ il riassunto vecchio) e
    // riceve il verbale aggiornato. E' il livello 3 della memoria di
    // RadioChat, pagato UNA volta ogni tot giri, non a ogni turno.
    if (azione === 'riassunto') {
      const testo = typeof body.testo === 'string' ? body.testo.slice(0, 6000) : '';
      if (!testo.trim()) return NextResponse.json({ error: 'Serve il testo' }, { status: 400 });
      const r = await generaTesto({
        system: `Comprimi conversazioni senza perdere i FATTI. Scrivi nella lingua: ${lingua}.`,
        prompt: `${riassunto ? `Verbale finora:\n${riassunto}\n\n` : ''}Nuovo pezzo di conversazione:\n${testo}\n\nAggiorna il verbale in MASSIMO 8 righe: posizioni di ognuno, dati citati, punti aperti. Niente convenevoli.`,
        userToken, maxTokens: 260,
      });
      if (!r.ok) return NextResponse.json({ error: 'Riassunto non riuscito', motivo: r.motivo }, { status: r.status === 402 ? 402 : 502 });
      return NextResponse.json({ ok: true, riassunto: r.testo.slice(0, 1200) });
    }

    const ultimoUmano = messaggi.length ? (messaggi[messaggi.length - 1].testo || '') : '';
    if (!ultimoUmano.trim()) return NextResponse.json({ error: 'Serve un messaggio' }, { status: 400 });
    const storia = messaggi.slice(0, -1);
    // b.303 — CONVERGENZA COME RADIOCHAT: analizzata dal CONTENUTO reale
    // (stagnano? concordano? divergono?), non dal solo numero di scambi.
    const soloAgenti = messaggi.filter(m => m.ruolo !== 'persona');
    const stato = analizzaConvergenza(soloAgenti, lingua);
    const convergenza = istruzioneConvergenza(stato, lingua);

    const risposte = [];
    const altriQuestoGiro = [];
    let ultimoMotivo = '';
    // b.533 — TURNI SMART (il 70/30 di RadioChat, adattato al tavolo):
    // l'ordine NON e piu sempre quello del catalogo. A ogni giro la
    // partenza RUOTA (chi ha aperto l'ultimo giro non riapre questo), e
    // nel 30% dei casi due vicini si scambiano: il metronomo sparisce,
    // il tavolo respira. Il primo giro resta nell'ordine scelto
    // dall'utente: le bandiere si piantano nell'ordine dei posti.
    const giriFatti = Math.floor(storia.filter(m => m.ruolo !== 'persona').length / Math.max(1, compagni.length));
    let ordine = [...compagni];
    if (giriFatti > 0 && ordine.length > 1) {
      const rot = giriFatti % ordine.length;
      ordine = [...ordine.slice(rot), ...ordine.slice(0, rot)];
      if (Math.random() < 0.3) {
        const i = 1 + Math.floor(Math.random() * (ordine.length - 1));
        const j = i === ordine.length - 1 ? i - 1 : i + 1;
        [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
      }
    }
    for (const c of ordine) {
      // b.303 — SKIP ANTI-CONSENSO: chi non ha niente di nuovo da
      // aggiungere tace, come al bar. Ma non lascia mai il giro vuoto.
      //
      // b.363 — il cancello era calcolato UNA volta sola, prima del ciclo,
      // sugli stessi tre valori per tutti: se scattava, dopo il primo che
      // rispondeva venivano zittiti in blocco TUTTI gli altri, e un tavolo
      // di quattro si riduceva sempre a una voce sola. Ora chi tace lo
      // decide da se, col canale esito di b.362 ("passo"), che guarda quel
      // singolo compagno e quel singolo turno.
      // b.525 — primo giro = nessun intervento di agenti ancora in storia
      const apertura = !storia.some(m => m.ruolo !== 'persona');
      // b.533 — anti-eco personale: chi ha CONCORDATO al giro scorso
      // riceve l'asticella alzata, non il bavaglio (vedi orchestratore).
      const suoUltimo = [...storia].reverse().find(m => m.ruolo === c.nome);
      const antiEco = suoUltimo && haAppenaConcordato(suoUltimo.testo, lingua) ? rigaAntiEco(lingua) : '';
      const { system, prompt } = promptTavolo({ compagno: c, storia, ultimoUmano, altriQuestoGiro, obiettivo, convergenza, lingua, briefing, apertura, riassunto, sezioniBlocco, antiEco });
      const r = await generaTesto({ system: system + bloccoObiettivi, prompt, provider: c.provider, modello: c.modello, userToken, maxTokens: 400, temperature: temperaturaDibattito(c.liberta) });
      if (!r.ok) {
        if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
        if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
        ultimoMotivo = r.motivo || ultimoMotivo;
        log.warn('compagno muto al tavolo', { compagno: c.nome, motivo: r.motivo });
        continue; // un Compagno muto non ferma il tavolo
      }
      // b.362 — L'ESITO TIPIZZATO letto davvero: chi marca "passo" tace
      // (a meno che il giro resti vuoto: allora la sua riga di spiegazione
      // vale come intervento). "domanda" e "risposta" parlano normalmente.
      const { testo, esito } = staccaEsito(r.testo);
      if (!testo) continue;
      if (esito === 'passo' && risposte.length > 0) continue;
      risposte.push({ compagnoId: c.id, nome: c.nome, voceId: c.voce?.id, testo, esito });
      altriQuestoGiro.push({ nome: c.nome, testo });
    }

    if (risposte.length === 0) {
      log.warn('tavolo senza risposte', { motivo: ultimoMotivo });
      return NextResponse.json({ error: 'Nessuna risposta', motivo: ultimoMotivo }, { status: 502 });
    }
    return NextResponse.json({ ok: true, risposte });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// b.205 — la generazione lunga di Life puo superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;
export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'compagni-tavolo' });
