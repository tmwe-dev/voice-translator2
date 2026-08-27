import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { risolviCompagni } from '../../../lib/compagni/persistenza.js';
import { ordineTurni, promptTurno, validaPodcast, PODCAST_LIMITI, PODCAST_RICHIESTE_MAX } from '../../../lib/compagni/podcast.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';
import { analizzaConvergenza, istruzioneConvergenza } from '../../../lib/compagni/orchestratore.js';
import { temperaturaLiberta, temperaturaDibattito, staccaEsito } from '../../../lib/compagni/contratto.js';

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

    // ── b.244 · UN TURNO PER VOLTA ──
    // Prima questa rotta generava TUTTI i turni in una sola richiesta: con 4
    // Compagni erano 16 chiamate al modello in fila dentro un limite di 60
    // secondi. O andava in timeout a meta (avendo gia addebitato i turni
    // fatti), oppure obbligava a tenere basso il numero di round.
    // Ora il client chiede un turno alla volta e li incatena da se: nessun
    // turno puo scadere, e il tetto dei round non e piu legato al timeout.
    if (body.azione === 'turno') {
      const totRound = Math.max(PODCAST_LIMITI.MIN_ROUND, Math.min(Number(round) || PODCAST_LIMITI.ROUND_PREDEFINITI, PODCAST_LIMITI.MAX_ROUND));
      const tutti = ordineTurni(compagni, totRound);
      const i = Math.max(0, Number(body.indice) || 0);
      if (i >= tutti.length) return NextResponse.json({ ok: true, fine: true, totale: tutti.length });
      const t = tutti[i];
      const c = perId.get(t.compagnoId);
      if (!c) return NextResponse.json({ ok: true, saltato: true, indice: i, totale: tutti.length });
      const precedentiClient = Array.isArray(body.precedenti) ? body.precedenti.slice(-6) : [];
      // b.380 — IL RILEVATORE DI STAGNAZIONE C'ERA GIA, E IL PODCAST NON
      // LO USAVA. Il tavolo guarda il CONTENUTO degli interventi e capisce
      // se stanno girando a vuoto o se si stanno solo dando ragione; poi
      // spinge. Qui, dove il difetto si vedeva di piu — quattro turni di
      // complimenti senza un numero — non veniva chiamato nessuno.
      const stato = analizzaConvergenza(precedentiClient, lingua);
      const convergenza = istruzioneConvergenza(stato, lingua);
      const { system, user } = promptTurno({
        compagno: c, argomento, round: t.round, totaleRound: totRound,
        precedenti: precedentiClient, lingua, convergenza,
      });
      const esito = await generaTesto({
        system, prompt: user, provider: c.provider, modello: c.modello,
        userToken,
        // b.525 — il tetto sale (300/350): la brevita la governa il prompt
        // («2-3 frasi»), non un taglio duro che tronca la frase a meta e
        // la fa leggere tronca alla voce. E la temperatura e quella di
        // scena (pavimento 0.8, come il formato radio di RadioChat).
        maxTokens: t.round === 1 ? 350 : 300,
        temperature: temperaturaDibattito(c.liberta),
      });
      if (!esito.ok) {
        if (esito.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
        if (esito.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
        return NextResponse.json({ ok: true, saltato: true, indice: i, totale: tutti.length });
      }
      // b.362 — l'esito tipizzato anche qui: chi marca "passo" salta il
      // turno (il client passa al successivo), la sua riga non va in onda.
      const { testo: testoTurno, esito: tipoTurno } = staccaEsito(esito.testo);
      if (tipoTurno === 'passo' || !testoTurno) {
        return NextResponse.json({ ok: true, saltato: true, indice: i, totale: tutti.length });
      }
      return NextResponse.json({
        ok: true, indice: i, totale: tutti.length,
        turno: { ordine: t.ordine, round: t.round, compagnoId: c.id, nome: c.nome, voceId: c.voce?.id, testo: testoTurno },
      });
    }
    // b.362 — il ramo "tutto in una chiamata" e stato rimosso: era morto.
    // Il client incatena SEMPRE un turno per volta (azione 'turno', b.244);
    // il vecchio percorso non era piu raggiungibile da nessuna chiamata.
    return NextResponse.json({ error: "Usa l'azione 'turno'" }, { status: 400 });
  } catch (e) {
    log.error('Errore:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// b.205 — la generazione lunga di Life puo superare i 15s: diamo tempo alla funzione.
export const maxDuration = 60;
// b.409 — IL TETTO SI RICAVA DAL CONTRATTO, non si sceglie a mano. Qui
// c'era `maxRequests: 10`, un numero giusto per quando il podcast era UNA
// richiesta sola; da b.244 e una richiesta PER TURNO, e il contratto ne
// permette fino a MAX_COMPAGNI x MAX_ROUND. Un tetto sotto il flusso
// legittimo non e una difesa: e un difetto che si presenta come difesa.
export const POST = withApiGuard(handlePost, { maxRequests: PODCAST_RICHIESTE_MAX, prefix: 'compagni-podcast' });
