import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagno } from '../../../lib/compagni/persistenza.js';
import { ricordiPerContesto, contestoMemoria, estraiRicordi, aggiungiRicordi } from '../../../lib/compagni/memoria.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';

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

    const sessione = userToken ? await getSession(userToken) : null;
    if (!sessione?.email) return NextResponse.json({ error: 'Accedi per parlare col tuo Compagno' }, { status: 401 });
    const email = sessione.email;

    const compagno = await risolviCompagno(compagnoId, email);
    if (!compagno) return NextResponse.json({ error: 'Compagno non trovato' }, { status: 404 });

    const ultimo = messaggi.length ? (messaggi[messaggi.length - 1].testo || '') : '';
    if (!ultimo.trim()) return NextResponse.json({ error: 'Serve un messaggio' }, { status: 400 });

    // Memoria: solo se accesa sul Compagno.
    let blocco = '';
    if (compagno.memoria) {
      const ricordi = await ricordiPerContesto(email, compagno.id, []);
      blocco = contestoMemoria(ricordi);
    }

    const storia = messaggi.slice(0, -1).map(m => `[${m.ruolo === 'compagno' ? compagno.nome : 'persona'}]: ${m.testo}`).join('\n');
    const system = `${compagno.personalita || ''}\nSei ${compagno.nome}. Parli con una persona in modo naturale e caldo. Rispondi nella lingua: ${lingua}.${blocco}`;
    const prompt = `${storia ? storia + '\n\n' : ''}[persona]: ${ultimo}\n\nRispondi come ${compagno.nome}.`;

    const r = await generaTesto({ system, prompt, provider: compagno.provider, modello: compagno.modello, userToken, maxTokens: 500 });
    if (!r.ok) {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      return NextResponse.json({ error: 'Nessuna risposta' }, { status: 502 });
    }

    // Dopo la risposta: estrae e salva i ricordi nuovi (throttle leggero
    // per non estrarre a ogni singola battuta e non gonfiare i costi).
    if (compagno.memoria) {
      const conRisposta = [...messaggi, { ruolo: 'compagno', testo: r.testo }];
      if (conRisposta.length >= 4 && conRisposta.length % 3 === 0) {
        try {
          const ricordi = await estraiRicordi(conRisposta, { userToken });
          if (ricordi.length) await aggiungiRicordi(email, compagno.id, ricordi);
        } catch { /* la memoria è un di più: se l'estrazione fallisce, la chat resta valida */ }
      }
    }

    return NextResponse.json({ ok: true, risposta: r.testo, voceId: compagno.voce?.id, memoria: !!compagno.memoria });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// b.205 — la generazione lunga di Life puo superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;
export const POST = withApiGuard(handlePost, { maxRequests: 40, prefix: 'compagni-amico' });
