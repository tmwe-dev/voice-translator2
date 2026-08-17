import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagni } from '../../../lib/compagni/persistenza.js';
import { promptTavolo, TAVOLO_MAX } from '../../../lib/compagni/tavolo.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';

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

    const sessione = userToken ? await getSession(userToken) : null;
    const compagni = await risolviCompagni(ids, sessione?.email);
    if (compagni.length < 2) return NextResponse.json({ error: 'Scegli almeno due Compagni' }, { status: 400 });

    const ultimoUmano = messaggi.length ? (messaggi[messaggi.length - 1].testo || '') : '';
    if (!ultimoUmano.trim()) return NextResponse.json({ error: 'Serve un messaggio' }, { status: 400 });
    const storia = messaggi.slice(0, -1);

    const risposte = [];
    const altriQuestoGiro = [];
    for (const c of compagni) {
      const { system, prompt } = promptTavolo({ compagno: c, storia, ultimoUmano, altriQuestoGiro, lingua });
      const r = await generaTesto({ system, prompt, provider: c.provider, modello: c.modello, userToken, maxTokens: 220 });
      if (!r.ok) {
        if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
        if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
        continue; // un Compagno muto non ferma il tavolo
      }
      risposte.push({ compagnoId: c.id, nome: c.nome, voceId: c.voce?.id, testo: r.testo });
      altriQuestoGiro.push({ nome: c.nome, testo: r.testo });
    }

    if (risposte.length === 0) return NextResponse.json({ error: 'Nessuna risposta' }, { status: 502 });
    return NextResponse.json({ ok: true, risposte });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// b.205 — la generazione lunga di Life puo superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;
export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'compagni-tavolo' });
