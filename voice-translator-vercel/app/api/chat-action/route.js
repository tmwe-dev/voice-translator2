import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { resolveAuth } from '../../lib/apiAuth.js';
import { checkRateLimit } from '../../lib/rateLimit.js';
import { buildCompactTranscript, getActionPrompt, isCJKConversation } from '../../lib/chatActions.js';
import { callLLM } from '../../lib/llmCaller.js';

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
    const { action, messages, members, mode, domain, userToken, lendingCode } = body;

    if (!action || !messages?.length) {
      return NextResponse.json({ error: 'action and messages required' }, { status: 400 });
    }

    // Auth (requires credits or own keys)
    const auth = await resolveAuth({
      userToken,
      lendingCode,
      provider: 'openai',
      minCredits: 0.5,
      skipCreditCheck: false,
    });

    if (!auth?.apiKey) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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

    return NextResponse.json({
      result: result.translated || result.text || '',
      provider,
      action,
      usage: result.usage,
    });
  } catch (err) {
    console.error('[chat-action] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'chat-action' });
