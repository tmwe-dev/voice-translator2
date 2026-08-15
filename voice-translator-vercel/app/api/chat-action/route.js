import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { buildCompactTranscript, getActionPrompt, isCJKConversation } from '../../lib/chatActions.js';
import { callLLM } from '../../lib/llmCaller.js';
import { creditoFinito, creditoInsufficiente, addebitaAzioneChat } from '../../wallet/addebita.js';
import { costoAzioneChat } from '../../wallet/consumo.js';
import { MIN_CHARGE, MIN_CREDITS } from '../../lib/config.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';

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
    // ── Direct mode guard ──
    try { assertCloudProcessingAllowed(request); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const body = await request.json();
    const { action, messages, members, mode, domain, userToken, lendingCode } = body;

    if (!action || !messages?.length) {
      return NextResponse.json({ error: 'action and messages required' }, { status: 400 });
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

    // b.159 — CONFERMATO: questa rotta autorizzava (resolveAuth) ma non
    // addebitava mai nessuno. resolveAuth controlla solo che il credito
    // NON SIA GIA a zero al momento dell'accesso: qui, come per
    // tts-elevenlabs, si aggiunge il vero controllo pre-spesa (il costo
    // fisso dell'azione non deve superare il credito residuo) PRIMA di
    // pagare la chiamata GPT, poi si addebita dopo il successo.
    const pagante = !auth.isOwnKey ? auth.billingEmail : null;
    if (pagante) {
      const costoPrevisto = costoAzioneChat();
      if (await creditoFinito(pagante, { failClosed: true })) {
        return NextResponse.json({ error: 'Credito esaurito' }, { status: 402 });
      }
      if (await creditoInsufficiente(pagante, costoPrevisto, { failClosed: true })) {
        return NextResponse.json({ error: 'Credito insufficiente' }, { status: 402 });
      }
    }

    // Build transcript and prompt
    const transcript = buildCompactTranscript(messages);
    const systemPrompt = getActionPrompt(action, { members, mode, domain });

    // Route to appropriate provider
    const useCJK = isCJKConversation(messages);
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
    // tts-elevenlabs. `pagante` e null per chi usa la propria chiave.
    if (pagante) {
      await addebitaAzioneChat(pagante);
      trackDailySpend(pagante, MIN_CHARGE.CHAT_ACTION).catch(() => {});
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
