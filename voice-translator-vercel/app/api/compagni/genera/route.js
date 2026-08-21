import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';
import { promptAgente, estraiAgente } from '../../../lib/compagni/genera.js';

const log = createLogger('compagni-genera');

// ═══════════════════════════════════════════════════════════════
// /api/compagni/genera — costruisce un Compagno completo da una
// descrizione o un nome ("Elvis Presley", o "una coach diretta"), oppure
// a sorpresa. Ritorna { nome, ruolo, personalita, liberta, genere, barre }.
// La scrittura passa SOLO dalla cerniera (ponte → wallet). Modulo Life
// parallelo: qui si importa solo il dominio, mai le funzioni di BarTalk.
// ═══════════════════════════════════════════════════════════════

// b.212 — la generazione lunga può superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;

async function handlePost(req) {
  try {
    const body = await req.json();
    const userToken = typeof body.userToken === 'string' ? body.userToken : null;
    const lingua = typeof body.lingua === 'string' ? body.lingua.slice(0, 8) : 'it';
    const descrizione = typeof body.descrizione === 'string' ? body.descrizione.trim().slice(0, 200) : '';
    const sorpresa = body.sorpresa === true;

    const { system, prompt } = promptAgente({ descrizione, lingua, sorpresa });
    // b.308 — 600 token erano stretti per un profilo ricco (personalita lunga
    // in JSON): usciva troncato e "illeggibile". Ora c'e respiro.
    const r = await generaTesto({ system, prompt, userToken, maxTokens: 1100, temperature: 0.8 });
    if (!r.ok) {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Il motivo tornava al client ma non restava da nessuna parte.
      log.warn('Generazione compagno: chiamata al modello non riuscita');
      return NextResponse.json({ error: 'Generazione non riuscita', motivo: r.motivo }, { status: 502 });
    }

    const agente = estraiAgente(r.testo);
    if (!agente || !agente.personalita) {
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Il modello rispondeva male e non lo sapeva nessuno.
      log.warn('Generazione compagno: risposta del modello illeggibile');
      return NextResponse.json({ error: 'Profilo illeggibile', motivo: 'json-illeggibile' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, agente });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Generazione AI: tetto di frequenza basso.
export const POST = withApiGuard(handlePost, { maxRequests: 20, prefix: 'compagni-genera' });
