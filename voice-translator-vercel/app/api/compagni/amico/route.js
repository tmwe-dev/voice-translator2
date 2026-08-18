import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagno } from '../../../lib/compagni/persistenza.js';
import { ricordiPerContesto, contestoMemoria, estraiRicordi, aggiungiRicordi, tagsDalTesto } from '../../../lib/compagni/memoria.js';
import { formattaObiettivi } from '../../../lib/compagni/obiettivi.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';
import { involucroCompagno, temperaturaLiberta } from '../../../lib/compagni/contratto.js';
import { regiaConversazione } from '../../../lib/compagni/controllore.js';
import { profiloEffettivo } from '../../../lib/compagni/profili.js';
import { LENTI_UMANE, contestoRelazione } from '../../../lib/compagni/vocazione.js';
import { ISTRUZIONE_VOCE, staccaModoVoce } from '../../../lib/voceEspressiva.js';

const log = createLogger('compagni-amico');

// ═══════════════════════════════════════════════════════════════
// /api/compagni/amico — parla con un Compagno che ricorda.
// Se il Compagno ha la memoria accesa: carica i ricordi, li mette nel
// prompt, risponde, e DOPO estrae i ricordi nuovi e li salva. Tutto
// passa dalla cerniera → wallet. Identità sempre dal token di sessione.
//
// La memoria è dato personale: qui NON siamo in una stanza, ma la regola
// resta — solo l'utente vede/possiede i propri ricordi (RLS server-only).
// ═══════════════════════════════════════════════════════════════

async function handlePost(req) {
  try {
    const body = await req.json();
    const userToken = typeof body.userToken === 'string' ? body.userToken : '';
    const compagnoId = typeof body.compagnoId === 'string' ? body.compagnoId : '';
    const lingua = typeof body.lingua === 'string' ? body.lingua.slice(0, 8) : 'it';
    const messaggi = Array.isArray(body.messaggi) ? body.messaggi.slice(-20) : [];
    // b.224 — gli obiettivi di vita arrivano dal client (vivono sul dispositivo)
    // e finiscono nel prompt: così il Compagno LI CONOSCE e ti accompagna.
    const obiettivi = Array.isArray(body.obiettivi) ? body.obiettivi.slice(0, 12) : [];

    const sessione = userToken ? await getSession(userToken) : null;
    if (!sessione?.email) return NextResponse.json({ error: 'Accedi per parlare col tuo Compagno' }, { status: 401 });
    const email = sessione.email;

    const compagno = await risolviCompagno(compagnoId, email);
    if (!compagno) return NextResponse.json({ error: 'Compagno non trovato' }, { status: 404 });

    const ultimo = messaggi.length ? (messaggi[messaggi.length - 1].testo || '') : '';
    if (!ultimo.trim()) return NextResponse.json({ error: 'Serve un messaggio' }, { status: 400 });

    // Memoria: solo se accesa sul Compagno. b.231 — ora i tag REALI del
    // messaggio guidano il richiamo dei ricordi consolidati (prima era []).
    let blocco = '';
    let quantoViConoscete = '';
    if (compagno.memoria) {
      const ricordi = await ricordiPerContesto(email, compagno.id, tagsDalTesto(ultimo));
      blocco = contestoMemoria(ricordi);
      // b.238 — il TEMPO DELLA RELAZIONE: chi ti conosce da sei mesi non ti
      // parla come chi ti ha appena incontrato. Confidenza e iniziativa
      // crescono con la storia, invece di ripartire da zero a ogni sessione.
      // Costo: zero query in più — i ricordi erano già stati caricati qui.
      quantoViConoscete = contestoRelazione(ricordi.length);
    }

    const storia = messaggi.slice(0, -1).map(m => `[${m.ruolo === 'compagno' ? compagno.nome : 'persona'}]: ${m.testo}`).join('\n');
    const bloccoObiettivi = formattaObiettivi(obiettivi);
    // b.231 — involucro comune: gerarchia di priorità, capacità dichiarate
    // (qui nessuna ricerca/fonte: così Omar non inventa fonti), regole
    // epistemiche, e la barra "libertà" che ora cambia testo e temperatura.
    const involucro = involucroCompagno({
      liberta: compagno.liberta,
      capacita: { ricerca: false, fonti: false, memoria: !!compagno.memoria },
      antiRipetizione: true,
      // b.237 — qui il Compagno è un amico, non un motore di risposte.
      // Il Deep Setting del Compagno può cambiare il profilo di questa
      // superficie; senza override vale il default ('conversazionale').
      profilo: profiloEffettivo(compagno, 'amico'),
    });
    // b.237 — la REGIA del turno: stima cosa sta facendo la persona (sfogo?
    // domanda? riflessione?) e detta la mossa. È il "conversation controller":
    // deterministico, zero latenza, e toglie il tic della domanda a ogni costo.
    const { blocco: regia } = regiaConversazione({ ultimo, storia: messaggi });
    const system = `${compagno.personalita || ''}\nSei ${compagno.nome}. Parli con una persona in modo naturale e caldo. Rispondi nella lingua: ${lingua}.${blocco}${quantoViConoscete}${bloccoObiettivi}${involucro}\n\n${LENTI_UMANE}${regia}\n\n${ISTRUZIONE_VOCE}`;
    const prompt = `${storia ? storia + '\n\n' : ''}[persona]: ${ultimo}\n\nRispondi come ${compagno.nome}.`;

    const r = await generaTesto({ system, prompt, provider: compagno.provider, modello: compagno.modello, userToken, maxTokens: 500, temperature: temperaturaLiberta(compagno.liberta) });
    if (!r.ok) {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      return NextResponse.json({ error: 'Nessuna risposta' }, { status: 502 });
    }

    // b.238 — il Compagno ha dichiarato in coda COME vuole dirlo: si stacca
    // dal testo (che non deve mai mostrarlo né farlo leggere) e viaggia
    // fino alla voce. Se manca o è malformato, 'neutro' e nulla cambia.
    const { testo: rispostaPulita, modo: modoVoce } = staccaModoVoce(r.testo);

    // Dopo la risposta: estrae e salva i ricordi nuovi (throttle leggero
    // per non estrarre a ogni singola battuta e non gonfiare i costi).
    if (compagno.memoria) {
      const conRisposta = [...messaggi, { ruolo: 'compagno', testo: rispostaPulita }];
      if (conRisposta.length >= 4 && conRisposta.length % 3 === 0) {
        try {
          const ricordi = await estraiRicordi(conRisposta, { userToken });
          if (ricordi.length) await aggiungiRicordi(email, compagno.id, ricordi);
        } catch { /* la memoria è un di più: se l'estrazione fallisce, la chat resta valida */ }
      }
    }

    return NextResponse.json({ ok: true, risposta: rispostaPulita, modoVoce, voceId: compagno.voce?.id, memoria: !!compagno.memoria });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// b.205 — la generazione lunga di Life puo superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;
export const POST = withApiGuard(handlePost, { maxRequests: 40, prefix: 'compagni-amico' });
