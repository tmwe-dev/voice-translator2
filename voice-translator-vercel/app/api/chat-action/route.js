import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { buildCompactTranscript, getActionPrompt, isCJKConversation, inquadraTrascrizione, COMPITO_AZIONE } from '../../lib/chatActions.js';
import { callLLM } from '../../lib/llmCaller.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { costoAzioneChat } from '../../wallet/consumo.js';
import { MIN_CHARGE, MIN_CREDITS } from '../../lib/config.js';
import { createLogger } from '../../lib/logger.js';
import { assertElaborazioneConsentita, DirectModeError } from '../../lib/sessionGuard.js';

const log = createLogger('chatAction');

// Lazy import for Asia provider (only loaded when needed)
let _callQwen = null;
async function getCallQwen() {
  if (!_callQwen) {
    const mod = await import('../../lib/llmAsia.js');
    _callQwen = mod.callQwen;
  }
  return _callQwen;
}

/**
 * POST /api/chat-action
 *
 * Body: {
 *   action: 'summary'|'report'|'analysis'|'advice'|'vocabulary',
 *   messages: [...],  // Conversation messages from device
 *   members: [...],   // Participants
 *   mode: string,
 *   domain: string,
 *   userToken: string,
 *   lendingCode: string,
 * }
 *
 * Returns: { result: string, provider: string, cost: number }
 */
