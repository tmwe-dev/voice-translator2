import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagni } from '../../../lib/compagni/persistenza.js';
import { promptTavolo, promptSintesi, TAVOLO_MAX } from '../../../lib/compagni/tavolo.js';
import { analizzaConvergenza, istruzioneConvergenza } from '../../../lib/compagni/orchestratore.js';
import { formattaObiettivi } from '../../../lib/compagni/obiettivi.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';
import { temperaturaLiberta, staccaEsito } from '../../../lib/compagni/contratto.js';

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
    for (const c of compagni) {
      // b.303 — SKIP ANTI-CONSENSO: chi non ha niente di nuovo da
      // aggiungere tace, come al bar. Ma non lascia mai il giro vuoto.
      //
      // b.363 — il cancello era calcolato UNA volta sola, prima del ciclo,
      // sugli stessi tre valori per tutti: se scattava, dopo il primo che
      // rispondeva venivano zittiti in blocco TUTTI gli altri, e un tavolo
      // di quattro si riduceva sempre a una voce sola. Ora chi tace lo
      // decide da se, col canale esito di b.362 ("passo"), che guarda quel
      // singolo compagno e quel singolo turno.
      const { system, prompt } = promptTavolo({ compagno: c, storia, ultimoUmano, altriQuestoGiro, obiettivo, convergenza, lingua, briefing });
      const r = await generaTesto({ system: system + bloccoObiettivi, prompt, provider: c.provider, modello: c.modello, userToken, maxTokens: 260, temperature: temperaturaLiberta(c.liberta) });
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
