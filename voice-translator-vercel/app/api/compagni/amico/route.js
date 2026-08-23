import { NextResponse } from 'next/server';
import { dopo } from '../../../lib/dopo.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { createLogger } from '../../../lib/logger.js';
import { getSession } from '../../../lib/users.js';
import { redis } from '../../../lib/redis.js';
import { risolviCompagno, idUtente } from '../../../lib/compagni/persistenza.js';
import { ricordiPerContesto, contestoMemoria, estraiRicordi, aggiungiRicordi, tagsDalTesto } from '../../../lib/compagni/memoria.js';
import { formattaObiettivi } from '../../../lib/compagni/obiettivi.js';
import { generaTesto } from '../../../lib/compagni/ponte.js';
import { involucroCompagno, temperaturaLiberta } from '../../../lib/compagni/contratto.js';
import { regiaConversazione } from '../../../lib/compagni/controllore.js';
import { profiloEffettivo, SUPERFICI_PROFILO } from '../../../lib/compagni/profili.js';
import { LENTI_UMANE, contestoRelazione } from '../../../lib/compagni/vocazione.js';
import { ISTRUZIONE_VOCE, staccaModoVoce } from '../../../lib/voceEspressiva.js';

const log = createLogger('compagni-amico');

// b.411 · P1.18 — quanti turni ha davvero questa conversazione, contati
// da noi. Vive un giorno: una conversazione che riprende domani ricomincia
// il conteggio, ed e il comportamento giusto — il throttle serve a non
// estrarre a ogni battuta, non a ricordarsi per sempre.
const CHIAVE_TURNI = (email, compagnoId) => `amico:turni:${idUtente(email)}:${String(compagnoId).slice(0, 64)}`;
const VITA_TURNI = 24 * 60 * 60;

async function contaTurno(email, compagnoId, ripiego) {
  try {
    const chiave = CHIAVE_TURNI(email, compagnoId);
    const n = await redis('INCR', chiave);
    if (Number(n) === 1) await redis('EXPIRE', chiave, VITA_TURNI);
    if (Number(n) > 0) return Number(n);
  } catch { /* deposito muto: si ripiega sul numero del client */ }
  return (ripiego > 0 ? ripiego : 0) + 1;
}

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
    const superficie = SUPERFICI_PROFILO.includes(body.superficie) ? body.superficie : 'amico';
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
      // b.386 — LA SUPERFICIE ARRIVA DA CHI CHIAMA. Questa rotta serve
      // due posti diversi — la chat dell'Amico e il compagno che ti sta
      // accanto mentre studi — e rispondeva sempre come se fosse la
      // chat. Cosi un Compagno regolato apposta per stare accanto veniva
      // ignorato: la superficie l'avevo dichiarata e non la usava
      // nessuno, che e il modo migliore per avere una regolazione che
      // sembra esserci e non fa niente.
      profilo: profiloEffettivo(compagno, superficie),
    });
    // b.237 — la lettura del turno: stima cosa sta facendo la persona (sfogo?
    // domanda? riflessione?) e la offre come IPOTESI. b.238 l'ha retrocessa da
    // decisore a indizio: non detta la mossa, la sceglie il Compagno.
    // Il commento diceva ancora "detta la mossa" — cioe descriveva l'esatta
    // architettura che abbiamo eliminato. Fra tre mesi qualcuno l'avrebbe
    // letto e ricostruito. Un commento che invecchia e' una trappola.
    const { blocco: regia } = regiaConversazione({ ultimo, storia: messaggi });
    // b.317 — audit D2: la LINGUA scelta per il Compagno era salvata e mai
    // letta ("Yuki parla giapponese" parlava in italiano). Ora, se il
    // Compagno ha una lingua sua, vince quella; altrimenti la lingua dell'app.
    const linguaEff = compagno.lingua || lingua;
    const system = `${compagno.personalita || ''}\nSei ${compagno.nome}. Parli con una persona. Rispondi nella lingua: ${linguaEff}.${blocco}${quantoViConoscete}${bloccoObiettivi}${involucro}\n\n${LENTI_UMANE}${regia}\n\n${ISTRUZIONE_VOCE}`;
    const prompt = `${storia ? storia + '\n\n' : ''}[persona]: ${ultimo}\n\nRispondi come ${compagno.nome}.`;

    const r = await generaTesto({ system, prompt, provider: compagno.provider, modello: compagno.modello, userToken, maxTokens: 500, temperature: temperaturaLiberta(compagno.liberta) });
    if (!r.ok) {
      if (r.status === 401) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
      if (r.status === 402) return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      // b.363 — il motivo del guasto esiste: buttarlo lasciava senza una
      // riga da leggere quando l'Amico smette di rispondere in produzione.
      log.warn('amico senza risposta', { motivo: r.motivo });
      return NextResponse.json({ error: 'Nessuna risposta', motivo: r.motivo }, { status: 502 });
    }

    // b.238 — il Compagno ha dichiarato in coda COME vuole dirlo: si stacca
    // dal testo (che non deve mai mostrarlo né farlo leggere) e viaggia
    // fino alla voce. Se manca o è malformato, 'neutro' e nulla cambia.
    const { testo: rispostaPulita, modo: modoVoce } = staccaModoVoce(r.testo);

    // Dopo la risposta: estrae e salva i ricordi nuovi (throttle leggero
    // per non estrarre a ogni singola battuta e non gonfiare i costi).
    //
    // b.244 — ora DOPO DAVVERO: l'estrazione e una seconda chiamata al
    // modello, e stava DENTRO il turno — chi parlava aspettava in silenzio
    // che il Compagno finisse di prendere appunti. Con `after()` la risposta
    // parte subito e gli appunti si scrivono a sipario chiuso.
    // b.244-bis — CONFERMATO da un audit esterno, ed era un difetto vero: il
    // conteggio si faceva su `messaggi`, che la rotta taglia a 20. Superati i
    // venti scambi la lunghezza restava SEMPRE 20 (+1 con la risposta = 21) e
    // 21 % 3 === 0: da quel momento la memoria si estraeva a OGNI turno —
    // l'esatto contrario del "throttle leggero" che il commento prometteva.
    // Ora si conta sul totale vero, che il client conosce e dichiara.
    // b.411 · P1.18 — IL CONTATORE ORA E' NOSTRO.
    //
    // `body.totale` lo dichiara il client. Non e un buco di accesso, ma e
    // un controllo di COSTO in mano a chi non lo paga: un client
    // modificato poteva mandare un totale che cade sempre sul multiplo di
    // tre e far girare l'estrazione (una chiamata al modello) a ogni
    // singolo turno — oppure mandare sempre 1 e non farla girare mai,
    // spegnendo la memoria in silenzio.
    //
    // Ora conta il server, in Redis, per (utente, Compagno). Il numero
    // del client resta come RIPIEGO se il deposito non risponde: meglio
    // un throttle imperfetto che un throttle assente.
    if (compagno.memoria) {
      const conRisposta = [...messaggi, { ruolo: 'compagno', testo: rispostaPulita }];
      const totaleTurni = await contaTurno(email, compagno.id, Number(body.totale) || messaggi.length);
      if (totaleTurni >= 4 && totaleTurni % 3 === 0) {
        dopo(async () => {
          try {
            const ricordi = await estraiRicordi(conRisposta, { userToken });
            if (ricordi.length) await aggiungiRicordi(email, compagno.id, ricordi);
          } catch { /* la memoria è un di più: se l'estrazione fallisce, la chat resta valida */ }
        });
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