async function handlePost(request) {
  // b.171 — riserva wallet dichiarata FUORI dal try, cosi il ramo di
  // errore la puo restituire (release) qualunque cosa vada storto dopo
  // averla presa. Stesso schema di tts/route.js.
  let riservaId = null;
  try {
    const body = await request.json();

    // ── b.363 · L'INTERO CORPO ANDAVA AL MODELLO SENZA UN CONTROLLO ──
    //
    // `messages` veniva passato dritto a chi costruisce la trascrizione,
    // che fa `messages.length` e poi `.map(...)`: se non era una lista, la
    // rotta esplodeva con un 500 nostro; se era una lista di centomila
    // messaggi da un megabyte l'uno, diventava una chiamata a pagamento
    // enorme, addebitata a noi. `action` sceglieva le istruzioni da
    // mandare, e `mode`/`domain` finivano DENTRO quelle istruzioni: tre
    // valori scritti dal client dentro il messaggio di sistema del modello.
    // Le azioni possibili sono cinque e si sanno.
    const AZIONI = ['summary', 'report', 'analysis', 'advice', 'vocabulary'];
    const MAX_MESSAGGI = 2000;
    const parola = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);

    const action = parola(body?.action, 20);
    const messages = body?.messages;
    const members = Array.isArray(body?.members) ? body.members.slice(0, 50) : undefined;
    const mode = parola(body?.mode, 40);
    const domain = parola(body?.domain, 60);
    const userToken = parola(body?.userToken, 200);
    const lendingCode = parola(body?.lendingCode, 60);
    const roomId = parola(body?.roomId, 64);
    const roomSessionToken = parola(body?.roomSessionToken, 200);

    if (!action || !AZIONI.includes(action) || !Array.isArray(messages) || !messages.length) {
      return NextResponse.json({ error: 'action and messages required' }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGGI) {
      return NextResponse.json({ error: 'Troppi messaggi' }, { status: 413 });
    }

    // ── Direct mode guard ──
    // b.167 — CONFERMATO (audit esterno 15/8): mancava del tutto, in
    // qualunque forma. Un'azione chat (riassunto/report/analisi) su una
    // stanza Diretta mandava l'intera trascrizione al provider cloud
    // senza che il server potesse mai saperlo — non c'era nemmeno
    // l'intestazione a fermarla. Ora c'e la guardia autorevole, come le
    // altre rotte che toccano contenuto.
    try {
      await assertElaborazioneConsentita(request, { roomId, roomSessionToken });
    } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    // Auth (requires credits or own keys)
    const auth = await resolveAuth({
      userToken,
      lendingCode,
      provider: 'openai',
      minCredits: MIN_CREDITS.CHAT_ACTION,
      skipCreditCheck: false,
    });

    if (!auth?.apiKey) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Route to appropriate provider — deciso PRIMA del gate: serve per
    // sapere se questa richiesta potrebbe finire su Qwen (vedi sotto).
    const useCJK = isCJKConversation(messages);

    // b.159 — CONFERMATO: questa rotta autorizzava (resolveAuth) ma non
    // addebitava mai nessuno. resolveAuth controlla solo che il credito
    // NON SIA GIA a zero al momento dell'accesso: qui, come per
    // tts-elevenlabs, si aggiunge il vero controllo pre-spesa (il costo
    // fisso dell'azione non deve superare il credito residuo) PRIMA di
    // pagare la chiamata GPT, poi si addebita dopo il successo.
    //
    // b.160 — CONFERMATO (secondo audit esterno, punto 3): la vecchia
    // versione decideva "chi paga" SOLO da auth.isOwnKey (la chiave
    // OpenAI dichiarata), ma per le conversazioni CJK questa rotta puo
    // instradare su Qwen/DashScope (vedi llmAsia.js: nessun percorso a
    // chiave propria, usa sempre DASHSCOPE_API_KEY di piattaforma). Un
    // utente con chiave OpenAI propria su una conversazione CJK otteneva
    // un'azione chat via Qwen — costo reale per BarTalk — senza nessun
    // addebito wallet, perche auth.isOwnKey=true faceva sembrare che
    // pagasse lui. Il pre-controllo ora scatta anche solo per il
    // sospetto (conversazione CJK), l'addebito vero e' deciso DOPO,
    // guardando quale provider ha risposto per davvero (vedi sotto).
    const possibilePiattaforma = useCJK || !auth.isOwnKey;
    const paganteGate = possibilePiattaforma ? auth.billingEmail : null;
    // b.171 — RISERVA prima del fornitore, non piu "controlla poi
    // addebita". Il vecchio pre-controllo (creditoFinito +
    // creditoInsufficiente) leggeva il saldo ma non lo bloccava: due
    // azioni chat concorrenti passavano entrambe il controllo sullo
    // STESSO saldo e chiamavano entrambe GPT, poi solo l'addebito finale
    // ne distingueva una — l'altra era gia costata. Ora si blocca il
    // costo fisso SUBITO e atomico (riserva), come translate/tts: se il
    // fornitore risponde si conferma (commit), se fallisce si restituisce
    // (release, nel catch). Costo fisso, quindi commit allo stesso importo.
    const costoAzione = costoAzioneChat();
    if (paganteGate) {
      const r = await riserva(paganteGate, costoAzione, { tipo: 'azione_chat', azione: action });
      if (!r.ok) {
        return NextResponse.json({ error: 'Credito insufficiente' }, { status: 402 });
      }
      riservaId = r.riservaId;
    }

    // Build transcript and prompt
    const transcript = buildCompactTranscript(messages);
    // b.617 — la trascrizione entra RECINTATA, col compito ripetuto dopo:
    // senza, il modello continuava il dialogo e le battute inventate
    // uscivano come «riassunto». Vedi chatActions.js.
    const turnoUtente = inquadraTrascrizione(transcript, COMPITO_AZIONE[action] || COMPITO_AZIONE.summary);
    const systemPrompt = getActionPrompt(action, { members, mode, domain });

    let result;
    let provider;

    if (useCJK) {
      try {
        const callQwen = await getCallQwen();
        result = await callQwen({
          model: 'gpt-4o-mini', // Will be remapped to qwen-turbo
          messages: [{ role: 'user', content: turnoUtente }],
          systemPrompt,
          temperature: 0.4,
          maxTokens: 2000,
        });
        provider = 'qwen';
      } catch {
        // Fallback to global
        result = await callLLM({
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKey: auth.apiKey,
          messages: [{ role: 'user', content: turnoUtente }],
          systemPrompt,
          temperature: 0.4,
          maxTokens: 2000,
        });
        provider = 'openai';
      }
    } else {
      result = await callLLM({
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: auth.apiKey,
        messages: [{ role: 'user', content: turnoUtente }],
        systemPrompt,
        temperature: 0.4,
        maxTokens: 2000,
      });
      provider = 'openai';
    }

    // b.159 — addebito DOPO il successo della chiamata (mai prima: se
    // GPT fallisce non si paga niente), come da schema gia usato in
    // tts-elevenlabs.
    // b.160 — chi paga si decide sul provider REALMENTE eseguito: Qwen
    // e' sempre a carico di piattaforma (vedi nota sopra), il ramo
    // OpenAI (diretto o di fallback da Qwen fallito) rispetta la vera
    // auth.isOwnKey.
    const paganteReale = (provider === 'qwen' || !auth.isOwnKey) ? auth.billingEmail : null;
    // b.171 — chiusura della riserva. Se paga la piattaforma (Qwen, o
    // OpenAI con chiave di piattaforma) si conferma (commit); se invece la
    // richiesta era CJK — quindi si era riservato — ma il fallback e finito
    // su OpenAI con la chiave PROPRIA dell'utente, la piattaforma non paga:
    // si restituisce la riserva (release). Stesso ramo di tts/route.js.
    if (riservaId) {
      if (paganteReale) {
        await commit(riservaId, costoAzione, { tipo: 'azione_chat', azione: action, provider });
      } else {
        await release(riservaId, 'chiave_propria');
      }
      riservaId = null;
    }
    if (paganteReale) {
      // b.170 — netta la riserva del BUDGET GIORNALIERO fatta da
      // resolveAuth (vedi apiAuth.js): sistema diverso dal wallet qui
      // sopra (centesimi di budget piattaforma vs secondi di wallet).
      trackDailySpend(paganteReale, MIN_CHARGE.CHAT_ACTION, auth.riservatoUtenteCents, auth.riservatoPiattaformaCents).catch(() => {});
    }

    return NextResponse.json({
      result: result.translated || result.text || '',
      provider,
      action,
      usage: result.usage,
    });
  } catch (err) {
    // b.171 — se una riserva era attiva e siamo finiti qui (fornitore
    // fallito, errore imprevisto), la si restituisce: mai lasciare credito
    // bloccato per una chiamata che non ha prodotto nulla.
    if (riservaId) await release(riservaId, 'errore_imprevisto').catch(() => {});
    log.error('Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'chat-action' });
