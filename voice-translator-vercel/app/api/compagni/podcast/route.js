import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagni } from '../../../lib/compagni/persistenza.js';
import { ordineTurni, promptTurno, validaPodcast, PODCAST_LIMITI } from '../../../lib/compagni/podcast.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';

const log = createLogger('compagni-podcast');

// ═══════════════════════════════════════════════════════════════
// /api/compagni/podcast — genera il "copione" di un podcast: 2-4
// Compagni discutono un argomento a round. Per ogni turno chiede alla
// CERNIERA (ponte.generaTesto) un intervento con la personalità del
// Compagno, nella lingua richiesta, PASSANDO DAL WALLET. Restituisce il
// copione [{compagno, voceId, testo}]: la voce (TTS) la fa il client con
// /api/tts-elevenlabs, come già avviene per i messaggi.
//
// Autonomia: questa rotta importa SOLO il dominio Life (catalogo, podcast,
// ponte). Non tocca funzioni interne di BarTalk se non attraverso il ponte.
// ═══════════════════════════════════════════════════════════════

async function handlePost(req) {
  try {
    const body = await req.json();
    const argomento = typeof body.argomento === 'string' ? body.argomento.trim().slice(0, 200) : '';
    const lingua = typeof body.lingua === 'string' ? body.lingua.slice(0, 8) : 'it';
    const round = body.round;
    const userToken = typeof body.userToken === 'string' ? body.userToken : null;
    const ids = Array.isArray(body.compagni) ? body.compagni.slice(0, PODCAST_LIMITI.MAX_COMPAGNI) : [];

    // Predefiniti + Compagni creati dall'utente (risolti dal suo token).
    const sessione = userToken ? await getSession(userToken) : null;
    const compagni = await risolviCompagni(ids, sessione?.email);

    const val = validaPodcast({ compagni, argomento });
    if (!val.ok) {
      const msg = val.motivo === 'argomento-mancante' ? 'Serve un argomento' : 'Servono almeno due Compagni';
      return NextResponse.json({ error: msg, motivo: val.motivo }, { status: 400 });
    }

    const perId = new Map(compagni.map(c => [c.id, c]));
    const totaleRound = Math.max(PODCAST_LIMITI.MIN_ROUND, Math.min(Number(round) || PODCAST_LIMITI.ROUND_PREDEFINITI, PODCAST_LIMITI.MAX_ROUND));
    const turni = ordineTurni(compagni, totaleRound);

    const copioni = [];
    const precedenti = []; // {nome, testo} — cresce lungo il podcast

    for (const t of turni) {
      const c = perId.get(t.compagnoId);
      if (!c) continue;
      const { system, user } = promptTurno({
        compagno: c, argomento, round: t.round, totaleRound,
        precedenti: precedenti.slice(-6), // gli ultimi interventi, per non gonfiare il prompt
        lingua,
      });
      const esito = await generaTesto({
        system, prompt: user,
        provider: c.provider, modello: c.modello,
        userToken, maxTokens: t.round === 1 ? 420 : 320,
      });
      if (!esito.ok) {
        // Un turno fallito non deve buttare giù tutto il podcast: si salta,
        // ma se è per credito/auth si ferma e lo dice.
        if (esito.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
        if (esito.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
        log.warn('turno saltato:', t.compagnoId, esito.motivo);
        continue;
      }
      const voce = { ordine: t.ordine, round: t.round, compagnoId: c.id, nome: c.nome, voceId: c.voce?.id, testo: esito.testo };
      copioni.push(voce);
      precedenti.push({ nome: c.nome, testo: esito.testo });
    }

    if (copioni.length === 0) {
      return NextResponse.json({ error: 'Podcast non generato' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, argomento, lingua, totaleRound, copioni });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Il podcast fa più chiamate AI: tetto di frequenza basso per prevenire abusi.
export const POST = withApiGuard(handlePost, { maxRequests: 10, prefix: 'compagni-podcast' });
