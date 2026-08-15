import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { buildCompactTranscript, getActionPrompt, isCJKConversation } from '../../lib/chatActions.js';
import { callLLM } from '../../lib/llmCaller.js';
import { creditoFinito, creditoInsufficiente, addebitaAzioneChat } from '../../wallet/addebita.js';
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
  try {
    const body = await request.json();
    const { action, messages, members, mode, domain, userToken, lendingCode, roomId, roomSessionToken } = body;

    if (!action || !messages?.length) {
      return NextResponse.json({ error: 'action and messages required' }, { status: 400 });
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
    if (paganteGate) {
      const costoPrevisto = costoAzioneChat();
      if (await creditoFinito(paganteGate, { failClosed: true })) {
        return NextResponse.json({ error: 'Credito esaurito' }, { status: 402 });
      }
      if (await creditoInsufficiente(paganteGate, costoPrevisto, { failClosed: true })) {
        return NextResponse.json({ error: 'Credito insufficiente' }, { status: 402 });
      }
    }

    // Build transcript and prompt
    const transcript = buildCompactTranscript(messages);
    const systemPrompt = getActionPrompt(action, { members, mode, domain });

    let result;
    let provider;

    if (useCJK) {
      try {
        const callQwen = await getCallQwen();
        result = await callQwen({
          model: 'gpt-4o-mini', // Will be remapped to qwen-turbo
          messages: [{ role: 'user', content: transcript }],
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
          messages: [{ role: 'user', content: transcript }],
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
        messages: [{ role: 'user', content: transcript }],
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
    if (paganteReale) {
      await addebitaAzioneChat(paganteReale);
      // b.170 — netta la riserva fatta da resolveAuth (vedi apiAuth.js).
      // Se il pagante reale e' finito su Qwen mentre l'auth aveva
      // isOwnKey=true, resolveAuth non aveva riservato nulla (0, il
      // default): qui si limita a sommare il costo vero, come prima.
      trackDailySpend(paganteReale, MIN_CHARGE.CHAT_ACTION, auth.riservatoUtenteCents, auth.riservatoPiattaformaCents).catch(() => {});
    }

    return NextResponse.json({
      result: result.translated || result.text || '',
      provider,
      action,
      usage: result.usage,
    });
  } catch (err) {
    log.error('Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'chat-action' });
